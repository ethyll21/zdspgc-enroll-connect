const db = require('../db');

async function main() {
  try {
    // Check document_type enum values
    const enumRes = await db.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
      ORDER BY enumsortorder
    `);
    console.log('document_type enum values:', JSON.stringify(enumRes.rows.map(r => r.enumlabel)));

    // Check document_status enum values
    const statusRes = await db.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_status')
      ORDER BY enumsortorder
    `).catch(() => ({ rows: [] }));
    console.log('document_status enum values:', JSON.stringify(statusRes.rows.map(r => r.enumlabel)));

    // Check the doc_type of the status column
    const colTypeRes = await db.query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='documents'
        AND column_name IN ('doc_type', 'status')
    `);
    console.log('Column types:', JSON.stringify(colTypeRes.rows));

    // Test upload with psa_birth_certificate
    console.log('\nTesting insert with doc_type psa_birth_certificate...');
    try {
      const testRes = await db.query(`
        SELECT 'psa_birth_certificate'::document_type as test
      `);
      console.log('psa_birth_certificate cast result:', testRes.rows[0].test);
    } catch (e) {
      console.log('psa_birth_certificate cast FAILED:', e.message);
    }

    try {
      const testRes = await db.query(`
        SELECT 'form_138'::document_type as test
      `);
      console.log('form_138 cast result:', testRes.rows[0].test);
    } catch (e) {
      console.log('form_138 cast FAILED:', e.message);
    }

    try {
      const testRes = await db.query(`
        SELECT 'birth_certificate'::document_type as test
      `);
      console.log('birth_certificate cast result:', testRes.rows[0].test);
    } catch (e) {
      console.log('birth_certificate cast FAILED:', e.message);
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
