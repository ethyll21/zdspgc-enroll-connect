const express = require('express');
const multer  = require('multer');
const path    = require('path');
const db      = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadFile, deleteFile, AVATAR_BUCKET } = require('../storage');

const router = express.Router();

// ─── Multer — memory storage (no local disk) ──────────────────────────────────
const avatarUpload = multer({
  storage: multer.memoryStorage(),
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
  try {
    // Delete old avatar from Supabase Storage (best-effort)
    const existing = await db.query(
      'SELECT avatar_url FROM public.profiles WHERE id = $1',
      [req.user.id]
    );
    if (existing.rows.length > 0 && existing.rows[0].avatar_url) {
      const oldUrl = existing.rows[0].avatar_url;
      // Extract storage path from URL: .../<bucket>/<path>
      const bucketMarker = `/${AVATAR_BUCKET}/`;
      const idx = oldUrl.indexOf(bucketMarker);
      if (idx !== -1) {
        const oldPath = oldUrl.slice(idx + bucketMarker.length);
        await deleteFile(AVATAR_BUCKET, oldPath);
      }
    }

    // Upload new avatar to Supabase Storage
    const ext = path.extname(req.file.originalname).toLowerCase();
    const storagePath = `${req.user.id}/avatar-${Date.now()}${ext}`;
    const publicUrl = await uploadFile(
      AVATAR_BUCKET,
      storagePath,
      req.file.buffer,
      req.file.mimetype
    );

    const { rows } = await db.query(
      `UPDATE public.profiles SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [publicUrl, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0], avatar_url: publicUrl });
  } catch (err) {
    console.error('[Profiles/avatar]', err.message);
    res.status(500).json({ error: 'Failed to save avatar', details: err.message });
  }
});

// ─── NOTE: /api/profiles/avatar/:filename is no longer needed.
// Avatar URLs are now permanent Supabase Storage public URLs stored in the DB.
// The old local-serve route has been removed as part of the Supabase Storage migration.


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
