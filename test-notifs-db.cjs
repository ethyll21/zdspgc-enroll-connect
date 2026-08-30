const db = require('./api/db');

async function test() {
  const { rows } = await db.query('SELECT * FROM public.notifications');
  console.log('Notifications:', rows);
  process.exit();
}
test();
