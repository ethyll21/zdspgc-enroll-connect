const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'PRE-ENROLLMENT_DB',
  user: 'postgres',
  password: 'ANGELYN212121',
});

async function run() {
  await client.connect();
  console.log('Connected.');
  
  await client.query(`
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthdate DATE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `);
  
  console.log('Columns added.');
  await client.end();
}

run().catch(console.error);
