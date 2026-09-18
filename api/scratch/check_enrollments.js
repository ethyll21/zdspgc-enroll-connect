const db = require('../db');

async function main() {
  try {
    // Check latest enrollments and their student_types
    const res = await db.query(`
      SELECT e.id, e.student_id, e.student_type, e.status, e.submitted_at,
             s.first_name, s.last_name
      FROM public.enrollments e
      JOIN public.students s ON s.id = e.student_id
      ORDER BY e.submitted_at DESC
      LIMIT 15
    `);
    console.log('Recent enrollments:', JSON.stringify(res.rows, null, 2));

    // For enrollments with docs, how many docs?
    const docsPerEnroll = await db.query(`
      SELECT e.id as enrollment_id, e.student_type, e.status,
             COUNT(d.id) as doc_count
      FROM public.enrollments e
      LEFT JOIN public.documents d ON d.student_id = e.student_id
      GROUP BY e.id, e.student_type, e.status
      ORDER BY doc_count DESC
      LIMIT 10
    `);
    console.log('Enrollments with doc counts:', JSON.stringify(docsPerEnroll.rows, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
