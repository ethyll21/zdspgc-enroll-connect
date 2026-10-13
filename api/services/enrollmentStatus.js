const db = require('../db');

/**
 * Required documents definition:
 * For 'new' and 'transferee' students (and any general enrollment):
 * - psa_birth_certificate
 * - form_138
 * - good_moral
 *
 * For 'old' and 'returnee' students:
 * If registration_form document was uploaded:
 * - registration_form
 */
const REQUIRED_DOCS_BY_TYPE = {
  new: ['psa_birth_certificate', 'form_138', 'good_moral'],
  transferee: ['psa_birth_certificate', 'form_138', 'good_moral'],
  default: ['psa_birth_certificate', 'form_138', 'good_moral'],
};

/**
 * Evaluates whether all required documents for an enrollment have been approved.
 * Automatically transitions the enrollment status:
 * - "approved": When all required documents are approved.
 * - "pending": When one or more required documents are pending, unapproved, rejected, or missing.
 *
 * @param {string} enrollmentId 
 * @param {string|null} reviewerId (admin user_id performing the action)
 * @param {object|null} existingClient (optional pg client if inside an existing transaction)
 * @returns {Promise<{
 *   enrollmentId: string,
 *   previousStatus: string,
 *   newStatus: string,
 *   allRequiredApproved: boolean,
 *   requiredDocTypes: string[],
 *   details: { docType: string, status: string, isApproved: boolean }[]
 * }|null>}
 */
async function syncEnrollmentStatus(enrollmentId, reviewerId = null, existingClient = null) {
  if (!enrollmentId) return null;

  const client = existingClient || (await db.getClient());
  const shouldRelease = !existingClient;

  try {
    // 1. Fetch enrollment and student info
    const enrollRes = await client.query(
      `SELECT e.id, e.student_id, e.student_type, e.status, e.remarks, e.school_year, e.semester, e.subjects,
              s.user_id, s.first_name, s.last_name,
              p.code AS program_code, p.name AS program_name
       FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       LEFT JOIN public.programs p ON p.id = s.program_id
       WHERE e.id = $1`,
      [enrollmentId]
    );

    if (enrollRes.rows.length === 0) {
      return null;
    }

    const enrollment = enrollRes.rows[0];
    const previousStatus = enrollment.status;
    const studentType = (enrollment.student_type || 'new').toLowerCase();

    // 2. Fetch all documents for this enrollment (support both created_at and uploaded_at schemas)
    let orderClause = 'id DESC';
    try {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'documents' 
          AND column_name IN ('created_at', 'uploaded_at')
      `);
      const cols = colCheck.rows.map((r) => r.column_name);
      if (cols.includes('created_at')) {
        orderClause = 'created_at DESC';
      } else if (cols.includes('uploaded_at')) {
        orderClause = 'uploaded_at DESC';
      }
    } catch (colErr) {
      orderClause = 'id DESC';
    }

    const docsRes = await client.query(
      `SELECT id, doc_type, status
       FROM public.documents
       WHERE enrollment_id = $1 OR (enrollment_id IS NULL AND student_id = $2)
       ORDER BY ${orderClause}`,
      [enrollmentId, enrollment.student_id]
    );
    const docs = docsRes.rows;

    // 3. For old/existing students with no documents submitted:
    // Do not apply automatic status updates; admin manually takes action below the student's application.
    const isOldStudent = studentType === 'old' || studentType === 'returnee' || (!enrollment.student_type && Array.isArray(enrollment.subjects) && enrollment.subjects.length > 0);
    let requiredDocTypes;
    if (isOldStudent) {
      const hasRegForm = docs.some((d) => d.doc_type === 'registration_form');
      if (hasRegForm) {
        requiredDocTypes = ['registration_form'];
      } else {
        // Old students with no document uploads: do not apply automatic status updates
        return {
          enrollmentId,
          previousStatus,
          newStatus: previousStatus,
          allRequiredApproved: false,
          requiredDocTypes: [],
          details: [],
        };
      }
    } else {
      requiredDocTypes = REQUIRED_DOCS_BY_TYPE[studentType] || REQUIRED_DOCS_BY_TYPE.default;
    }

    // 4. Check each required document
    const details = [];
    let allRequiredApproved = true;

    for (const reqType of requiredDocTypes) {
      const matchingDocs = docs.filter((d) => d.doc_type === reqType);
      if (matchingDocs.length === 0) {
        // Missing required document
        allRequiredApproved = false;
        details.push({ docType: reqType, status: 'missing', isApproved: false });
      } else {
        // The most recently uploaded document of this type represents the current document
        const latestDoc = matchingDocs[0];
        const isApproved = latestDoc.status === 'approved';
        if (!isApproved) {
          allRequiredApproved = false;
        }
        details.push({ docType: reqType, status: latestDoc.status, isApproved });
      }
    }

    // Check if admin has reviewed at least one submitted document
    const hasAnyReviewedDoc = docs.some((d) => d.status === 'approved' || d.status === 'rejected');

    // 5. Determine target status
    let targetStatus;
    if (allRequiredApproved) {
      targetStatus = 'approved';
    } else if (hasAnyReviewedDoc) {
      // Once the admin approves or rejects at least one document, automatically change to Under Review
      targetStatus = 'under_review';
    } else {
      // Keep Pending only when the admin has not reviewed any submitted document
      targetStatus = 'pending';
    }

    let newStatus = previousStatus;

    // Resolve an admin ID for logging validation history
    let adminId = reviewerId || enrollment.reviewed_by;
    if (!adminId) {
      try {
        const adminLookup = await client.query(`SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1`);
        adminId = adminLookup.rows[0]?.user_id || null;
      } catch (e) {
        adminId = null;
      }
    }

    if (targetStatus === 'approved' && previousStatus !== 'approved') {
      const autoRemark = 'All required documents have been verified and approved.';
      await client.query(
        `UPDATE public.enrollments
         SET status = 'approved',
             reviewed_at = NOW(),
             reviewed_by = COALESCE($1, reviewed_by),
             remarks = COALESCE(NULLIF(remarks, ''), $2),
             updated_at = NOW()
         WHERE id = $3`,
        [adminId, autoRemark, enrollmentId]
      );
      newStatus = 'approved';

      // Record validation history
      if (adminId) {
        try {
          await client.query(
            `INSERT INTO public.validation_records (enrollment_id, validated_by, result, notes)
             VALUES ($1, $2, 'approved', 'Automatic approval: all required documents verified.')`,
            [enrollmentId, adminId]
          );
        } catch (vErr) {
          console.warn('[syncEnrollmentStatus] Validation record error (non-fatal):', vErr.message);
        }
      }

      // Notify the student
      const richMessage = JSON.stringify({
        isRichCard: true,
        type: 'approved',
        studentName: `${enrollment.first_name} ${enrollment.last_name}`.trim(),
        appNo: `APP-${enrollmentId.split('-')[0].toUpperCase()}`,
        program: enrollment.program_name || enrollment.program_code || 'N/A',
        reviewedBy: 'Registrar',
        date: new Date().toISOString(),
        remarks: autoRemark,
        fallbackMessage: 'Your application has been approved.',
      });

      try {
        await client.query(
          `INSERT INTO public.notifications (user_id, title, message, link)
           VALUES ($1, $2, $3, $4)`,
          [
            enrollment.user_id,
            'Application Approved',
            richMessage,
            `/applications/${enrollmentId}`,
          ]
        );
      } catch (notifErr) {
        console.warn('[syncEnrollmentStatus] Notification failed (non-fatal):', notifErr.message);
      }
    } else if (targetStatus === 'under_review' && previousStatus !== 'under_review' && previousStatus !== 'rejected') {
      await client.query(
        `UPDATE public.enrollments
         SET status = 'under_review',
             updated_at = NOW()
         WHERE id = $1`,
        [enrollmentId]
      );
      newStatus = 'under_review';

      // Record validation history
      if (adminId) {
        try {
          await client.query(
            `INSERT INTO public.validation_records (enrollment_id, validated_by, result, notes)
             VALUES ($1, $2, 'under_review', 'Document reviewed: application status automatically updated to Under Review.')`,
            [enrollmentId, adminId]
          );
        } catch (vErr) {
          console.warn('[syncEnrollmentStatus] Validation record error (non-fatal):', vErr.message);
        }
      }

      // Notify the student
      const richMessage = JSON.stringify({
        isRichCard: true,
        type: 'under_review',
        studentName: `${enrollment.first_name} ${enrollment.last_name}`.trim(),
        appNo: `APP-${enrollmentId.split('-')[0].toUpperCase()}`,
        program: enrollment.program_name || enrollment.program_code || 'N/A',
        reviewedBy: 'Registrar',
        date: new Date().toISOString(),
        remarks: 'Your submitted documents are currently under review.',
        fallbackMessage: 'Your application status is now Under Review.',
      });

      try {
        await client.query(
          `INSERT INTO public.notifications (user_id, title, message, link)
           VALUES ($1, $2, $3, $4)`,
          [
            enrollment.user_id,
            'Enrollment Under Review',
            richMessage,
            `/applications/${enrollmentId}`,
          ]
        );
      } catch (notifErr) {
        console.warn('[syncEnrollmentStatus] Notification failed (non-fatal):', notifErr.message);
      }
    } else if (targetStatus === 'pending' && previousStatus !== 'pending' && previousStatus !== 'rejected') {
      // Revert to pending because no documents have been reviewed
      await client.query(
        `UPDATE public.enrollments
         SET status = 'pending',
             updated_at = NOW()
         WHERE id = $1`,
        [enrollmentId]
      );
      newStatus = 'pending';

      // Record validation history
      if (adminId) {
        try {
          await client.query(
            `INSERT INTO public.validation_records (enrollment_id, validated_by, result, notes)
             VALUES ($1, $2, 'pending', 'No documents reviewed: application status set to Pending.')`,
            [enrollmentId, adminId]
          );
        } catch (vErr) {
          console.warn('[syncEnrollmentStatus] Validation record error (non-fatal):', vErr.message);
        }
      }
    }

    return {
      enrollmentId,
      previousStatus,
      newStatus,
      allRequiredApproved,
      requiredDocTypes,
      details,
    };
  } catch (err) {
    console.error('[syncEnrollmentStatus] Error:', err.message);
    throw err;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
}

module.exports = {
  syncEnrollmentStatus,
  REQUIRED_DOCS_BY_TYPE,
};
