const express = require('express');
const multer  = require('multer');
const path    = require('path');
const db      = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadFile, deleteFile, downloadFile, DOCS_BUCKET } = require('../storage');

const router = express.Router();

// ─── Multer — memory storage (no local disk) ──────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
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
  const { enrollment_id } = req.query;
  try {
    const conditions = ['s.user_id = $1'];
    const params = [req.user.id];

    if (enrollment_id) {
      params.push(enrollment_id);
      conditions.push(`d.enrollment_id = $${params.length}`);
    }

    const { rows } = await db.query(
      `SELECT d.*, d.created_at as uploaded_at FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC`,
      params
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[Documents/my]', err.message);
    res.status(500).json({ error: 'Failed to fetch documents', details: err.message });
  }
});

// ─── POST /api/documents/upload ───────────────────────────────────────────────
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  // ── DIAGNOSTIC LOGGING — remove once issue is resolved ──
  console.log('[Documents/upload] req.body:', JSON.stringify(req.body));
  console.log('[Documents/upload] file present:', !!req.file, 'size:', req.file?.size);
  console.log('[Documents/upload] enrollment_id from body:', req.body.enrollment_id);
  // ────────────────────────────────────────────────────────

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { doc_type } = req.body;
  const validDocTypes = [
    'birth_certificate', 'form_138', 'good_moral', 'transfer_certificate',
    'registration_form', 'other',
  ];
  if (!doc_type || !validDocTypes.includes(doc_type)) {
    return res.status(400).json({ error: `doc_type must be one of: ${validDocTypes.join(', ')}` });
  }

  try {
    const studentRes = await db.query(
      'SELECT id FROM public.students WHERE user_id = $1', [req.user.id]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student record not found' });
    }
    const student_id = studentRes.rows[0].id;
    // Trim whitespace just in case, treat empty string as null
    const raw_enrollment_id = req.body.enrollment_id;
    const enrollment_id = (raw_enrollment_id && raw_enrollment_id.trim()) ? raw_enrollment_id.trim() : null;

    if (!enrollment_id) {
      console.error('[Documents/upload] ERROR: enrollment_id is null or missing from req.body');
      return res.status(400).json({ error: 'enrollment_id is required to upload a document.' });
    }

    console.log('[Documents/upload] Saving doc: student_id=%s enrollment_id=%s doc_type=%s', student_id, enrollment_id, doc_type);

    // Build Supabase storage path: userId/timestamp-random.ext
    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const storagePath = `${req.user.id}/${safeName}`;

    // Upload buffer to Supabase Storage
    const publicUrl = await uploadFile(
      DOCS_BUCKET,
      storagePath,
      req.file.buffer,
      req.file.mimetype
    );

    const { rows } = await db.query(
      `INSERT INTO public.documents
         (student_id, enrollment_id, doc_type, file_path, file_name, mime_type, size_bytes, status)
       VALUES ($1, $2, $3::document_type, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [student_id, enrollment_id, doc_type, storagePath, req.file.originalname, req.file.mimetype, req.file.size]
    );

    console.log('[Documents/upload] Saved doc id=%s enrollment_id=%s', rows[0].id, rows[0].enrollment_id);

    // file_url is the Supabase public URL — attach it for the response
    res.status(201).json({ document: { ...rows[0], file_url: publicUrl } });
  } catch (err) {
    console.error('[Documents/upload] ERROR:', err.message, err.stack);
    res.status(500).json({ 
      error: err.message || 'Failed to save document', 
      details: err.stack 
    });
  }
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const docRes = await db.query(
      `SELECT d.*, d.created_at as uploaded_at, s.user_id FROM public.documents d
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

    // Delete from Supabase Storage (non-blocking, best-effort)
    await deleteFile(DOCS_BUCKET, doc.file_path);

    await db.query('DELETE FROM public.documents WHERE id = $1', [req.params.id]);

    // Notify the student if admin deletes their document (non-blocking)
    if (isAdmin && doc.user_id !== req.user.id) {
      const docTypeLabels = {
        registration_form: 'Registration Form',
        birth_certificate: 'PSA Birth Certificate',
        form_138: 'Form 138',
        good_moral: 'Good Moral Certificate',
        transfer_certificate: 'Transfer Certificate',
        other: 'Document'
      };
      const docLabel = docTypeLabels[doc.doc_type] || 'Document';
      const title = `${docLabel} Deleted`;
      const message = `Your ${docLabel} (${doc.file_name}) has been deleted by the admin.`;

      try {
        await db.query(
          `INSERT INTO public.notifications (user_id, title, message, link)
           VALUES ($1, $2, $3, $4)`,
          [doc.user_id, title, message, doc.enrollment_id ? `/applications/${doc.enrollment_id}` : null]
        );
      } catch (notifErr) {
        console.warn('[Documents/delete] Notification failed (non-fatal):', notifErr.message);
      }
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
        birth_certificate: 'PSA Birth Certificate',
        form_138: 'Form 138',
        good_moral: 'Good Moral Certificate',
        transfer_certificate: 'Transfer Certificate',
        other: 'Document'
      };
      const docLabel = docTypeLabels[doc.doc_type] || 'Document';
      const title = status === 'approved' ? `${docLabel} Approved` : status === 'rejected' ? `${docLabel} Rejected` : `${docLabel} Updated`;

      const richMessage = JSON.stringify({
        isRichCard: true,
        type: status === 'approved' ? 'doc_approved' : status === 'rejected' ? 'doc_rejected' : 'doc_pending',
        docLabel,
        date: new Date().toISOString(),
        remarks: remarks || '',
        fallbackMessage: remarks
          ? `Your ${docLabel} has been ${status}. Remark: ${remarks}`
          : `Your ${docLabel} has been ${status} by the admin.`
      });

      try {
        await client.query(
          `INSERT INTO public.notifications (user_id, title, message, link)
           VALUES ($1, $2, $3, $4)`,
          [studentRes.rows[0].user_id, title, richMessage, doc.enrollment_id ? `/applications/${doc.enrollment_id}` : null]
        );
      } catch (notifErr) {
        console.warn('[Documents/review] Notification failed (non-fatal):', notifErr.message);
      }
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
  const { status, student_id, enrollment_id } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (status)        { params.push(status);        conditions.push(`d.status = $${params.length}`); }
    if (student_id)    { params.push(student_id);    conditions.push(`d.student_id = $${params.length}`); }
    if (enrollment_id) { params.push(enrollment_id); conditions.push(`d.enrollment_id = $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT d.*, d.created_at as uploaded_at, s.student_no, s.first_name, s.last_name
       FROM public.documents d
       JOIN public.students s ON s.id = d.student_id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[Documents/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch documents', details: err.message });
  }
});

// ─── GET /api/documents/file/:id (proxy-serve from Supabase Storage) ─────────
// We proxy through the API so auth is enforced — students can't access each other's files.
router.get('/file/:id', requireAuth, async (req, res) => {
  console.log('[Documents/serve] Request for file id:', req.params.id, 'User:', req.user.id);
  try {
    const docRes = await db.query(
      `SELECT d.*, d.created_at as uploaded_at, s.user_id FROM public.documents d
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
      console.log('[Documents/serve] Access denied');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Download from Supabase Storage and stream to client
    const { data, error } = await downloadFile(DOCS_BUCKET, doc.file_path);
    if (error || !data) {
      return res.status(404).json({ error: 'File not found in storage' });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Documents/serve]', err.message);
    res.status(500).json({ error: 'Failed to serve document', details: err.message });
  }
});

module.exports = router;
