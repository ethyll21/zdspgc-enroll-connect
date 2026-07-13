const db = require('./api/db');

async function run() {
  try {
    const { rows: students } = await db.query('SELECT * FROM public.students');
    console.log('--- Students ---');
    console.log(JSON.stringify(students, null, 2));

    const { rows: enrollments } = await db.query('SELECT * FROM public.enrollments');
    console.log('--- Enrollments ---');
    console.log(JSON.stringify(enrollments, null, 2));
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

run();
