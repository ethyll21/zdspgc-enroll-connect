'use strict';
/**
 * ZDSPGC  Backup Service
 *
 * Creates a complete point-in-time backup:
 *   1. All production DB tables exported as JSON (read-only SELECT)
 *   2. All files in the Supabase "student-documents" bucket (and local uploads)
 *
 * Cloud storage: Uploads to Supabase Storage "backups" bucket (survives Render restarts)
 * Local storage: Automatically mirrors or falls back to ./backups/ on disk
 *
 * IMPORTANT: This service NEVER modifies, deletes, or replaces
 * any production data during backup.
 */

const path = require('path');
const fs   = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const BACKUP_BUCKET = 'backups';
const DOCS_BUCKET   = 'student-documents';
const AVATAR_BUCKET = 'avatars';
const LOCAL_BACKUP_DIR = path.resolve(__dirname, '../../backups');
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

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
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key || key === 'your-supabase-service-role-key-here') {
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function storagePut(supabase, bucket, storagePath, buffer, mimeType) {
  if (!supabase) return storagePath;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType || 'application/octet-stream', upsert: true });
  if (error) throw new Error('[Backup] Storage upload failed (' + storagePath + '): ' + error.message);
  return storagePath;
}

async function listAllFiles(supabase, bucket, prefix) {
  if (!supabase) return [];
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

function listLocalFilesRecursive(dir, baseDir) {
  baseDir = baseDir || dir;
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listLocalFilesRecursive(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push(path.relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

async function runBackup(db, onProgress, options) {
  onProgress = onProgress || function() {};
  options = options || {};
  const dbOnly    = options.dbOnly    || false;
  const filesOnly = options.filesOnly || false;
  const saveLocal = options.saveLocal !== undefined ? options.saveLocal : true;

  const supabase = getSupabase();
  const backupId = 'backup_' + new Date().toISOString().replace(/[:.]/g, '-');
  const baseKey  = backupId;
  const localTargetDir = path.join(LOCAL_BACKUP_DIR, backupId);

  if (saveLocal) {
    ensureDir(localTargetDir);
    ensureDir(path.join(localTargetDir, 'db'));
    ensureDir(path.join(localTargetDir, 'files'));
  }

  const manifest = {
    backupId,
    createdAt: new Date().toISOString(),
    destination: supabase ? (saveLocal ? 'both' : 'supabase') : 'local',
    tables: {},
    files: [],
    errors: [],
  };

  if (!supabase) {
    onProgress('info', 'Supabase credentials not configured; saving backup to local disk (' + localTargetDir + ')');
  }

  // 1. Export database tables
  if (!filesOnly) {
    onProgress('db', 'Exporting database tables...');
    for (const table of DB_TABLES) {
      try {
        onProgress('db', '  -> ' + table);
        const { rows } = await db.query('SELECT * FROM public.' + table);
        const jsonStr = JSON.stringify(rows, null, 2);
        const buf = Buffer.from(jsonStr, 'utf8');
        const storagePath = baseKey + '/db/' + table + '.json';

        if (supabase) {
          await storagePut(supabase, BACKUP_BUCKET, storagePath, buf, 'application/json');
        }
        if (saveLocal) {
          fs.writeFileSync(path.join(localTargetDir, 'db', table + '.json'), jsonStr, 'utf8');
        }

        manifest.tables[table] = { rows: rows.length, storagePath };
        onProgress('db', '  ok ' + table + ' (' + rows.length + ' rows)');
      } catch (err) {
        const msg = 'Failed to export table "' + table + '": ' + err.message;
        console.error('[Backup] ' + msg);
        manifest.errors.push(msg);
      }
    }
  }

  // 2. Back up files
  if (!dbOnly) {
    // 2a. Supabase Storage files
    if (supabase) {
      onProgress('files', 'Listing Supabase student documents...');
      const bucketsToCheck = [DOCS_BUCKET, AVATAR_BUCKET];
      for (const bucket of bucketsToCheck) {
        let docFiles = [];
        try {
          docFiles = await listAllFiles(supabase, bucket);
          onProgress('files', '  Found ' + docFiles.length + ' file(s) in ' + bucket);
        } catch (err) {
          const msg = 'Failed to list bucket "' + bucket + '": ' + err.message;
          console.error('[Backup] ' + msg);
          manifest.errors.push(msg);
        }

        for (const filePath of docFiles) {
          try {
            onProgress('files', '  down ' + bucket + '/' + filePath);
            const { data, error } = await supabase.storage.from(bucket).download(filePath);
            if (error) throw new Error(error.message);
            const buf  = Buffer.from(await data.arrayBuffer());
            const dest = baseKey + '/files/' + bucket + '/' + filePath;
            await storagePut(supabase, BACKUP_BUCKET, dest, buf, data.type || 'application/octet-stream');

            if (saveLocal) {
              const localFilePath = path.join(localTargetDir, 'files', bucket, filePath);
              ensureDir(path.dirname(localFilePath));
              fs.writeFileSync(localFilePath, buf);
            }

            manifest.files.push({ source: bucket + '/' + filePath, backup: dest, bytes: buf.length });
            onProgress('files', '  ok ' + bucket + '/' + filePath + ' (' + buf.length + 'b)');
          } catch (err) {
            const msg = 'Failed to back up file "' + bucket + '/' + filePath + '": ' + err.message;
            console.error('[Backup] ' + msg);
            manifest.errors.push(msg);
          }
        }
      }
    }

    // 2b. Local uploads directory (if exists)
    if (fs.existsSync(LOCAL_UPLOADS_DIR)) {
      onProgress('files', 'Backing up local uploads folder...');
      const localFiles = listLocalFilesRecursive(LOCAL_UPLOADS_DIR);
      for (const relPath of localFiles) {
        try {
          const fullSrc = path.join(LOCAL_UPLOADS_DIR, relPath);
          const buf = fs.readFileSync(fullSrc);
          const dest = baseKey + '/files/local-uploads/' + relPath;

          if (supabase) {
            await storagePut(supabase, BACKUP_BUCKET, dest, buf, 'application/octet-stream');
          }
          if (saveLocal) {
            const localFilePath = path.join(localTargetDir, 'files', 'local-uploads', relPath);
            ensureDir(path.dirname(localFilePath));
            fs.writeFileSync(localFilePath, buf);
          }

          manifest.files.push({ source: 'uploads/' + relPath, backup: dest, bytes: buf.length });
          onProgress('files', '  ok uploads/' + relPath + ' (' + buf.length + 'b)');
        } catch (err) {
          const msg = 'Failed to back up local upload "' + relPath + '": ' + err.message;
          console.error('[Backup] ' + msg);
          manifest.errors.push(msg);
        }
      }
    }
  }

  // 3. Write manifest
  onProgress('manifest', 'Writing manifest...');
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBuf  = Buffer.from(manifestJson, 'utf8');

  if (supabase) {
    await storagePut(supabase, BACKUP_BUCKET, baseKey + '/manifest.json', manifestBuf, 'application/json');
  }
  if (saveLocal) {
    fs.writeFileSync(path.join(localTargetDir, 'manifest.json'), manifestJson, 'utf8');
  }

  onProgress('done', 'Backup complete -> ' + backupId);
  console.log('[Backup] Done: ' + backupId + ' | tables=' + Object.keys(manifest.tables).length + ' | files=' + manifest.files.length + ' | errors=' + manifest.errors.length);
  return { backupId, manifest };
}

async function listBackups() {
  const map = new Map();
  const supabase = getSupabase();

  // 1. Supabase backups
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list('', { limit: 500, sortBy: { column: 'name', order: 'desc' } });
      if (!error && data) {
        for (const item of data) {
          if (item.id) continue;
          try {
            const { data: blob, error: dlErr } = await supabase.storage
              .from(BACKUP_BUCKET)
              .download(item.name + '/manifest.json');
            if (dlErr || !blob) continue;
            const parsed = JSON.parse(await blob.text());
            map.set(parsed.backupId || item.name, parsed);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[Backup] list from Supabase skipped:', err.message);
    }
  }

  // 2. Local backups
  if (fs.existsSync(LOCAL_BACKUP_DIR)) {
    try {
      const entries = fs.readdirSync(LOCAL_BACKUP_DIR, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const manifestPath = path.join(LOCAL_BACKUP_DIR, ent.name, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const raw = fs.readFileSync(manifestPath, 'utf8');
            const parsed = JSON.parse(raw);
            const id = parsed.backupId || ent.name;
            if (!map.has(id)) {
              map.set(id, parsed);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[Backup] list from local dir skipped:', err.message);
    }
  }

  return Array.from(map.values()).sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

async function restoreBackup(db, backupId, opts) {
  opts = opts || {};
  const dbOnly    = opts.dbOnly    || false;
  const filesOnly = opts.filesOnly || false;
  const onProgress = opts.onProgress || function() {};
  const supabase  = getSupabase();

  onProgress('manifest', 'Loading manifest for ' + backupId + '...');
  let manifest = null;

  // Check local manifest first
  const localManifestPath = path.join(LOCAL_BACKUP_DIR, backupId, 'manifest.json');
  if (fs.existsSync(localManifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf8'));
    } catch (_) {}
  }

  // Check Supabase if not local
  if (!manifest && supabase) {
    const { data: mBlob, error: mErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .download(backupId + '/manifest.json');
    if (!mErr && mBlob) {
      manifest = JSON.parse(await mBlob.text());
    }
  }

  if (!manifest) {
    throw new Error('[Restore] Manifest not found for ' + backupId + ' in local storage or Supabase.');
  }

  const restoreErrors = [];

  // 1. Restore Database
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

        let rows = null;
        const localTableFile = path.join(LOCAL_BACKUP_DIR, backupId, 'db', table + '.json');
        if (fs.existsSync(localTableFile)) {
          rows = JSON.parse(fs.readFileSync(localTableFile, 'utf8'));
        } else if (supabase) {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(BACKUP_BUCKET)
            .download(info.storagePath);
          if (dlErr || !blob) throw new Error('Cannot download backup for table ' + table + ': ' + (dlErr && dlErr.message));
          rows = JSON.parse(await blob.text());
        }

        if (!rows) throw new Error('Backup data for table ' + table + ' not found.');

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

  // 2. Restore Files
  if (!dbOnly) {
    onProgress('files', 'Restoring ' + (manifest.files || []).length + ' file(s)...');
    for (const fileInfo of (manifest.files || [])) {
      try {
        let buf = null;
        let mimeType = 'application/octet-stream';

        // Check local disk first
        const localFile = path.join(LOCAL_BACKUP_DIR, fileInfo.backup);
        if (fs.existsSync(localFile)) {
          buf = fs.readFileSync(localFile);
        } else if (supabase) {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(BACKUP_BUCKET)
            .download(fileInfo.backup);
          if (dlErr || !blob) throw new Error((dlErr && dlErr.message) || 'empty blob');
          buf = Buffer.from(await blob.arrayBuffer());
          mimeType = blob.type || mimeType;
        }

        if (!buf) throw new Error('File content not found for ' + fileInfo.backup);

        // Upload to Supabase bucket if supabase available
        if (supabase && (fileInfo.source.startsWith(DOCS_BUCKET + '/') || fileInfo.source.startsWith(AVATAR_BUCKET + '/'))) {
          const slashIdx = fileInfo.source.indexOf('/');
          const targetBucket = fileInfo.source.slice(0, slashIdx);
          const targetPath   = fileInfo.source.slice(slashIdx + 1);
          onProgress('files', '  up -> ' + targetBucket + '/' + targetPath);
          const { error: upErr } = await supabase.storage
            .from(targetBucket)
            .upload(targetPath, buf, { contentType: mimeType, upsert: true });
          if (upErr) throw new Error(upErr.message);
        }

        // Restore to local uploads/ if it was a local upload
        if (fileInfo.source.startsWith('uploads/')) {
          const relPath = fileInfo.source.replace(/^uploads\//, '');
          const destPath = path.join(LOCAL_UPLOADS_DIR, relPath);
          ensureDir(path.dirname(destPath));
          fs.writeFileSync(destPath, buf);
          onProgress('files', '  ok uploads/' + relPath);
        }

        onProgress('files', '  ok ' + fileInfo.source);
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

module.exports = {
  runBackup,
  listBackups,
  restoreBackup,
  BACKUP_BUCKET,
  DOCS_BUCKET,
  AVATAR_BUCKET,
  DB_TABLES,
  LOCAL_BACKUP_DIR,
};
