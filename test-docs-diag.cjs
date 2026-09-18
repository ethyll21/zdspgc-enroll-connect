const db = require('./api/db.js');
async function run() {
  const enrollment_id = 'dd78363a-64da-4852-8c15-1ea878ae4145';

  console.log('--- Simulating NEW admin query (by enrollment_id) ---');
  const r1 = await db.query(
    `SELECT d.*, s.student_no, s.first_name, s.last_name
     FROM public.documents d
     JOIN public.students s ON s.id = d.student_id
     WHERE d.enrollment_id = $1
     ORDER BY d.uploaded_at DESC`,
    [enrollment_id]
  );
  console.log('Documents found:', r1.rows.length);
  r1.rows.forEach(r => console.log(' -', r.doc_type, '|', r.file_name));

  console.log('\n--- Simulating GET /my (student view) with uploaded_at ---');
  const r2 = await db.query(
    `SELECT d.* FROM public.documents d
     JOIN public.students s ON s.id = d.student_id
     WHERE d.enrollment_id = $1
     ORDER BY d.uploaded_at DESC`,
    [enrollment_id]
  );
  console.log('Documents found:', r2.rows.length);

  process.exit(0);
}
run();
