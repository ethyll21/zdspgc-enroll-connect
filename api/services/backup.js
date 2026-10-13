'use strict';
/**
 * ZDSPGC  Backup Service
 *
 * Creates a complete point-in-time backup:
 *   1. All production DB tables exported as JSON (read-only SELECT)
 *   2. All files in the Supabase "student-documents" bucket
 *
 * The backup is uploaded to a dedicated Supabase Storage bucket
 * called "backups" so it survives Render ephemeral restarts.
 *
 * IMPORTANT: This service NEVER modifies, deletes, or replaces
 * any production data during backup.
 */

const { createClient } = require('@supabase/supabase-js');
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const BACKUP_BUCKET = 'backups';
const DOCS_BUCKET   = 'student-documents';

const DB_TABLES = [
  'users',
  'profiles',
  'user_roles',
  'programs',
  'students',
  'enrollments',
  'documents',
  'validation_records',
  'notifications',
];

function getSupabase() {
  let url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
    .replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key || key === 'your-supabase-service-role-key-here') {
    throw new Error('[Backup] SUPABASE_URL or SUPABASE_SERVICE_KEY is not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function storagePut(supabase, bucket, storagePath, buffer, mimeType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType || 'application/octet-stream', upsert: true });
  if (error) throw new Error('[Backup] Storage upload failed (' + storagePath + '): ' + error.message);
  return storagePath;
}

async function listAllFiles(supabase, bucket, prefix) {
  prefix = prefix || '';
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error('[Backup] list failed (' + bucket + '/' + prefix + '): ' + error.message);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const fullPath = prefix ? prefix + '/' + item.name : item.name;
      if (item.id) {
        all.push(fullPath);
      } else {
        const nested = await listAllFiles(supabase, bucket, fullPath);
        all.push(...nested);
      }
    }
    offset += data.length;
    if (data.length < PAGE) break;
  }
  return all;
}

async function runBackup(db, onProgress) {
  onProgress = onProgress || function() {};
  const supabase = getSupabase();
  const backupId = 'backup_' + new Date().toISOString().replace(/[:.]/g, '-');
  const baseKey  = backupId;

  const manifest = {
    backupId,
    createdAt: new Date().toISOString(),
    tables: {},
    files: [],
    errors: [],
  };

  // 1. Dump all DB tables
  onProgress('db', 'Exporting database tables...');
  for (const table of DB_TABLES) {
    try {
      onProgress('db', '  -> ' + table);
      const { rows } = await db.query('SELECT * FROM public.' + table);
      const buf = Buffer.from(JSON.stringify(rows, null, 2), 'utf8');
      const path = baseKey + '/db/' + table + '.json';
      await storagePut(supabase, BACKUP_BUCKET, path, buf, 'application/json');
      manifest.tables[table] = { rows: rows.length, storagePath: path };
      onProgress('db', '  ok ' + table + ' (' + rows.length + ' rows)');
    } catch (err) {
      const msg = 'Failed to export table "' + table + '": ' + err.message;
      console.error('[Backup] ' + msg);
      manifest.errors.push(msg);
    }
  }

  // 2. Back up student documents
  onProgress('files', 'Listing student documents...');
  let docFiles = [];
  try {
    docFiles = await listAllFiles(supabase, DOCS_BUCKET);
    onProgress('files', '  Found ' + docFiles.length + ' file(s)');
  } catch (err) {
    const msg = 'Failed to list student-documents: ' + err.message;
    console.error('[Backup] ' + msg);
    manifest.errors.push(msg);
  }

  for (const filePath of docFiles) {
    try {
      onProgress('files', '  down ' + filePath);
      const { data, error } = await supabase.storage.from(DOCS_BUCKET).download(filePath);
      if (error) throw new Error(error.message);
      const buf  = Buffer.from(await data.arrayBuffer());
      const dest = baseKey + '/files/student-documents/' + filePath;
      await storagePut(supabase, BACKUP_BUCKET, dest, buf, data.type || 'application/octet-stream');
      manifest.files.push({ source: DOCS_BUCKET + '/' + filePath, backup: dest, bytes: buf.length });
      onProgress('files', '  ok ' + filePath + ' (' + buf.length + 'b)');
    } catch (err) {
      const msg = 'Failed to back up file "' + filePath + '": ' + err.message;
      console.error('[Backup] ' + msg);
      manifest.errors.push(msg);
    }
  }

  // 3. Write manifest
  onProgress('manifest', 'Writing manifest...');
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  await storagePut(supabase, BACKUP_BUCKET, baseKey + '/manifest.json', manifestBuf, 'application/json');

  onProgress('done', 'Backup complete -> ' + backupId);
  console.log('[Backup] Done: ' + backupId + ' | tables=' + Object.keys(manifest.tables).length + ' | files=' + manifest.files.length + ' | errors=' + manifest.errors.length);
  return { backupId, manifest };
}

async function listBackups() {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .list('', { limit: 500, sortBy: { column: 'name', order: 'desc' } });
  if (error) throw new Error('[Backup] Failed to list backups: ' + error.message);
  if (!data) return [];

  const results = [];
  for (const item of data) {
    if (item.id) continue;
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from(BACKUP_BUCKET)
        .download(item.name + '/manifest.json');
      if (dlErr || !blob) continue;
      results.push(JSON.parse(await blob.text()));
    } catch (_) {}
  }
  return results.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
}

async function restoreBackup(db, backupId, opts) {
  opts = opts || {};
  const dbOnly    = opts.dbOnly    || false;
  const filesOnly = opts.filesOnly || false;
  const onProgress = opts.onProgress || function() {};
  const supabase  = getSupabase();

  onProgress('manifest', 'Loading manifest for ' + backupId + '...');
  const { data: mBlob, error: mErr } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(backupId + '/manifest.json');
  if (mErr || !mBlob) throw new Error('[Restore] Manifest not found for ' + backupId + ': ' + (mErr && mErr.message));
  const manifest = JSON.parse(await mBlob.text());
  const restoreErrors = [];

  if (!filesOnly) {
    onProgress('db', 'Restoring database...');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('SET session_replication_role = replica');
      const tableOrder = Object.keys(manifest.tables);

      for (const table of [...tableOrder].reverse()) {
        onProgress('db', '  TRUNCATE ' + table);
        await client.query('TRUNCATE TABLE public.' + table + ' CASCADE');
      }

      for (const table of tableOrder) {
        const info = manifest.tables[table];
        if (!info) continue;
        onProgress('db', '  -> ' + table + ' (' + info.rows + ' rows)');
        const { data: blob, error: dlErr } = await supabase.storage
          .from(BACKUP_BUCKET)
          .download(info.storagePath);
        if (dlErr || !blob) throw new Error('Cannot download backup for table ' + table + ': ' + (dlErr && dlErr.message));
        const rows = JSON.parse(await blob.text());
        for (const row of rows) {
          const cols   = Object.keys(row);
          const vals   = Object.values(row);
          const places = cols.map(function(_, i) { return '$' + (i + 1); }).join(', ');
          const colStr = cols.map(function(c) { return '"' + c + '"'; }).join(', ');
          await client.query(
            'INSERT INTO public.' + table + ' (' + colStr + ') VALUES (' + places + ') ON CONFLICT DO NOTHING',
            vals
          );
        }
        onProgress('db', '  ok ' + table);
      }

      await client.query('SET session_replication_role = DEFAULT');
      await client.query('COMMIT');
      onProgress('db', 'Database restore committed');
    } catch (err) {
      await client.query('ROLLBACK').catch(function() {});
      restoreErrors.push('DB restore failed (rolled back): ' + err.message);
      console.error('[Restore] DB error, rolled back:', err.message);
    } finally {
      client.release();
    }
  }

  if (!dbOnly) {
    onProgress('files', 'Restoring ' + manifest.files.length + ' file(s)...');
    for (const fileInfo of manifest.files) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(BACKUP_BUCKET)
          .download(fileInfo.backup);
        if (dlErr || !blob) throw new Error((dlErr && dlErr.message) || 'empty blob');
        const buf  = Buffer.from(await blob.arrayBuffer());
        const dest = fileInfo.source.replace(/^student-documents\//, '');
        onProgress('files', '  up -> ' + DOCS_BUCKET + '/' + dest);
        const { error: upErr } = await supabase.storage
          .from(DOCS_BUCKET)
          .upload(dest, buf, { contentType: blob.type || 'application/octet-stream', upsert: true });
        if (upErr) throw new Error(upErr.message);
        onProgress('files', '  ok ' + dest);
      } catch (err) {
        const msg = 'File restore failed (' + fileInfo.source + '): ' + err.message;
        restoreErrors.push(msg);
        console.error('[Restore] ' + msg);
      }
    }
  }

  onProgress('done', 'Restore complete (' + restoreErrors.length + ' errors)');
  return { backupId, errors: restoreErrors };
}

module.exports = { runBackup, listBackups, restoreBackup, BACKUP_BUCKET, DB_TABLES };
