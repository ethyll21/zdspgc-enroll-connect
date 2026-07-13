const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ── Load .env manually ────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const client = new Client({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'PRE-ENROLLMENT_DB',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'ANGELYN212121',
});

async function main() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected successfully!');

  // 1. Ensure auth schema exists
  console.log('Creating auth schema if not exists...');
  await client.query('CREATE SCHEMA IF NOT EXISTS auth;');

  // 2. Ensure auth.users table exists
  console.log('Creating auth.users table if not exists...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT,
      raw_user_meta_data JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 3. Read and execute api/db_migrate.sql
  const migrationSqlPath = path.join(__dirname, 'db_migrate.sql');
  console.log(`Reading migration SQL from ${migrationSqlPath}...`);
  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

  console.log('Executing migration SQL...');
  await client.query(migrationSql);
  console.log('Migration SQL executed successfully!');

  // 4. Check if we need to create an admin user
  const adminEmail = 'admin@zdspgc.edu.ph';
  const adminRes = await client.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
  if (adminRes.rows.length === 0) {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    
    console.log(`Creating default admin user (${adminEmail})...`);
    const adminId = uuidv4();
    const hash = await bcrypt.hash('admin1234', 12);
    
    await client.query('BEGIN');
    
    // Insert into auth.users
    await client.query(`
      INSERT INTO auth.users (id, email, password_hash, raw_user_meta_data, is_active, email_verified)
      VALUES ($1, $2, $3, $4::jsonb, true, true)
    `, [adminId, adminEmail, hash, JSON.stringify({ full_name: 'Registrar Administrator' })]);

    // Insert profile (if handle_new_user trigger is not already doing it)
    await client.query(`
      INSERT INTO public.profiles (id, email, full_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `, [adminId, adminEmail, 'Registrar Administrator']);

    // Set role to admin
    await client.query(`
      INSERT INTO public.user_roles (user_id, role)
      VALUES ($1, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING
    `, [adminId]);

    await client.query('COMMIT');
    console.log('Admin user created successfully! (password: admin1234)');
  } else {
    console.log('Admin user already exists.');
  }

  await client.end();
  console.log('Done!');
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
