const { query } = require('./api/db');

async function test() {
  try {
    const res = await query('SELECT * FROM enrollments LIMIT 1');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit();
}
test();
