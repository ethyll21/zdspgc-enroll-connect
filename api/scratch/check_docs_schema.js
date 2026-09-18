const db = require('../db');

async function main() {
  try {
    const colRes = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='documents' 
      ORDER BY ordinal_position
    `);
    console.log('COLUMNS:', JSON.stringify(colRes.rows, null, 2));

    const idxRes = await db.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename='documents' AND schemaname='public'
    `);
    console.log('INDEXES:', JSON.stringify(idxRes.rows, null, 2));

    const conRes = await db.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.documents'::regclass
    `);
    console.log('CONSTRAINTS:', JSON.stringify(conRes.rows, null, 2));

    const countRes = await db.query(`SELECT COUNT(*) as total FROM public.documents`);
    console.log('Total docs in DB:', countRes.rows[0].total);

    const docsRes = await db.query(`
      SELECT id, student_id, doc_type, file_name, status, created_at
      FROM public.documents
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.log('Recent docs:', JSON.stringify(docsRes.rows, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
