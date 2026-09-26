const db = require('../db.js');
async function run() {
  const cols = await db.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='documents' 
    ORDER BY ordinal_position
  `);
  console.log('\n=== documents table columns ===');
  cols.rows.forEach(row => console.log(row.column_name, '|', row.data_type, '|', row.udt_name));

  const enumCheck = await db.query(`
    SELECT e.enumlabel 
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'document_type'
    ORDER BY e.enumsortorder
  `);
  if (enumCheck.rows.length > 0) {
    console.log('\n=== document_type enum values ===');
    enumCheck.rows.forEach(r => console.log(r.enumlabel));
  } else {
    console.log('\ndocument_type is NOT an enum (likely TEXT)');
  }
}
run().catch(console.error).finally(() => process.exit(0));
