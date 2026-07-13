const db = require('./api/db');

async function run() {
  try {
    const page = 1;
    const limit = 50;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    const where = '';
    params.push(parseInt(limit), offset);

    const query = `SELECT e.*, s.student_no, s.first_name, s.last_name, s.email AS student_email,
              p.code AS program_code, p.name AS program_name
       FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       LEFT JOIN public.programs p ON p.id = s.program_id
       ${where}
       ORDER BY e.submitted_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`;

    console.log('Query:', query);
    console.log('Params:', params);
    const { rows } = await db.query(query, params);
    console.log('Rows returned:', rows.length);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

run();
