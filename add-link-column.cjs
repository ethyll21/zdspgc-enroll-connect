const db = require('./api/db');

async function main() {
  try {
    console.log('Adding link column to notifications table...');
    await db.query(`ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;`);
    console.log('Column added successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error adding column:', err);
    process.exit(1);
  }
}

main();
