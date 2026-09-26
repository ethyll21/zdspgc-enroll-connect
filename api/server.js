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
async function fixEnums(db) {
  try {
    const values = ['psa_birth_certificate', 'form_138', 'good_moral', 'transfer_certificate', 'other', 'registration_form'];
    const colCheck = await db.query(`SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='doc_type'`);
    if (colCheck.rows.length > 0 && colCheck.rows[0].udt_name === 'document_type') {
      console.log('[Startup] Checking document_type enum values...');
      for (const val of values) {
        try {
          await db.query(`ALTER TYPE document_type ADD VALUE IF NOT EXISTS '${val}'`);
        } catch (e) {
          // Ignore errors if it already exists in some edge cases
        }
      }
      console.log('[Startup] document_type enum verified/fixed.');
    }
  } catch (err) {
    console.error('[Startup] Failed to check enums (non-fatal):', err.message);
  }
}

async function fixEnrollmentsTable(db) {
  try {
    console.log('[Startup] Checking enrollments table schema...');
    // Add missing columns if they don't exist
    await db.query(`ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS reviewed_by UUID`);
    console.log('[Startup] enrollments table schema verified/fixed.');
  } catch (err) {
    console.error('[Startup] Failed to check enrollments table schema (non-fatal):', err.message);
  }
}

async function fixDocumentStatus(db) {
  try {
    console.log('[Startup] Checking document_status enum...');
    // Check if document_status type exists at all
    const typeCheck = await db.query(`SELECT 1 FROM pg_type WHERE typname = 'document_status'`);
    if (typeCheck.rows.length === 0) {
      // Create the enum if it doesn't exist
      await db.query(`CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected')`);
      console.log('[Startup] Created document_status enum.');
    } else {
      // Ensure all values exist
      const statusValues = ['pending', 'approved', 'rejected'];
      for (const val of statusValues) {
        try {
          await db.query(`ALTER TYPE document_status ADD VALUE IF NOT EXISTS '${val}'`);
        } catch (e) { /* already exists */ }
      }
      console.log('[Startup] document_status enum verified.');
    }

    // Also ensure the documents.status column uses it (or TEXT as fallback)
    const colCheck = await db.query(`
      SELECT udt_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='documents' AND column_name='status'
    `);
    if (colCheck.rows.length === 0) {
      // Add missing status column
      await db.query(`ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);
      console.log('[Startup] Added status column to documents table.');
    }
  } catch (err) {
    console.error('[Startup] Failed to fix document_status (non-fatal):', err.message);
  }
}

async function fixDocumentsTable(db) {
  try {
    console.log('[Startup] Checking documents table schema...');
    // Add reviewed_at and reviewed_by columns if they don't exist
    await db.query(`ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_by UUID`);
    console.log('[Startup] documents table schema verified/fixed.');
  } catch (err) {
    console.error('[Startup] Failed to fix documents table (non-fatal):', err.message);
  }
}

async function fixApplicationDocuments(db) {
  try {
    console.log('[Startup] Checking application_documents table...');
    
    // Check if table exists first before altering
    const tableCheck = await db.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'application_documents'`);
    if (tableCheck.rows.length === 0) {
      console.log('[Startup] application_documents table does not exist. Skipping schema alteration.');
      return;
    }

    // Check if document_status type exists before using it
    const typeCheck = await db.query(`SELECT 1 FROM pg_type WHERE typname = 'document_status'`);
    if (typeCheck.rows.length === 0) {
      await db.query(`CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected')`);
    }
    // Ensure status column exists in application_documents
    await db.query(`ALTER TABLE public.application_documents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);
    await db.query(`ALTER TABLE public.application_documents ADD COLUMN IF NOT EXISTS remarks TEXT`);
    console.log('[Startup] application_documents table schema verified.');
  } catch (err) {
    console.error('[Startup] Failed to fix application_documents (non-fatal):', err.message);
  }
}


async function safeRunMigrations() {
  try {
    const db = require('./db');
    await fixEnums(db);
    await fixEnrollmentsTable(db);
    await fixDocumentStatus(db);
    await fixDocumentsTable(db);
    await fixApplicationDocuments(db);
    
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
// Safe to run on every startup — skips files already uploaded.
async function migrateLocalFilesToSupabase() {
  if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY === 'your-supabase-service-role-key-here') {
    console.log('[StorageMigration] Skipping — SUPABASE_SERVICE_KEY not set');
    return;
  }

  // ── Diagnostic: log the Supabase URL being used ─────────────────────────────
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '(not set)';
  const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  console.log(`[StorageMigration] Supabase URL → "${cleanUrl}"`);
  console.log(`[StorageMigration] SERVICE_KEY set? ${!!process.env.SUPABASE_SERVICE_KEY}`);

  const UPLOAD_DIR = path.join(__dirname, '../uploads');
  const uploadDirExists = fs.existsSync(UPLOAD_DIR);
  console.log(`[StorageMigration] Local uploads/ dir → "${UPLOAD_DIR}" (exists: ${uploadDirExists})`);

  try {
    const db = require('./db');
    const { rows: docs } = await db.query('SELECT id, file_path, file_name, mime_type FROM public.documents');
    if (docs.length === 0) { console.log('[StorageMigration] No document records found'); return; }

    console.log(`[StorageMigration] Checking ${docs.length} document(s) against Supabase Storage...`);
    let uploaded = 0, skipped = 0, failed = 0;

    for (const doc of docs) {
      const storagePath = (doc.file_path || '').trim().replace(/\\/g, '/');
      console.log(`[StorageMigration] → doc id=${doc.id} file_path="${storagePath}" mime="${doc.mime_type}"`);

      if (!storagePath) {
        console.warn(`[StorageMigration]   ⚠ Skipping doc ${doc.id} — empty file_path`);
        failed++;
        continue;
      }

      // ── Check if already in Supabase Storage (upsert:false will error if exists) ──
      // We use downloadFile to check existence; catch fetch/network errors explicitly.
      let alreadyInStorage = false;
      try {
        const { data, error: checkErr } = await downloadFile(DOCS_BUCKET, storagePath);
        if (!checkErr && data) {
          console.log(`[StorageMigration]   ✓ Already in storage: "${storagePath}"`);
          alreadyInStorage = true;
          skipped++;
        } else {
          console.log(`[StorageMigration]   Not in storage yet (check error: ${checkErr?.message || 'no data'})`);
        }
      } catch (checkEx) {
        // Network/fetch error during the existence check itself
        console.error(`[StorageMigration]   ⚠ Storage check threw (will try local upload): ${checkEx.message}`);
      }

      if (alreadyInStorage) continue;

      // ── Try reading from local filesystem ────────────────────────────────────
      const localPath = path.join(UPLOAD_DIR, storagePath.replace(/\//g, path.sep));
      console.log(`[StorageMigration]   Local path → "${localPath}" (exists: ${fs.existsSync(localPath)})`);

      if (!uploadDirExists || !fs.existsSync(localPath)) {
        console.warn(`[StorageMigration]   ✗ File not found on local disk — it was likely stored on the old Render ephemeral disk and is now gone. Skipping (DB record kept).`);
        failed++;
        continue;
      }

      try {
        const buffer = fs.readFileSync(localPath);
        console.log(`[StorageMigration]   Uploading ${buffer.length} bytes to Supabase path "${storagePath}"...`);
        await uploadFile(DOCS_BUCKET, storagePath, buffer, doc.mime_type || 'application/octet-stream');
        console.log(`[StorageMigration]   ✅ Uploaded: "${storagePath}"`);
        uploaded++;
      } catch (upErr) {
        console.error(`[StorageMigration]   ✗ Upload failed for "${storagePath}": ${upErr.message}`);
        console.error(`[StorageMigration]     Stack: ${upErr.stack}`);
        failed++;
      }
    }

    console.log(`[StorageMigration] Done — ${uploaded} uploaded, ${skipped} already in storage, ${failed} failed/skipped`);
  } catch (err) {
    console.error('[StorageMigration] Error (non-fatal):', err.message);
    console.error('[StorageMigration] Stack:', err.stack);
  }
}

// Run after a short delay so server is fully up first
setTimeout(() => migrateLocalFilesToSupabase().catch(() => {}), 5000);

module.exports = app;


