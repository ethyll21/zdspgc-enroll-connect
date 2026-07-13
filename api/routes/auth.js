const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

// ─── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check existing user
    const exists = await client.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (exists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    // Insert into auth.users (triggers handle_new_user → creates profile + student role)
    await client.query(
      `INSERT INTO auth.users (id, email, password_hash, raw_user_meta_data, is_active, email_verified, created_at)
       VALUES ($1, $2, $3, $4::jsonb, true, true, NOW())`,
      [userId, email.toLowerCase(), password_hash, JSON.stringify({ full_name: full_name || '' })]
    );

    // Fetch the created profile
    const profileRes = await client.query(
      'SELECT id, email, full_name FROM public.profiles WHERE id = $1',
      [userId]
    );
    const roleRes = await client.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    const role = roleRes.rows.some(r => r.role === 'admin') ? 'admin' : (roleRes.rows[0]?.role || 'student');
    const token = signToken({ id: userId, email: email.toLowerCase(), role });

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        full_name: full_name || '',
        role,
        profile: profileRes.rows[0] || null,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Auth/register]', err.message);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRes = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.is_active, u.raw_user_meta_data
       FROM auth.users u WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled. Contact the registrar.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get role
    const roleRes = await db.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [user.id]
    );
    const role = roleRes.rows.some(r => r.role === 'admin') ? 'admin' : (roleRes.rows[0]?.role || 'student');

    // Get profile
    const profileRes = await db.query(
      'SELECT id, email, full_name, contact_number, birthdate, gender, address, avatar_url FROM public.profiles WHERE id = $1',
      [user.id]
    );

    const token = signToken({ id: user.id, email: user.email, role });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role,
        full_name: profileRes.rows[0]?.full_name || user.raw_user_meta_data?.full_name || '',
        profile: profileRes.rows[0] || null,
      },
    });
  } catch (err) {
    console.error('[Auth/login]', err.message);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const profileRes = await db.query(
      `SELECT p.id, p.email, p.full_name, p.contact_number, p.birthdate, p.gender, p.address, p.avatar_url,
              p.created_at, p.updated_at
       FROM public.profiles p WHERE p.id = $1`,
      [req.user.id]
    );
    const roleRes = await db.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      user: {
        ...profileRes.rows[0],
        role: roleRes.rows.some(r => r.role === 'admin') ? 'admin' : (roleRes.rows[0]?.role || 'student'),
        roles: roleRes.rows.map(r => r.role),
      },
    });
  } catch (err) {
    console.error('[Auth/me]', err.message);
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

// ─── POST /api/auth/change-password ─────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  try {
    const userRes = await db.query('SELECT password_hash FROM auth.users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(current_password, userRes.rows[0].password_hash || '');
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const new_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await db.query('UPDATE auth.users SET password_hash = $1 WHERE id = $2', [new_hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Auth/change-password]', err.message);
    res.status(500).json({ error: 'Failed to change password', details: err.message });
  }
});

module.exports = router;
