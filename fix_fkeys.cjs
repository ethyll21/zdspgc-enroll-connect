const db = require('./api/db');

async function fixConstraints() {
  const client = await db.getClient();
  try {
    console.log('Checking foreign keys for public.profiles...');
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'public.profiles'::regclass;
    `);
    console.log(res.rows);
    
    // If it points to auth.users, drop it and add to public.users
    for (const row of res.rows) {
      if (row.pg_get_constraintdef.includes('auth.users')) {
        console.log('Dropping constraint ' + row.conname);
        await client.query(`ALTER TABLE public.profiles DROP CONSTRAINT "${row.conname}"`);
        console.log('Adding constraint to public.users');
        await client.query(`ALTER TABLE public.profiles ADD CONSTRAINT "${row.conname}" FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE`);
      }
    }
    
    console.log('Checking user_roles...');
    const res2 = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      WHERE conrelid = 'public.user_roles'::regclass;
    `);
    console.log(res2.rows);
    
    for (const row of res2.rows) {
      if (row.pg_get_constraintdef.includes('auth.users')) {
        console.log('Dropping constraint ' + row.conname);
        await client.query(`ALTER TABLE public.user_roles DROP CONSTRAINT "${row.conname}"`);
        console.log('Adding constraint to public.users');
        await client.query(`ALTER TABLE public.user_roles ADD CONSTRAINT "${row.conname}" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
}

fixConstraints().then(() => process.exit(0));
