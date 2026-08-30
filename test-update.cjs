const db = require('./api/db');

async function test() {
  try {
    const { rows } = await db.query('UPDATE public.notifications SET read = true RETURNING *');
    console.log('Updated notifications:', rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}
test();
