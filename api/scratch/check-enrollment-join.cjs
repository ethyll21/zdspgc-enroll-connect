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
    // Check what the enrollment JOIN returns (mimicking the updated API query)
    const r = await pool.query(`
      SELECT e.id, e.student_id, 
             s.first_name, s.last_name,
             s.family_background, s.educational_background,
             s.civil_status, s.religion, s.place_of_birth,
             s.contact_number, s.postal_code, s.address
      FROM public.enrollments e
      JOIN public.students s ON s.id = e.student_id
      LIMIT 5
    `);
    r.rows.forEach(row => {
      console.log('Enrollment:', row.id);
      console.log('Student:', row.first_name, row.last_name);
      console.log('family_background:', JSON.stringify(row.family_background));
      console.log('educational_background:', JSON.stringify(row.educational_background));
      console.log('civil_status:', row.civil_status);
      console.log('place_of_birth:', row.place_of_birth);
      console.log('---');
    });
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
check();
