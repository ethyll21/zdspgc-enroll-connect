// Fix document_type enum in Supabase
// This adds missing enum values to match what the app sends
const { Pool } = require('pg');

// Use the Supabase transaction pooler URL format
// You need to set DATABASE_URL env var or hardcode the Supabase DB URL here
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var not set');
  console.error('Run as: DATABASE_URL="postgresql://..." node api/scratch/fix_supabase_enum.cjs');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check what doc_type column type actually is
    const colRes = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='documents' AND column_name='doc_type'
    `);
    
    if (colRes.rows.length === 0) {
      console.log('ERROR: documents table or doc_type column not found!');
      return;
    }
    
    const col = colRes.rows[0];
    console.log('doc_type column:', col);

    if (col.udt_name === 'document_type') {
      // It's an enum - check values
      const enumRes = await client.query(`
        SELECT e.enumlabel 
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'document_type'
        ORDER BY e.enumsortorder
      `);
      
      const existing = new Set(enumRes.rows.map(r => r.enumlabel));
      console.log('\nCurrent enum values:', [...existing]);
      
      const needed = ['psa_birth_certificate', 'form_138', 'good_moral', 'transfer_certificate', 'other', 'registration_form'];
      const missing = needed.filter(v => !existing.has(v));
      
      if (missing.length > 0) {
        console.log('\nAdding missing enum values:', missing);
        for (const val of missing) {
          await client.query(`ALTER TYPE document_type ADD VALUE IF NOT EXISTS '${val}'`);
          console.log(`  Added: ${val}`);
        }
        console.log('\nDone! All enum values now present.');
      } else {
        console.log('\nAll values already in enum! Problem may be elsewhere.');
      }
    } else {
      console.log('\ndoc_type is TEXT (not enum). Cast should not be needed.');
      // Test if ::document_type cast works
      try {
        await client.query(`SELECT 'good_moral'::document_type`);
        console.log('Cast works for good_moral - enum exists globally');
        // Try others
        const testVals = ['psa_birth_certificate', 'form_138', 'transfer_certificate'];
        for (const v of testVals) {
          try {
            await client.query(`SELECT '${v}'::document_type`);
            console.log(`Cast OK for: ${v}`);
          } catch (e) {
            console.log(`Cast FAILS for: ${v} - ${e.message}`);
          }
        }
      } catch (e) {
        console.log('Cast fails entirely - no document_type enum exists:', e.message);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
