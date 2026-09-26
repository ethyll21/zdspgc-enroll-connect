// migrate-uploads-to-supabase.cjs
// One-time script: uploads all existing local files in /uploads/ to Supabase Storage
// Run with: node migrate-uploads-to-supabase.cjs
// Safe to run multiple times (upsert: true skips already-uploaded files)

require('dotenv').config();
const path = require('path');
const API_MODULES = path.join(__dirname, 'api', 'node_modules');
// Resolve dependencies from api/node_modules where they are installed
const { createClient } = require(path.join(API_MODULES, '@supabase', 'supabase-js'));
const { Pool } = require(path.join(API_MODULES, 'pg'));
const fs = require('fs');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL         = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  SUPABASE_URL or SUPABASE_SERVICE_KEY missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const db = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const UPLOAD_DIR   = path.join(__dirname, 'uploads');
const DOCS_BUCKET  = 'student-documents';
const AVT_BUCKET   = 'avatars';

// ── helpers ──────────────────────────────────────────────────────────────────
async function uploadToSupabase(bucket, storagePath, filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType || 'application/octet-stream', upsert: true });
  if (error) throw new Error(error.message);
}

function guessMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.gif': 'image/gif', '.webp': 'image/webp' };
  return map[ext] || 'application/octet-stream';
}

// ── migrate student documents ─────────────────────────────────────────────────
async function migrateDocs() {
  console.log('\n📂  Migrating student documents → Supabase Storage bucket:', DOCS_BUCKET);
  const { rows: docs } = await db.query('SELECT id, file_path, file_name, mime_type FROM public.documents');
  console.log(`   Found ${docs.length} document record(s) in DB`);

  let ok = 0, skip = 0, fail = 0;
  for (const doc of docs) {
    const localPath = path.join(UPLOAD_DIR, doc.file_path.replace(/\//g, path.sep));
    if (!fs.existsSync(localPath)) {
      console.log(`   ⚠️  File not found locally, skipping: ${doc.file_path}`);
      skip++;
      continue;
    }
    try {
      const mime = doc.mime_type || guessMime(doc.file_name);
      await uploadToSupabase(DOCS_BUCKET, doc.file_path, localPath, mime);
      console.log(`   ✅  ${doc.file_path}`);
      ok++;
    } catch (err) {
      console.error(`   ❌  ${doc.file_path}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\n   Documents: ${ok} uploaded, ${skip} skipped (not on disk), ${fail} failed`);
}

// ── migrate avatars ───────────────────────────────────────────────────────────
async function migrateAvatars() {
  console.log('\n🖼️   Migrating avatars → Supabase Storage bucket:', AVT_BUCKET);
  const { rows: profiles } = await db.query(
    `SELECT id, avatar_url FROM public.profiles WHERE avatar_url IS NOT NULL AND avatar_url LIKE '/api/profiles/avatar/%'`
  );
  console.log(`   Found ${profiles.length} local avatar(s) in DB`);

  let ok = 0, skip = 0, fail = 0;
  for (const profile of profiles) {
    const filename = path.basename(profile.avatar_url);
    const localPath = path.join(UPLOAD_DIR, 'avatars', filename);
    if (!fs.existsSync(localPath)) {
      console.log(`   ⚠️  Avatar not found locally, skipping: ${filename}`);
      skip++;
      continue;
    }
    try {
      // Derive userId from filename: avatar-{userId}-{ts}.ext
      const match = filename.match(/^avatar-([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)-\d+/);
      const userId = match ? match[1] : profile.id;
      const ext = path.extname(filename);
      const storagePath = `${userId}/avatar-migrated${ext}`;
      const mime = guessMime(filename);

      await uploadToSupabase(AVT_BUCKET, storagePath, localPath, mime);

      // Get the new public URL and update the DB
      const { data } = supabase.storage.from(AVT_BUCKET).getPublicUrl(storagePath);
      await db.query('UPDATE public.profiles SET avatar_url = $1 WHERE id = $2', [data.publicUrl, profile.id]);
      console.log(`   ✅  ${filename} → ${data.publicUrl}`);
      ok++;
    } catch (err) {
      console.error(`   ❌  ${filename}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\n   Avatars: ${ok} uploaded & DB updated, ${skip} skipped, ${fail} failed`);
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀  Starting upload migration to Supabase Storage...');
  console.log('   Supabase project:', SUPABASE_URL);
  try {
    await migrateDocs();
    await migrateAvatars();
    console.log('\n✅  Migration complete! Your files are now in Supabase Storage.');
    console.log('   You can now safely redeploy on Render.');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
  } finally {
    await db.end();
  }
})();
