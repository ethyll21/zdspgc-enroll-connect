const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/notifications/my ────────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, message, read AS is_read, created_at, link
       FROM public.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    console.error('[Notifications/my]', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE public.notifications SET read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, message, true AS is_read, created_at, link`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (err) {
    console.error('[Notifications/read]', err.message);
    res.status(500).json({ error: 'Failed to mark as read', details: err.message });
  }
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await db.query(
      `UPDATE public.notifications SET read = true WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[Notifications/read-all]', err.message);
    res.status(500).json({ error: 'Failed to mark all as read', details: err.message });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM public.notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('[Notifications/delete]', err.message);
    res.status(500).json({ error: 'Failed to delete notification', details: err.message });
  }
});

module.exports = router;
