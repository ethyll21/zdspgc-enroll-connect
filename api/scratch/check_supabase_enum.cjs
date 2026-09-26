// Check actual enum values in Supabase (uses DATABASE_URL from environment)
// Run this locally with: node api/scratch/check_supabase_enum.cjs
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Use the same DATABASE_URL that Render uses
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function run() {
  try {
    // Check the document_type column type
    const colCheck = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='documents' AND column_name='doc_type'
    `);
    console.log('doc_type column:', colCheck.rows[0]);

    // If it's an enum, check values
    if (colCheck.rows[0]?.udt_name === 'document_type') {
      const enumVals = await pool.query(`
        SELECT e.enumlabel 
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'document_type'
        ORDER BY e.enumsortorder
      `);
      console.log('\nEnum values in document_type:');
      enumVals.rows.forEach(r => console.log(' -', r.enumlabel));

      // Generate migration SQL to add missing values
      const existing = new Set(enumVals.rows.map(r => r.enumlabel));
      const needed = ['psa_birth_certificate', 'form_138', 'good_moral', 'transfer_certificate', 'other', 'registration_form'];
      const missing = needed.filter(v => !existing.has(v));
      
      if (missing.length > 0) {
        console.log('\nMISSING from enum:', missing);
        console.log('\nSQL to fix:');
        missing.forEach(v => {
          console.log(`ALTER TYPE document_type ADD VALUE IF NOT EXISTS '${v}';`);
        });
      } else {
        console.log('\nAll values present in enum!');
      }
    } else {
      console.log('\ndoc_type is TEXT (not enum) - no cast needed.');
      // Try inserting with cast to confirm error
      try {
        await pool.query(`SELECT 'psa_birth_certificate'::document_type`);
        console.log('Cast works!');
      } catch (e) {
        console.log('Cast fails (expected for TEXT):', e.message);
      }
    }
  } finally {
    await pool.end();
  }
}
run().catch(console.error);
