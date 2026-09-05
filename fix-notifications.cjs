const db = require('./api/db');

async function fixNotifications() {
  // Find recently reviewed documents that have no notification yet
  const docsRes = await db.query(`
    SELECT d.id, d.doc_type, d.status, d.remarks, d.reviewed_at, s.user_id
    FROM public.documents d
    JOIN public.students s ON s.id = d.student_id
    WHERE d.reviewed_at IS NOT NULL
      AND d.status IN ('approved', 'rejected')
    ORDER BY d.reviewed_at DESC
    LIMIT 20
  `);

  console.log('Recently reviewed documents:', JSON.stringify(docsRes.rows, null, 2));

  const docTypeLabels = {
    registration_form: 'Registration Form',
    psa_birth_certificate: 'PSA Birth Certificate',
    form_138: 'Form 138',
    good_moral: 'Good Moral Certificate',
    transfer_certificate: 'Transfer Certificate',
    other: 'Document'
  };
  const statusLabels = { approved: 'Approved ✓', rejected: 'Rejected ✗' };

  for (const doc of docsRes.rows) {
    // Check if notification already exists for this doc action
    const existingRes = await db.query(
      `SELECT id FROM public.notifications
       WHERE user_id = $1 AND created_at >= $2 AND title LIKE $3`,
      [doc.user_id, doc.reviewed_at, `%${docTypeLabels[doc.doc_type] || 'Document'}%`]
    );

    if (existingRes.rows.length === 0) {
      const docLabel = docTypeLabels[doc.doc_type] || 'Document';
      const title = `${docLabel} ${statusLabels[doc.status] || doc.status}`;
      const message = doc.remarks
        ? `Your ${docLabel} has been ${doc.status}. Remark: ${doc.remarks}`
        : `Your ${docLabel} has been ${doc.status} by the admin.`;

      await db.query(
        `INSERT INTO public.notifications (user_id, title, message) VALUES ($1, $2, $3)`,
        [doc.user_id, title, message]
      );
      console.log(`✓ Inserted notification for user ${doc.user_id}: "${title}"`);
    } else {
      console.log(`- Notification already exists for doc ${doc.id}, skipping.`);
    }
  }

  console.log('Done!');
  process.exit(0);
}

fixNotifications().catch(e => { console.error(e.message); process.exit(1); });
