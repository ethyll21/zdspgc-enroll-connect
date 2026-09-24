// ─── Supabase Storage client (server-side) ────────────────────────────────────
// Uses the service role key to bypass RLS for server-to-server uploads.
// NEVER expose SUPABASE_SERVICE_KEY to the browser.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    '[storage] SUPABASE_URL or SUPABASE_SERVICE_KEY is missing. ' +
    'File uploads will fail until these are set in your environment.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Bucket names
const DOCS_BUCKET   = 'student-documents';
const AVATAR_BUCKET = 'avatars';

/**
 * Upload a buffer/stream to Supabase Storage.
 * @param {string} bucket - Bucket name
 * @param {string} storagePath - e.g. "userId/filename.jpg"
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadFile(bucket, storagePath, buffer, mimeType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} bucket
 * @param {string} storagePath
 */
async function deleteFile(bucket, storagePath) {
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) console.warn(`[storage] Delete failed (non-fatal): ${error.message}`);
}

/**
 * Download a file from Supabase Storage and return its buffer + content-type.
 * Used for serving private/protected files through the Express API.
 * @param {string} bucket
 * @param {string} storagePath
 * @returns {Promise<{ data: Blob, error: any }>}
 */
async function downloadFile(bucket, storagePath) {
  return supabase.storage.from(bucket).download(storagePath);
}

module.exports = { supabase, uploadFile, deleteFile, downloadFile, DOCS_BUCKET, AVATAR_BUCKET };
