'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs    = require('fs');
const { runMigrations } = require('./migrate');

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
app.get('/api/health', async (req, res) => {
  try {
    const db = require('./db');
    const { rows } = await db.query('SELECT NOW() AS server_time, current_database() AS db_name');
    res.json({
      status: 'ok',
      database: rows[0].db_name,
      server_time: rows[0].server_time,
      api_version: '1.0.0',
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
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

runMigrations()
  .then(startServer)
  .catch((err) => {
    console.error('[Startup] Migration error, starting server anyway:', err.message);
    startServer();
  });

module.exports = app;
