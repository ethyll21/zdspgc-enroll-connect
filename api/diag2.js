const db = require('./db.js');
async function run() {
  const c = await db.getClient();
  try {
    const e = await c.query('SELECT id FROM enrollments LIMIT 1');
    if (e.rows.length === 0) {
      console.log("No enrollments exist!");
      return;
    }
    const id = e.rows[0].id;
    console.log("Using id:", id);
    const q = await c.query(`SELECT e.*, s.student_no, s.first_name, s.last_name, s.user_id,
              p.code AS program_code, p.name AS program_name
       FROM public.enrollments e
       JOIN public.students s ON s.id = e.student_id
       LEFT JOIN public.programs p ON p.id = s.program_id
       WHERE e.id = $1`, [id]);
    console.log("Result:", q.rows);
  } catch(err) { console.error(err); } finally {
    c.release(); process.exit();
  }
}
run();
