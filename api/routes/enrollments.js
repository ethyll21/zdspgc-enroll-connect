const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/enrollments/my ──────────────────────────────────────────────────
// Student: get own enrollments
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, s.student_no, s.first_name, s.last_name, s.program_id,
              p.code AS program_code, p.name AS program_name
       FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       LEFT JOIN public.programs p ON p.id = s.program_id
       WHERE s.user_id = $1
       ORDER BY e.submitted_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments: rows });
  } catch (err) {
    console.error('[Enrollments/my]', err.message);
    res.status(500).json({ error: 'Failed to fetch enrollments', details: err.message });
  }
});

// ─── POST /api/enrollments ────────────────────────────────────────────────────
// Student: submit enrollment
router.post('/', requireAuth, async (req, res) => {
  const {
    school_year,
    semester,
    student_type = 'new',
    date_enrolled,
    subjects = [],
    total_units = 0,
    advised_by = 'CHRISTINA B. ADOLFO (DSA)',
    approved_by = 'JEFFRYL DAVE S. ALBELLAR (Registrar)',
    rotc_watc = {},
  } = req.body;

  if (!school_year || !semester) {
    return res.status(400).json({ error: 'school_year and semester are required' });
  }
  try {
    // Get student record
    const studentRes = await db.query(
      'SELECT id FROM public.students WHERE user_id = $1', [req.user.id]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student record not found. Please complete your profile first.' });
    }
    const student_id = studentRes.rows[0].id;

    // Check for existing active enrollment for same period
    const dupCheck = await db.query(
      `SELECT id FROM public.enrollments
       WHERE student_id = $1 AND school_year = $2 AND semester = $3
         AND status NOT IN ('rejected')`,
      [student_id, school_year, semester]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'You already have an active enrollment for this period' });
    }

    const { rows } = await db.query(
      `INSERT INTO public.enrollments 
         (student_id, school_year, semester, status, student_type, date_enrolled, subjects, total_units, advised_by, approved_by, rotc_watc)
       VALUES ($1, $2, $3, 'pending', $4, COALESCE($5::date, CURRENT_DATE), $6::jsonb, $7, $8, $9, $10::jsonb)
       RETURNING *`,
      [
        student_id,
        school_year,
        semester,
        student_type,
        date_enrolled || null,
        JSON.stringify(subjects || []),
        Number(total_units) || 0,
        advised_by || 'CHRISTINA B. ADOLFO (DSA)',
        approved_by || 'JEFFRYL DAVE S. ALBELLAR (Registrar)',
        JSON.stringify(rotc_watc || {})
      ]
    );
    res.status(201).json({ enrollment: rows[0] });
  } catch (err) {
    console.error('[Enrollments/create]', err.message);
    res.status(500).json({ error: 'Failed to submit enrollment', details: err.message });
  }
});

// ─── GET /api/enrollments (admin: list all) ───────────────────────────────────
router.get('/', async (req, res) => {
  const { status, school_year, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    }
    if (school_year) {
      params.push(school_year);
      conditions.push(`e.school_year = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(parseInt(limit), offset);
    const { rows } = await db.query(
      `SELECT e.*, s.student_no, s.first_name, s.last_name, s.email AS student_email,
              p.code AS program_code, p.name AS program_name,
              pr.avatar_url
       FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       LEFT JOIN public.programs p ON p.id = s.program_id
       LEFT JOIN public.profiles pr ON pr.id = s.user_id
       ${where}
       ORDER BY e.submitted_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countRes = await db.query(
      `SELECT COUNT(*) FROM public.enrollments e ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({ enrollments: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('[Enrollments/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch enrollments', details: err.message });
  }
});

// ─── GET /api/enrollments/stats/overview (admin) ─────────────────────────────
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'under_review') AS under_review,
         COUNT(*) FILTER (WHERE status = 'approved') AS approved,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
         COUNT(*) AS total
       FROM public.enrollments`
    );
    const studentCount = await db.query('SELECT COUNT(*) FROM public.students');
    res.json({
      stats: {
        pending: parseInt(rows[0].pending) || 0,
        under_review: parseInt(rows[0].under_review) || 0,
        approved: parseInt(rows[0].approved) || 0,
        rejected: parseInt(rows[0].rejected) || 0,
        total: parseInt(rows[0].total) || 0,
        total_students: parseInt(studentCount.rows[0].count) || 0,
      }
    });
  } catch (err) {
    console.error('[Enrollments/stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// ─── GET /api/enrollments/:id ─────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, 
              s.student_no, s.first_name, s.last_name, s.middle_name, s.suffix,
              s.user_id, s.gender, s.date_of_birth, s.place_of_birth,
              s.civil_status, s.religion, s.citizenship, s.address, s.postal_code,
              s.contact_number, s.email AS student_email,
              s.family_background, s.educational_background,
              p.code AS program_code, p.name AS program_name
       FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       LEFT JOIN public.programs p ON p.id = s.program_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Enrollment not found' });

    const enrollment = rows[0];
    // Students can only see their own
    if (req.user.role !== 'admin' && enrollment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ enrollment });
  } catch (err) {
    console.error('[Enrollments/get]', err.message);
    res.status(500).json({ error: 'Failed to fetch enrollment', details: err.message });
  }
});

// ─── PATCH /api/enrollments/:id/review (admin) ───────────────────────────────
router.patch('/:id/review', requireAdmin, async (req, res) => {
  const { status, remarks } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE public.enrollments
       SET status = $1, remarks = $2, reviewed_at = NOW(), reviewed_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, remarks || null, req.user.id, req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Log validation record
    await client.query(
      `INSERT INTO public.validation_records (enrollment_id, validated_by, result, notes)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, req.user.id, status, remarks || null]
    );

    // Notify the student
    const studentRes = await client.query(
      `SELECT s.user_id FROM public.students s
       JOIN public.enrollments e ON e.student_id = s.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (studentRes.rows.length > 0) {
      const statusLabels = {
        approved: 'Approved ✓',
        rejected: 'Rejected',
        under_review: 'Under Review',
        pending: 'Pending'
      };
      await client.query(
        `INSERT INTO public.notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [
          studentRes.rows[0].user_id,
          `Enrollment ${statusLabels[status]}`,
          remarks || `Your enrollment for ${rows[0].school_year} ${rows[0].semester} has been ${status}.`
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ enrollment: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Enrollments/review]', err.message);
    res.status(500).json({ error: 'Failed to update enrollment', details: err.message });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/enrollments/:id (admin) ──────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Delete validation records first (foreign key constraint)
    await client.query(
      `DELETE FROM public.validation_records WHERE enrollment_id = $1`,
      [req.params.id]
    );

    // Delete the enrollment
    const { rowCount } = await client.query(
      `DELETE FROM public.enrollments WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Enrollment deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Enrollments/delete]', err.message);
    res.status(500).json({ error: 'Failed to delete enrollment', details: err.message });
  } finally {
    client.release();
  }
});

// ─── GET /api/enrollments/:id/history ─────────────────────────────────────────
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    // Check access rights
    const enrollRes = await db.query(
      `SELECT s.user_id FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       WHERE e.id = $1`, [req.params.id]
    );
    if (enrollRes.rows.length === 0) return res.status(404).json({ error: 'Enrollment not found' });
    if (req.user.role !== 'admin' && enrollRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await db.query(
      `SELECT v.*, p.full_name AS validated_by_name
       FROM public.validation_records v
       LEFT JOIN public.profiles p ON p.id = v.validated_by
       WHERE v.enrollment_id = $1
       ORDER BY v.created_at DESC`,
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error('[Enrollments/history]', err.message);
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
});

module.exports = router;
