const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── Avatar upload setup ──────────────────────────────────────────────────────
const AVATAR_DIR = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ts = Date.now();
    cb(null, `avatar-${req.user.id}-${ts}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

// ─── GET /api/profiles/me ────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, full_name, contact_number, birthdate, gender, address, avatar_url, created_at, updated_at
       FROM public.profiles WHERE id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('[Profiles/me]', err.message);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

// ─── POST /api/profiles/me/avatar ───────────────────────────────────────────
router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const avatarUrl = `/api/profiles/avatar/${req.file.filename}`;
  try {
    // Delete the old avatar file to free disk space and prevent stale cache
    const existing = await db.query(
      'SELECT avatar_url FROM public.profiles WHERE id = $1',
      [req.user.id]
    );
    if (existing.rows.length > 0 && existing.rows[0].avatar_url) {
      const oldFilename = path.basename(existing.rows[0].avatar_url);
      const oldPath = path.join(AVATAR_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) {}
      }
    }

    const { rows } = await db.query(
      `UPDATE public.profiles SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [avatarUrl, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0], avatar_url: avatarUrl });
  } catch (err) {
    console.error('[Profiles/avatar]', err.message);
    res.status(500).json({ error: 'Failed to save avatar', details: err.message });
  }
});

// ─── GET /api/profiles/avatar/:filename (public serve) ───────────────────────
router.get('/avatar/:filename', (req, res) => {
  const filePath = path.join(AVATAR_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Avatar not found' });
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
});

// ─── PATCH /api/profiles/me ──────────────────────────────────────────────────
router.patch('/me', requireAuth, async (req, res) => {
  const { full_name, contact_number, birthdate, gender, address } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE public.profiles
       SET full_name = COALESCE($1, full_name),
           contact_number = COALESCE($2, contact_number),
           birthdate = COALESCE($3::date, birthdate),
           gender = COALESCE($4, gender),
           address = COALESCE($5, address),
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [full_name, contact_number, birthdate || null, gender, address, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('[Profiles/update]', err.message);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

// ─── GET /api/profiles (admin: list all) ────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const searchClause = search
      ? `AND (p.full_name ILIKE $3 OR p.email ILIKE $3)`
      : '';
    const params = search
      ? [parseInt(limit), offset, `%${search}%`]
      : [parseInt(limit), offset];

    const { rows } = await db.query(
      `SELECT p.id, p.email, p.full_name, p.contact_number, p.birthdate, p.gender,
              p.address, p.created_at, ur.role
       FROM public.profiles p
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE true ${searchClause}
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    const countRes = await db.query(
      `SELECT COUNT(*) FROM public.profiles p WHERE true ${search ? `AND (p.full_name ILIKE $1 OR p.email ILIKE $1)` : ''}`,
      search ? [`%${search}%`] : []
    );
    res.json({ profiles: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('[Profiles/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch profiles', details: err.message });
  }
});

// ─── GET /api/profiles/:id (admin) ──────────────────────────────────────────
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, ur.role FROM public.profiles p
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('[Profiles/get]', err.message);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

module.exports = router;
