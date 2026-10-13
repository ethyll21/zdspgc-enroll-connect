#!/usr/bin/env node
/**
 * ZDSPGC  –  Manual Backup CLI
 * Usage:  node backup-now.cjs [--db-only] [--files-only]
 *
 * Requires environment variables:
 *   DATABASE_URL          (PostgreSQL connection string)
 *   SUPABASE_URL          (https://xxxx.supabase.co)
 *   SUPABASE_SERVICE_KEY  (service-role key)
 *
 * Loads from .env automatically if present.
 */
'use strict';

const path = require('path');
const fs   = require('fs');

// Load .env if it exists (local development convenience)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
  console.log('[CLI] Loaded .env');
}

const args     = process.argv.slice(2);
const dbOnly   = args.includes('--db-only');
const filesOnly = args.includes('--files-only');
const doRestore = args.includes('--restore');
const restoreId = args[args.indexOf('--restore') + 1] || null;
const listMode  = args.includes('--list');

// Resolve service paths relative to this file
const db      = require('./api/db');
const { runBackup, listBackups, restoreBackup } = require('./api/services/backup');

function progress(step, detail) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log('[' + ts + '] [' + step + '] ' + detail);
}

async function main() {
  // ── List mode ────────────────────────────────────────────────────────────
  if (listMode) {
    console.log('\n=== Available Backups ===');
    const backups = await listBackups();
    if (backups.length === 0) {
      console.log('  (no backups found)');
    } else {
      for (const b of backups) {
        const tables = Object.keys(b.tables || {}).length;
        const files  = (b.files || []).length;
        const errors = (b.errors || []).length;
        console.log('  ' + b.backupId + '  tables=' + tables + '  files=' + files + '  errors=' + errors);
      }
    }
    process.exit(0);
  }

  // ── Restore mode ──────────────────────────────────────────────────────────
  if (doRestore) {
    if (!restoreId) {
      console.error('ERROR: --restore requires a backup ID. E.g.: node backup-now.cjs --restore backup_2026-...');
      process.exit(1);
    }
    console.log('\n=== RESTORE: ' + restoreId + ' ===');
    console.log('dbOnly=' + dbOnly + '  filesOnly=' + filesOnly);
    console.log('WARNING: This will overwrite existing data. Press Ctrl+C within 5 seconds to abort.\n');
    await new Promise(function(r) { setTimeout(r, 5000); });

    const result = await restoreBackup(db, restoreId, { dbOnly, filesOnly, onProgress: progress });
    if (result.errors.length > 0) {
      console.error('\nRestore finished with errors:');
      result.errors.forEach(function(e) { console.error('  !', e); });
      process.exit(2);
    }
    console.log('\n✓ Restore complete.');
    process.exit(0);
  }

  // ── Backup mode (default) ─────────────────────────────────────────────────
  console.log('\n=== ZDSPGC Backup ===');
  console.log('dbOnly=' + dbOnly + '  filesOnly=' + filesOnly);
  console.log('Started at ' + new Date().toISOString() + '\n');

  const { backupId, manifest } = await runBackup(db, progress, { dbOnly, filesOnly, saveLocal: true });

  console.log('\n=== Backup Summary ===');
  console.log('ID          : ' + backupId);
  console.log('Destination : ' + manifest.destination);
  console.log('Tables      : ' + Object.keys(manifest.tables).length);
  for (const [t, info] of Object.entries(manifest.tables)) {
    console.log('              ' + t + ' (' + info.rows + ' rows)');
  }
  console.log('Files       : ' + manifest.files.length);
  console.log('Errors      : ' + manifest.errors.length);
  if (manifest.errors.length > 0) {
    manifest.errors.forEach(function(e) { console.error('  !', e); });
  }
  console.log('\n✓ Done. Backup stored (' + manifest.destination + ') → backups/' + backupId);
  process.exit(manifest.errors.length > 0 ? 2 : 0);
}

main().catch(function(err) {
  console.error('[CLI] Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
