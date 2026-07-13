const db = require('./db.js');
async function run() {
  const c = await db.getClient();
  try {
    const e = await c.query('SELECT e.id, e.student_id, s.id as sid FROM enrollments e LEFT JOIN students s ON s.id = e.student_id');
    console.log("Enrollments:", e.rows);
    const s = await c.query("SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending, COUNT(*) AS total FROM enrollments");
    console.log("Stats:", s.rows);
  } finally {
    c.release();
    process.exit(0);
  }
}
run();
