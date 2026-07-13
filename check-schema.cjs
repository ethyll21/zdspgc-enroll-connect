const db = require('./api/db');

async function run() {
  try {
    const { rows } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='students'");
    console.log(rows.map(r => r.column_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
