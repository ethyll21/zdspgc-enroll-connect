const db = require('./api/db.js');

async function run() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const fixes = [
      { table: 'notifications', column: 'user_id', constraint: 'notifications_user_id_fkey' },
      { table: 'audit_logs', column: 'user_id', constraint: 'audit_logs_user_id_fkey' },
      { table: 'enrollments', column: 'reviewed_by', constraint: 'enrollments_reviewed_by_fkey' },
      { table: 'documents', column: 'reviewed_by', constraint: 'documents_reviewed_by_fkey' },
      { table: 'validation_records', column: 'validated_by', constraint: 'validation_records_validated_by_fkey' },
    ];

    for (const f of fixes) {
      console.log(`Fixing constraint ${f.constraint} on table ${f.table} (${f.column})...`);
      await client.query(`ALTER TABLE public.${f.table} DROP CONSTRAINT IF EXISTS ${f.constraint}`);
      await client.query(`ALTER TABLE public.${f.table} ADD CONSTRAINT ${f.constraint} FOREIGN KEY (${f.column}) REFERENCES public.users(id) ON DELETE CASCADE`);
    }

    await client.query('COMMIT');
    console.log('Successfully updated constraints to use public.users!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update constraints:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
