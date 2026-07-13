const db = require('./api/db');

async function run() {
  try {
    await db.query(`
      INSERT INTO programs (code, name) 
      VALUES 
        ('ACT', 'Associate in Computer Technology'), 
        ('BSIS', 'Bachelor of Science in Information System'), 
        ('BPED', 'Bachelor of Science in Physical Education') 
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('Programs inserted successfully.');
  } catch (err) {
    console.error('Error inserting programs:', err);
  } finally {
    process.exit(0);
  }
}

run();
