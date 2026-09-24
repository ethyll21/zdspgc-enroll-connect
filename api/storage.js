// ─── Supabase Storage client (server-side) ────────────────────────────────────
// Uses the service role key to bypass RLS for server-to-server uploads.
// NEVER expose SUPABASE_SERVICE_KEY to the browser.

const { createClient } = require('@supabase/supabase-js');

// Bucket names
const DOCS_BUCKET   = 'student-documents';
const AVATAR_BUCKET = 'avatars';

// Lazy client — only created on first use to avoid crashing on missing env vars
let _supabase = null;
function getClient() {
  if (_supabase) return _supabase;
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your-supabase-service-role-key-here') {
    throw new Error(
      '[storage] SUPABASE_URL or SUPABASE_SERVICE_KEY is not set. ' +
      'Add it to your Render environment variables.'
    );
  }
  
  // Clean up URL to prevent "Invalid path specified in request URL" errors
  // Trims spaces/newlines and removes any trailing slashes
  url = url.trim().replace(/\/+$/, '');

  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

/**
 * Upload a buffer to Supabase Storage.
 */
async function uploadFile(bucket, storagePath, buffer, mimeType) {
  const { error } = await getClient().storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = getClient().storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
async function deleteFile(bucket, storagePath) {
  try {
    const { error } = await getClient().storage.from(bucket).remove([storagePath]);
    if (error) console.warn(`[storage] Delete failed (non-fatal): ${error.message}`);
  } catch (err) {
    console.warn(`[storage] Delete skipped (non-fatal): ${err.message}`);
  }
}

/**
 * Download a file from Supabase Storage (for auth-gated serving).
 */
async function downloadFile(bucket, storagePath) {
  return getClient().storage.from(bucket).download(storagePath);
}

module.exports = { uploadFile, deleteFile, downloadFile, DOCS_BUCKET, AVATAR_BUCKET };

