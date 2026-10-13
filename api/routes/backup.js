'use strict';
/**
 * ZDSPGC Backup API Routes  –  Admin only
 *
 * POST /api/backup/run          – trigger a new backup immediately
 * GET  /api/backup/list         – list all available backups
 * POST /api/backup/restore      – restore a backup by backupId
 *                                 body: { backupId, dbOnly?, filesOnly? }
 * GET  /api/backup/status/:id   – get the manifest for a specific backup
 */

const path    = require('path');
const fs      = require('fs');
const router  = require('express').Router();
const db      = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { runBackup, listBackups, restoreBackup, LOCAL_BACKUP_DIR, BACKUP_BUCKET } = require('../services/backup');

// ── POST /api/backup/run ─────────────────────────────────────────────────────
router.post('/run', requireAdmin, async (req, res) => {
  console.log('[Backup API] Backup triggered by admin:', req.user && req.user.email);

  const { dbOnly, filesOnly, saveLocal } = req.body || {};
  const log = [];
  function onProgress(step, detail) {
    const line = '[' + step + '] ' + detail;
    log.push(line);
    console.log('[Backup]', line);
  }

  try {
    const { backupId, manifest } = await runBackup(db, onProgress, { dbOnly, filesOnly, saveLocal });
    return res.json({
      success: true,
      backupId,
      createdAt: manifest.createdAt,
      destination: manifest.destination,
      tables: manifest.tables,
      filesCount: manifest.files.length,
      errors: manifest.errors,
      log,
    });
  } catch (err) {
    console.error('[Backup API] runBackup failed:', err.message);
    return res.status(500).json({ success: false, error: err.message, log });
  }
});

// ── GET /api/backup/list ─────────────────────────────────────────────────────
router.get('/list', requireAdmin, async (req, res) => {
  try {
    const backups = await listBackups();
    return res.json({ success: true, count: backups.length, backups });
  } catch (err) {
    console.error('[Backup API] listBackups failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/backup/restore ─────────────────────────────────────────────────
router.post('/restore', requireAdmin, async (req, res) => {
  const { backupId, dbOnly, filesOnly } = req.body || {};
  if (!backupId) {
    return res.status(400).json({ success: false, error: 'backupId is required' });
  }

  console.log('[Backup API] Restore triggered by admin:', req.user && req.user.email, '| backupId:', backupId);

  const log = [];
  function onProgress(step, detail) {
    const line = '[' + step + '] ' + detail;
    log.push(line);
    console.log('[Restore]', line);
  }

  try {
    const result = await restoreBackup(db, backupId, { dbOnly, filesOnly, onProgress });
    return res.json({
      success: result.errors.length === 0,
      backupId,
      errors: result.errors,
      log,
    });
  } catch (err) {
    console.error('[Backup API] restoreBackup failed:', err.message);
    return res.status(500).json({ success: false, error: err.message, log });
  }
});

// ── GET /api/backup/status/:id ───────────────────────────────────────────────
router.get('/status/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Check local disk
    const localManifest = path.join(LOCAL_BACKUP_DIR, id, 'manifest.json');
    if (fs.existsSync(localManifest)) {
      const manifest = JSON.parse(fs.readFileSync(localManifest, 'utf8'));
      return res.json({ success: true, manifest, source: 'local' });
    }

    // 2. Check Supabase Storage
    let url = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
    if (!url || !key) return res.status(404).json({ error: 'Backup not found' });

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: blob, error } = await supabase.storage
      .from(BACKUP_BUCKET)
      .download(id + '/manifest.json');

    if (error || !blob) return res.status(404).json({ error: 'Backup not found', detail: error && error.message });
    const manifest = JSON.parse(await blob.text());
    return res.json({ success: true, manifest, source: 'supabase' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
