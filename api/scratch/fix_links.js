const db = require('../db');

async function fixLinks() {
  const client = await db.getClient();
  try {
    const { rows } = await client.query('SELECT id, user_id FROM public.notifications WHERE link IS NULL');
    
    for (const notif of rows) {
      // Find the most recent enrollment for this user
      const enrollRes = await client.query(`
        SELECT e.id
        FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.user_id = $1
        ORDER BY e.submitted_at DESC
        LIMIT 1
      `, [notif.user_id]);

      let link = '/dashboard';
      if (enrollRes.rows.length > 0) {
        link = `/applications/${enrollRes.rows[0].id}`;
      }

      await client.query('UPDATE public.notifications SET link = $1 WHERE id = $2', [link, notif.id]);
      console.log(`Updated notification ${notif.id} with link ${link}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

fixLinks();
