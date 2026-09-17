const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/students/me ─────────────────────────────────────────────────────
// Get the current user's student record
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, p.code AS program_code, p.name AS program_name
       FROM public.students s
       LEFT JOIN public.programs p ON p.id = s.program_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Student record not found' });
    res.json({ student: rows[0] });
  } catch (err) {
    console.error('[Students/me]', err.message);
    res.status(500).json({ error: 'Failed to fetch student', details: err.message });
  }
});

// ─── POST /api/students ───────────────────────────────────────────────────────
// Create student record (called after first enrollment application)
router.post('/', requireAuth, async (req, res) => {
  const {
    first_name, middle_name, last_name, gender,
    date_of_birth, address, contact_number, email,
    program_id, year_level, previous_school,
    student_no,
    // New enrollment form fields
    suffix, place_of_birth, civil_status, religion,
    citizenship, postal_code, major,
    family_background, educational_background, pledge_accepted
  } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO public.students
         (user_id, first_name, middle_name, last_name, gender, date_of_birth,
          address, contact_number, email, program_id, year_level, previous_school,
          suffix, place_of_birth, civil_status, religion, citizenship,
          postal_code, major, family_background, educational_background, pledge_accepted, student_no)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,
               $13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22,$23)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         middle_name = EXCLUDED.middle_name,
         last_name = EXCLUDED.last_name,
         gender = EXCLUDED.gender,
         date_of_birth = EXCLUDED.date_of_birth,
         address = EXCLUDED.address,
         contact_number = EXCLUDED.contact_number,
         email = EXCLUDED.email,
         program_id = EXCLUDED.program_id,
         year_level = EXCLUDED.year_level,
         previous_school = EXCLUDED.previous_school,
         suffix = EXCLUDED.suffix,
         place_of_birth = EXCLUDED.place_of_birth,
         civil_status = EXCLUDED.civil_status,
         religion = EXCLUDED.religion,
         citizenship = EXCLUDED.citizenship,
         postal_code = EXCLUDED.postal_code,
         major = EXCLUDED.major,
         family_background = EXCLUDED.family_background,
         educational_background = EXCLUDED.educational_background,
         pledge_accepted = EXCLUDED.pledge_accepted,
         student_no = EXCLUDED.student_no,
         updated_at = NOW()
       RETURNING *`,
      [
        req.user.id, first_name, middle_name || null, last_name,
        gender || null, date_of_birth || null, address || null,
        contact_number || null, email || req.user.email,
        program_id || null, year_level || null, previous_school || null,
        suffix || null, place_of_birth || null, civil_status || null,
        religion || null, citizenship || 'Filipino',
        postal_code || null, major || null,
        JSON.stringify(family_background || {}),
        JSON.stringify(educational_background || {}),
        pledge_accepted || false,
        student_no || null
      ]
    );
    res.status(201).json({ student: rows[0] });
  } catch (err) {
    console.error('[Students/create]', err.message);
    res.status(500).json({ error: 'Failed to create student record', details: err.message });
  }
});

// ─── PATCH /api/students/me ────────────────────────────────────────────────────
router.patch('/me', requireAuth, async (req, res) => {
  const {
    first_name, middle_name, last_name, gender,
    date_of_birth, address, contact_number, email,
    program_id, year_level, previous_school,
    student_no,
    // New enrollment form fields
    suffix, place_of_birth, civil_status, religion,
    citizenship, postal_code, major,
    family_background, educational_background, pledge_accepted
  } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE public.students SET
         first_name = COALESCE($1, first_name),
         middle_name = COALESCE($2, middle_name),
         last_name = COALESCE($3, last_name),
         gender = COALESCE($4, gender),
         date_of_birth = COALESCE($5::date, date_of_birth),
         address = COALESCE($6, address),
         contact_number = COALESCE($7, contact_number),
         email = COALESCE($8, email),
         program_id = COALESCE($9::uuid, program_id),
         year_level = COALESCE($10, year_level),
         previous_school = COALESCE($11, previous_school),
         suffix = COALESCE($13, suffix),
         place_of_birth = COALESCE($14, place_of_birth),
         civil_status = COALESCE($15, civil_status),
         religion = COALESCE($16, religion),
         citizenship = COALESCE($17, citizenship),
         postal_code = COALESCE($18, postal_code),
         major = COALESCE($19, major),
         family_background = COALESCE($20::jsonb, family_background),
         educational_background = COALESCE($21::jsonb, educational_background),
         pledge_accepted = COALESCE($22, pledge_accepted),
         student_no = COALESCE($23, student_no),
         updated_at = NOW()
       WHERE user_id = $12 RETURNING *`,
      [
        first_name, middle_name, last_name, gender,
        date_of_birth || null, address, contact_number, email,
        program_id || null, year_level, previous_school, req.user.id,
        suffix || null, place_of_birth || null, civil_status || null,
        religion || null, citizenship || null,
        postal_code || null, major || null,
        family_background ? JSON.stringify(family_background) : null,
        educational_background ? JSON.stringify(educational_background) : null,
        pledge_accepted != null ? pledge_accepted : null,
        student_no || null
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Student record not found' });
    res.json({ student: rows[0] });
  } catch (err) {
    console.error('[Students/update]', err.message);
    res.status(500).json({ error: 'Failed to update student', details: err.message });
  }
});

// ─── GET /api/students (admin) ────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { search, program_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const conditions = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.student_no ILIKE $${params.length} OR s.email ILIKE $${params.length})`);
    }
    if (program_id) {
      params.push(program_id);
      conditions.push(`s.program_id = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(parseInt(limit), offset);
    const { rows } = await db.query(
      `SELECT s.*, p.code AS program_code, p.name AS program_name
       FROM public.students s
       LEFT JOIN public.programs p ON p.id = s.program_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countRes = await db.query(
      `SELECT COUNT(*) FROM public.students s ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({ students: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('[Students/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch students', details: err.message });
  }
});

// ─── GET /api/students/:id ───────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, p.code AS program_code, p.name AS program_name
       FROM public.students s
       LEFT JOIN public.programs p ON p.id = s.program_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    
    const student = rows[0];
    
    // Authorization check: Admin can access any profile, students can only access their own
    if (req.user.role !== 'admin' && student.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ student });
  } catch (err) {
    console.error('[Students/get]', err.message);
    res.status(500).json({ error: 'Failed to fetch student', details: err.message });
  }
});

module.exports = router;
