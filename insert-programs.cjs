const db = require('./api/db');

async function run() {
  try {
    await db.query(`
      INSERT INTO programs (code, name, description) 
      VALUES 
        ('ACT', 'Associate in Computer Technology', 'ACT Program'), 
        ('BSIS', 'Bachelor of Science in Information System', 'BSIS Program'), 
        ('BPED', 'Bachelor of Science in Physical Education', 'BPED Program') 
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
