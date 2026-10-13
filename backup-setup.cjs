#!/usr/bin/env node
/**
 * ZDSPGC  –  Backup One-Time Setup
 *
 * Run this ONCE before your first backup to:
 *  1. Create the "backups" bucket in Supabase Storage (private)
 *  2. Verify the database connection
 *  3. Verify Supabase credentials work
 *
 * Usage:
 *   node backup-setup.cjs
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URL
 * Loads from .env automatically if it exists.
 */
'use strict';

const path = require('path');
const fs   = require('fs');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
  console.log('Loaded .env');
}

const { createClient } = require('@supabase/supabase-js');
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const BACKUP_BUCKET = 'backups';
const DOCS_BUCKET   = 'student-documents';

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   ZDSPGC Backup Setup                      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  let hasErrors = false;

  // ── 1. Validate env vars ──────────────────────────────────────────────────
  console.log('[1/4] Checking environment variables...');
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

  const missingVars = [];
  if (!SUPABASE_URL)  missingVars.push('SUPABASE_URL');
  if (!SERVICE_KEY || SERVICE_KEY === 'your-supabase-service-role-key-here') missingVars.push('SUPABASE_SERVICE_KEY');
  if (!DATABASE_URL)  missingVars.push('DATABASE_URL (optional for local PG)');

  if (missingVars.length > 0) {
    console.warn('  WARNING: Missing/unset variables:', missingVars.join(', '));
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('  ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY are required to set up Supabase Cloud Storage.');
      console.log('  Tip: You can still run local backups right now with: npm run backup');
      console.log('  To enable Cloud backups, add SUPABASE_URL and SUPABASE_SERVICE_KEY to your .env file.\n');
      process.exit(1);
    }
  } else {
    console.log('  OK  SUPABASE_URL   :', SUPABASE_URL);
    console.log('  OK  SERVICE_KEY    : (set, ' + SERVICE_KEY.length + ' chars)');
    console.log('  OK  DATABASE_URL   :', DATABASE_URL ? '(set)' : '(using local PG fallback)');
  }

  // ── 2. Test Supabase connection ───────────────────────────────────────────
  console.log('\n[2/4] Testing Supabase connection...');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(error.message);
    const bucketNames = (data || []).map(function(b) { return b.name; });
    console.log('  OK  Supabase connected. Buckets:', bucketNames.join(', ') || '(none)');

    // ── 3. Create backups bucket ──────────────────────────────────────────
    console.log('\n[3/4] Ensuring "backups" bucket exists...');
    if (bucketNames.includes(BACKUP_BUCKET)) {
      console.log('  OK  "' + BACKUP_BUCKET + '" bucket already exists.');
    } else {
      console.log('  Creating "' + BACKUP_BUCKET + '" bucket (private)...');
      const { error: createErr } = await supabase.storage.createBucket(BACKUP_BUCKET, {
        public: false,
        fileSizeLimit: null,     // no limit
      });
      if (createErr) {
        console.error('  ERROR: Failed to create bucket:', createErr.message);
        hasErrors = true;
      } else {
        console.log('  OK  "' + BACKUP_BUCKET + '" bucket created (private).');
      }
    }

    // Also confirm the student-documents bucket exists
    if (bucketNames.includes(DOCS_BUCKET)) {
      console.log('  OK  "' + DOCS_BUCKET + '" source bucket exists.');
    } else {
      console.warn('  WARN: "' + DOCS_BUCKET + '" bucket not found — document backups will be empty.');
    }

    // ── 4. Test write access to backups bucket ────────────────────────────
    console.log('\n[4/4] Testing write access to "backups" bucket...');
    const testContent = Buffer.from(JSON.stringify({ test: true, ts: new Date().toISOString() }));
    const testPath    = '_setup_test/ping.json';
    const { error: writeErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(testPath, testContent, { contentType: 'application/json', upsert: true });

    if (writeErr) {
      console.error('  ERROR: Write test failed:', writeErr.message);
      hasErrors = true;
    } else {
      console.log('  OK  Write test passed.');
      // Clean up test file
      await supabase.storage.from(BACKUP_BUCKET).remove([testPath]);
    }

  } catch (err) {
    console.error('  ERROR: Supabase test failed:', err.message);
    hasErrors = true;
  }

  // ── 5. Test database connection ───────────────────────────────────────────
  console.log('\n[DB] Testing database connection...');
  try {
    const db = require('./api/db');
    const result = await Promise.race([
      db.query('SELECT NOW() AS ts, current_database() AS dbname'),
      new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 8000); }),
    ]);
    console.log('  OK  Database:', result.rows[0].dbname, 'at', result.rows[0].ts);

    // Count rows in key tables
    const tables = ['users', 'students', 'enrollments', 'documents'];
    for (const t of tables) {
      try {
        const r = await db.query('SELECT COUNT(*) FROM public.' + t);
        console.log('  OK  ' + t + ': ' + r.rows[0].count + ' rows');
      } catch (e) {
        console.warn('  WARN: ' + t + ': ' + e.message);
      }
    }
    db.pool.end();
  } catch (err) {
    console.error('  WARN: DB connection failed (will use local fallback):', err.message);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  if (hasErrors) {
    console.error('Setup completed WITH ERRORS. Fix the issues above before running backups.\n');
    process.exit(2);
  } else {
    console.log('Setup complete! You are ready to run backups.\n');
    console.log('Next steps:');
    console.log('  node backup-now.cjs          # run a full backup now');
    console.log('  node backup-now.cjs --list   # list all backups\n');
    process.exit(0);
  }
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
