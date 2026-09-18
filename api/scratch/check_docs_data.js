const db = require('../db');

async function main() {
  try {
    // List recent docs grouped by student
    const docsRes = await db.query(`
      SELECT d.id, d.student_id, d.enrollment_id, d.doc_type, d.file_name, d.status, d.uploaded_at
      FROM public.documents d
      ORDER BY d.uploaded_at DESC
      LIMIT 30
    `);
    console.log('Recent docs:', JSON.stringify(docsRes.rows, null, 2));

    // How many docs per student?
    const groupRes = await db.query(`
      SELECT student_id, COUNT(*) as total
      FROM public.documents
      GROUP BY student_id
      ORDER BY total DESC
      LIMIT 10
    `);
    console.log('Docs per student:', JSON.stringify(groupRes.rows, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
