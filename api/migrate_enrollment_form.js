/**
 * Migration: Add new columns to the students table
 * to match the ZDSPGC College Enrollment Form fields.
 *
 * Run with:  node api/migrate_enrollment_form.js
 */
const db = require('./db');

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Adding new columns to students table...');

    // Simple personal info columns
    await client.query(`
      ALTER TABLE public.students
        ADD COLUMN IF NOT EXISTS suffix VARCHAR(10),
        ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(255),
        ADD COLUMN IF NOT EXISTS civil_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS religion VARCHAR(100),
        ADD COLUMN IF NOT EXISTS citizenship VARCHAR(100) DEFAULT 'Filipino',
        ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS major VARCHAR(255);
    `);
    console.log('  ✓ Personal info columns added');

    // JSONB columns for complex nested data
    await client.query(`
      ALTER TABLE public.students
        ADD COLUMN IF NOT EXISTS family_background JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS educational_background JSONB DEFAULT '{}';
    `);
    console.log('  ✓ JSONB columns added (family_background, educational_background)');

    // Pledge acceptance
    await client.query(`
      ALTER TABLE public.students
        ADD COLUMN IF NOT EXISTS pledge_accepted BOOLEAN DEFAULT false;
    `);
    console.log('  ✓ pledge_accepted column added');

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
