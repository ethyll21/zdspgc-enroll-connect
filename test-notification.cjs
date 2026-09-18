const db = require('./api/db.js');

async function run() {
  try {
    const adminRes = await db.query(`SELECT user_id FROM public.user_roles WHERE role = 'admin'`);
    for (const adminRow of adminRes.rows) {
      await db.query(
        `INSERT INTO public.notifications (user_id, title, message, link)
         VALUES ($1, $2, $3, $4)`,
        [
          adminRow.user_id,
          'New Application Submitted',
          'A new enrollment application has been submitted and is waiting for your review.',
          '/admin/review/test-id'
        ]
      );
    }
    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
