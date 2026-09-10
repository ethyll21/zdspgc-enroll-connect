/**
 * Migration: Add columns to support the Old Student Enrollment Form
 * including subject schedule table, total units, ROTC/WATC, and signatories.
 *
 * Run with: node api/migrate_old_student_form.js
 */
const db = require('./db');

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Adding new columns to enrollments table...');

    await client.query(`
      ALTER TABLE public.enrollments
        ADD COLUMN IF NOT EXISTS student_type VARCHAR(50) DEFAULT 'new',
        ADD COLUMN IF NOT EXISTS date_enrolled DATE DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS total_units NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS advised_by VARCHAR(255) DEFAULT 'JOANNAH LEA S. LAMBAN',
        ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255) DEFAULT 'JEFFRYL DAVE S. ALBELLAR (Registrar)',
        ADD COLUMN IF NOT EXISTS rotc_watc JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('  ✓ Enrollments table updated with Old Student fields');

    // Also ensure student_no exists and has no restrictive issues on students
    await client.query(`
      ALTER TABLE public.students
        ADD COLUMN IF NOT EXISTS student_no VARCHAR(100);
    `);
    console.log('  ✓ Students table checked for student_no');

    await client.query('COMMIT');
    console.log('\n✅ Migration for Old Student form completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
