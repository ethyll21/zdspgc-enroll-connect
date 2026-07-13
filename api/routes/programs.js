const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/programs ────────────────────────────────────────────────────────
// Public: list active programs
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, code, name, active, created_at
       FROM public.programs
       WHERE active = true
       ORDER BY code ASC`
    );
    res.json({ programs: rows });
  } catch (err) {
    console.error('[Programs/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch programs', details: err.message });
  }
});

// ─── GET /api/programs/all ────────────────────────────────────────────────────
// Admin: list all programs including inactive
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, code, name, active, created_at FROM public.programs ORDER BY code ASC`
    );
    res.json({ programs: rows });
  } catch (err) {
    console.error('[Programs/all]', err.message);
    res.status(500).json({ error: 'Failed to fetch programs', details: err.message });
  }
});

// ─── POST /api/programs ────────────────────────────────────────────────────────
// Admin: create a program
router.post('/', requireAdmin, async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO public.programs (code, name) VALUES ($1, $2)
       RETURNING *`,
      [code.toUpperCase(), name]
    );
    res.status(201).json({ program: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Program code already exists' });
    console.error('[Programs/create]', err.message);
    res.status(500).json({ error: 'Failed to create program', details: err.message });
  }
});

// ─── PATCH /api/programs/:id ───────────────────────────────────────────────────
// Admin: update a program
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE public.programs
       SET name = COALESCE($1, name),
           active = COALESCE($2, active)
       WHERE id = $3 RETURNING *`,
      [name, active, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Program not found' });
    res.json({ program: rows[0] });
  } catch (err) {
    console.error('[Programs/update]', err.message);
    res.status(500).json({ error: 'Failed to update program', details: err.message });
  }
});

module.exports = router;
