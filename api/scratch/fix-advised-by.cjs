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
    // First, see what values currently exist
    const check = await pool.query(
      `SELECT DISTINCT advised_by, COUNT(*) as count FROM public.enrollments GROUP BY advised_by`
    );
    console.log('Current advised_by values:', check.rows);

    // Update any old name to the new name
    const result = await pool.query(
      `UPDATE public.enrollments 
       SET advised_by = 'JOANNAH LEA S. LAMBAN'
       WHERE advised_by != 'JOANNAH LEA S. LAMBAN' OR advised_by IS NULL`
    );
    console.log('Rows updated:', result.rowCount);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fix();
