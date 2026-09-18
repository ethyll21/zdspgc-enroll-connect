const db = require('./api/db.js');

async function run() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // 1. Insert missing users from auth.users to public.users
    // We handle email conflicts by appending their ID to the email so the unique constraint passes
    await client.query(`
      INSERT INTO public.users (id, email, password_hash, is_active, created_at, email_verified, raw_user_meta_data)
      SELECT 
        a.id, 
        CASE 
          WHEN p.id IS NOT NULL THEN a.email || '-' || a.id
          ELSE a.email 
        END,
        '', 
        true, 
        NOW(),
        true,
        '{}'::jsonb
      FROM auth.users a
      LEFT JOIN public.users p ON p.email = a.email
      WHERE a.id NOT IN (SELECT id FROM public.users)
    `);
    
    // 2. Drop the old constraint
    await client.query(`ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_user_id_fkey`);
    
    // 3. Add the new constraint pointing to public.users
    await client.query(`ALTER TABLE public.students ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE`);
    
    await client.query('COMMIT');
    console.log('Successfully updated foreign key constraint to use public.users!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update constraint:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
