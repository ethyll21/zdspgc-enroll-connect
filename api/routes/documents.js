const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── File upload setup ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_DIR, req.user.id);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only PDF, JPG, and PNG files are allowed'));
    }
    cb(null, true);
  },
});

// ─── GET /api/documents/my ────────────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.* FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       WHERE s.user_id = $1
       ORDER BY d.uploaded_at DESC`,
      [req.user.id]
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[Documents/my]', err.message);
    res.status(500).json({ error: 'Failed to fetch documents', details: err.message });
  }
});

// ─── POST /api/documents/upload ───────────────────────────────────────────────
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { doc_type } = req.body;
  const validDocTypes = ['registration_form', 'psa_birth_certificate', 'form_138', 'good_moral', 'transfer_certificate', 'other'];
  if (!doc_type || !validDocTypes.includes(doc_type)) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: `doc_type must be one of: ${validDocTypes.join(', ')}` });
  }

  try {
    const studentRes = await db.query(
      'SELECT id FROM public.students WHERE user_id = $1', [req.user.id]
    );
    if (studentRes.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Student record not found' });
    }
    const student_id = studentRes.rows[0].id;

    const relativePath = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');

    const { rows } = await db.query(
      `INSERT INTO public.documents
         (student_id, doc_type, file_path, file_name, mime_type, size_bytes, status)
       VALUES ($1, $2::document_type, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [student_id, doc_type, relativePath, req.file.originalname, req.file.mimetype, req.file.size]
    );
    res.status(201).json({ document: rows[0] });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Documents/upload]', err.message);
    res.status(500).json({ error: 'Failed to save document', details: err.message });
  }
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const docRes = await db.query(
      `SELECT d.*, s.user_id FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (docRes.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const doc = docRes.rows[0];
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && doc.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOAD_DIR, doc.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.query('DELETE FROM public.documents WHERE id = $1', [req.params.id]);

    // Notify the student if admin deletes their document
    if (isAdmin && doc.user_id !== req.user.id) {
      const docTypeLabels = {
        registration_form: 'Registration Form',
        psa_birth_certificate: 'PSA Birth Certificate',
        form_138: 'Form 138',
        good_moral: 'Good Moral Certificate',
        transfer_certificate: 'Transfer Certificate',
        other: 'Document'
      };
      const docLabel = docTypeLabels[doc.doc_type] || 'Document';
      const title = `${docLabel} Deleted`;
      const message = `Your ${docLabel} (${doc.file_name}) has been deleted by the admin.`;
      
      await db.query(
        `INSERT INTO public.notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [doc.user_id, title, message]
      );
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('[Documents/delete]', err.message);
    res.status(500).json({ error: 'Failed to delete document', details: err.message });
  }
});

// ─── PATCH /api/documents/:id/review (admin) ─────────────────────────────────
router.patch('/:id/review', requireAdmin, async (req, res) => {
  const { status, remarks } = req.body;
  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE public.documents
       SET status = $1::document_status, remarks = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4 RETURNING *`,
      [status, remarks || null, req.user.id, req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = rows[0];

    // Notify the student about the document review
    const studentRes = await client.query(
      `SELECT s.user_id FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (studentRes.rows.length > 0) {
      const docTypeLabels = {
        registration_form: 'Registration Form',
        psa_birth_certificate: 'PSA Birth Certificate',
        form_138: 'Form 138',
        good_moral: 'Good Moral Certificate',
        transfer_certificate: 'Transfer Certificate',
        other: 'Document'
      };
      const statusLabels = {
        approved: 'Approved ✓',
        rejected: 'Rejected ✗',
        pending: 'Pending'
      };
      const docLabel = docTypeLabels[doc.doc_type] || 'Document';
      const statusLabel = statusLabels[status] || status;
      const title = `${docLabel} ${statusLabel}`;
      const message = remarks
        ? `Your ${docLabel} has been ${status}. Remark: ${remarks}`
        : `Your ${docLabel} has been ${status} by the admin.`;

      await client.query(
        `INSERT INTO public.notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [studentRes.rows[0].user_id, title, message]
      );
    }

    await client.query('COMMIT');
    res.json({ document: doc });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Documents/review]', err.message);
    res.status(500).json({ error: 'Failed to review document', details: err.message });
  } finally {
    client.release();
  }
});

// ─── GET /api/documents (admin: all documents) ───────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { status, student_id } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
    if (student_id) { params.push(student_id); conditions.push(`d.student_id = $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT d.*, s.student_no, s.first_name, s.last_name
       FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       ${where}
       ORDER BY d.uploaded_at DESC`,
      params
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[Documents/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch documents', details: err.message });
  }
});

// ─── GET /api/documents/file/:id (serve file) ────────────────────────────────
router.get('/file/:id', requireAuth, async (req, res) => {
  console.log('[Documents/serve] Request for file id:', req.params.id, 'User:', req.user.id);
  try {
    const docRes = await db.query(
      `SELECT d.*, s.user_id FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (docRes.rows.length === 0) {
      console.log('[Documents/serve] Document not found in DB');
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docRes.rows[0];
    if (req.user.role !== 'admin' && doc.user_id !== req.user.id) {
      console.log('[Documents/serve] Access denied. user_id:', doc.user_id, 'req.user.id:', req.user.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('[Documents/serve]', err.message);
    res.status(500).json({ error: 'Failed to serve document', details: err.message });
  }
});

module.exports = router;
