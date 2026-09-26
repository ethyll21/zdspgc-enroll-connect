// Run this to fix the document_type enum on the actual DB
const db = require('../db.js');

async function run() {
  console.log('Checking document_type enum...');
  
  // Check current enum values
  const enumCheck = await db.query(`
    SELECT e.enumlabel 
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'document_type'
    ORDER BY e.enumsortorder
  `);
  
  if (enumCheck.rows.length > 0) {
    const existing = enumCheck.rows.map(r => r.enumlabel);
    console.log('Current enum values:', existing);
    
    const needed = ['psa_birth_certificate', 'form_138', 'good_moral', 'transfer_certificate', 'other', 'registration_form'];
    const missing = needed.filter(v => !existing.includes(v));
    
    if (missing.length > 0) {
      console.log('Missing values:', missing);
      for (const val of missing) {
        await db.query(`ALTER TYPE document_type ADD VALUE IF NOT EXISTS '${val}'`);
        console.log(`  Added: ${val}`);
      }
      console.log('Done! Enum fixed.');
    } else {
      console.log('All values present. Enum is OK.');
    }
  } else {
    console.log('No document_type enum found - doc_type is probably TEXT, which is fine.');
    // Test inserting with a cast to identify which schema we have
    try {
      await db.query(`SELECT 'good_moral'::document_type`);
      console.log('Cast to document_type works...');
    } catch (e) {
      console.log('No document_type enum exists (TEXT column). Cast should be removed from INSERT.');
    }
  }
}

run().catch(console.error).finally(() => process.exit(0));
