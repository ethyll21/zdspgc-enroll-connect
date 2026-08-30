const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'PRE-ENROLLMENT_DB',
  user: 'postgres',
  password: 'ANGELYN212121',
});

async function check() {
  try {
    const r = await pool.query(
      'SELECT id, first_name, last_name, family_background, educational_background FROM public.students LIMIT 3'
    );
    r.rows.forEach(row => {
      console.log('Student:', row.first_name, row.last_name);
      console.log('family_background:', JSON.stringify(row.family_background));
      console.log('educational_background:', JSON.stringify(row.educational_background));
      console.log('---');
    });
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
check();
