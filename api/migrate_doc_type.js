const db = require('./db');

async function migrate() {
  try {
    await db.query("ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'registration_form'");
    console.log('  ✓ registration_form added to document_type enum');
  } catch (err) {
    console.log('  Note on enum:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
