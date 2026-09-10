const db = require('../db');

async function fixStudentType() {
  const client = await db.getClient();
  try {
    const res = await client.query("UPDATE public.enrollments SET student_type = 'new' WHERE id = '39257ae5-509f-4b52-bfed-e4a87e804f44'");
    console.log('Updated rows:', res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

fixStudentType();
