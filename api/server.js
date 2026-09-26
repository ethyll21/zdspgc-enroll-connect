'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs    = require('fs');
const { runMigrations } = require('./migrate');
const { uploadFile, downloadFile, DOCS_BUCKET } = require('./storage');

// ── Route imports ──────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const programsRoutes     = require('./routes/programs');
const profilesRoutes     = require('./routes/profiles');
const studentsRoutes     = require('./routes/students');
const enrollmentsRoutes  = require('./routes/enrollments');
const documentsRoutes    = require('./routes/documents');
const notificationsRoutes = require('./routes/notifications');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Prevent silent crashes ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
  // Don't exit — let the server keep running
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static uploads ─────────────────────────────────────────────────────────────
// Note: served via /api/documents/file/:id which enforces auth
// Raw files should NOT be publicly accessible
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Serve built frontend (production / Render) ─────────────────────────────────
const CLIENT_DIST = path.join(__dirname, '../dist/client');
const INDEX_HTML  = path.join(CLIENT_DIST, 'index.html');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false }));
}

// ── Health check ───────────────────────────────────────────────────────────────
// Always return HTTP 200 so Render's load balancer never marks this service
// as unhealthy due to a slow/transient DB connection. DB status is reported
// as a field so monitoring tools can still detect DB issues without causing 503s.
app.get('/api/health', async (req, res) => {
  let db_status = 'unknown';
  let db_name = null;
  let server_time = null;
  try {
    const db = require('./db');
    const result = await Promise.race([
      db.query('SELECT NOW() AS server_time, current_database() AS db_name'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB ping timeout')), 5000)),
    ]);
    db_status = 'ok';
    db_name = result.rows[0].db_name;
    server_time = result.rows[0].server_time;
  } catch (err) {
    db_status = `error: ${err.message}`;
    console.warn('[Health] DB ping failed (non-fatal):', err.message);
  }
  // Always 200 — Render must not cut off traffic due to a DB hiccup
  res.json({
    status: 'ok',
    db_status,
    database: db_name,
    server_time,
    api_version: '1.0.0',
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/programs',      programsRoutes);
app.use('/api/profiles',      profilesRoutes);
app.use('/api/students',      studentsRoutes);
app.use('/api/enrollments',   enrollmentsRoutes);
app.use('/api/documents',     documentsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ── SSR fallback — serve TanStack Start app for any non-API route ────────────
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  
  try {
    const serverPath = path.join(__dirname, '../dist/server/server.js');
    if (fs.existsSync(serverPath)) {
      const { default: frontendHandler } = require(serverPath);
      
      const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
      
      // Node 18+ global Request
      const fetchReq = new Request(url, {
        method: req.method,
        // Convert headers to a standard Headers object
        headers: new Headers(req.headers),
        // For GET/HEAD, body must be null
        body: ['GET', 'HEAD'].includes(req.method) ? null : req.body ? JSON.stringify(req.body) : null,
      });
      
      const fetchRes = await frontendHandler.fetch(fetchReq, process.env, { request: req, response: res });
      
      fetchRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.status(fetchRes.status);
      
      if (fetchRes.body) {
        const arrayBuffer = await fetchRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      } else {
        return res.end();
      }
    } else if (fs.existsSync(INDEX_HTML)) {
      return res.sendFile(INDEX_HTML);
    }
  } catch (err) {
    console.error('[SSR Error]', err);
  }
  
  next();
});

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Start ──────────────────────────────────────────────────────────────────────
function startServer() {
  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║   ZDSPGC Local API Server                  ║`);
    console.log(`║   Database : PRE-ENROLLMENT_DB             ║`);
    console.log(`║   Port     : ${PORT}                           ║`);
    console.log(`║   Health   : http://localhost:${PORT}/api/health ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
  });
}

// Try migrations with a timeout; always start the server regardless
async function safeRunMigrations() {
  try {
    await Promise.race([
      runMigrations(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Migration timeout after 30s')), 30000))
    ]);
  } catch (err) {
    console.error('[Startup] Migration error, starting server anyway:', err.message);
  }
  startServer();
}

safeRunMigrations();

// ── One-time Supabase Storage migration (runs non-blocking after start) ────────
// Uploads any DB-tracked document files that aren't yet in Supabase Storage.
// Safe to run on every startup — skips files already uploaded (upsert: false check).
async function migrateLocalFilesToSupabase() {
  if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY === 'your-supabase-service-role-key-here') {
    console.log('[StorageMigration] Skipping — SUPABASE_SERVICE_KEY not set');
    return;
  }
  const UPLOAD_DIR = path.join(__dirname, '../uploads');
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log('[StorageMigration] No local uploads/ folder found, skipping');
    return;
  }
  try {
    const db = require('./db');
    const { rows: docs } = await db.query('SELECT id, file_path, file_name, mime_type FROM public.documents');
    if (docs.length === 0) { console.log('[StorageMigration] No document records found'); return; }

    console.log(`[StorageMigration] Checking ${docs.length} document(s) against Supabase Storage...`);
    let uploaded = 0, skipped = 0;

    for (const doc of docs) {
      // Check if already in Supabase Storage
      const { error: checkErr } = await downloadFile(DOCS_BUCKET, doc.file_path);
      if (!checkErr) { skipped++; continue; } // already exists

      // Try local disk
      const localPath = path.join(UPLOAD_DIR, doc.file_path.replace(/\//g, path.sep));
      if (!fs.existsSync(localPath)) {
        console.warn(`[StorageMigration] File missing locally and not in storage: ${doc.file_path}`);
        continue;
      }
      try {
        const buffer = fs.readFileSync(localPath);
        await uploadFile(DOCS_BUCKET, doc.file_path, buffer, doc.mime_type || 'application/octet-stream');
        console.log(`[StorageMigration] ✅ Uploaded: ${doc.file_path}`);
        uploaded++;
      } catch (err) {
        console.error(`[StorageMigration] ❌ Failed ${doc.file_path}: ${err.message}`);
      }
    }
    console.log(`[StorageMigration] Done — ${uploaded} uploaded, ${skipped} already in storage`);
  } catch (err) {
    console.error('[StorageMigration] Error (non-fatal):', err.message);
  }
}

// Run after a short delay so server is fully up first
setTimeout(() => migrateLocalFilesToSupabase().catch(() => {}), 5000);

module.exports = app;
