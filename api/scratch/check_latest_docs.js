const db = require('../db');

async function main() {
  try {
    // Get the latest new-student enrollment
    const enRes = await db.query(`
      SELECT e.id, e.student_id, e.student_type, e.status, e.submitted_at,
             s.first_name, s.last_name
      FROM public.enrollments e
      JOIN public.students s ON s.id = e.student_id
      WHERE e.student_type = 'new'
      ORDER BY e.submitted_at DESC
      LIMIT 5
    `);
    console.log('Latest new enrollments:', JSON.stringify(enRes.rows, null, 2));

    // For each, show their documents
    for (const en of enRes.rows) {
      const docRes = await db.query(`
        SELECT id, doc_type, file_name, status, enrollment_id, uploaded_at
        FROM public.documents
        WHERE student_id = $1
        ORDER BY uploaded_at DESC
      `, [en.student_id]);
      console.log(`\nDocs for ${en.first_name} ${en.last_name} (enrollment: ${en.id}):`, JSON.stringify(docRes.rows, null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
