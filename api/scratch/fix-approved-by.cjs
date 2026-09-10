const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'PRE-ENROLLMENT_DB',
  user: 'postgres',
  password: 'ANGELYN212121',
});

async function fix() {
  try {
    const check = await pool.query(
      `SELECT DISTINCT approved_by, COUNT(*) as count FROM public.enrollments GROUP BY approved_by`
    );
    console.log('Current approved_by values:', check.rows);

    const result = await pool.query(
      `UPDATE public.enrollments 
       SET approved_by = REPLACE(approved_by, ' (Registrar)', '')
       WHERE approved_by LIKE '%(Registrar)%'`
    );
    console.log('Rows updated:', result.rowCount);

    const after = await pool.query(
      `SELECT DISTINCT approved_by FROM public.enrollments`
    );
    console.log('After update:', after.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fix();
