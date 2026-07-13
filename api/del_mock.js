const db = require('./db.js');

async function run() {
  const client = await db.getClient();
  try {
    const emails = ['maria@zdspgc.edu.ph', 'juan@zdspgc.edu.ph', 'pedro@zdspgc.edu.ph', 'luna@zdspgc.edu.ph'];
    for (const email of emails) {
      await client.query('DELETE FROM auth.users WHERE email = $1', [email]);
      console.log(`Deleted user: ${email}`);
    }
  } catch(err) {
    console.error('Error deleting mock data:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
