'use strict';

/**
 * Auto-migration: runs on server startup to ensure all required tables
 * exist in the production database using only the public schema.
 */

const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function runMigrations() {
  const client = await db.getClient();
  try {
    console.log('[Migration] Checking schema...');

    // 1. Ensure public.users table exists (replaces auth.users — avoids schema permission issues)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT,
        raw_user_meta_data JSONB,
        is_active BOOLEAN NOT NULL DEFAULT true,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Add any missing columns (idempotent)
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB;`);

    // 3. Ensure public.profiles table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT DEFAULT '',
        contact_number TEXT,
        birthdate DATE,
        gender TEXT,
        address TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Ensure public.user_roles table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_roles (
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, role)
      );
    `);

    // 5. Seed default admin user if it doesn't exist
    const adminEmail = 'admin@zdspgc.edu.ph';
    const adminRes = await client.query('SELECT id FROM public.users WHERE email = $1', [adminEmail]);
    if (adminRes.rows.length === 0) {
      console.log('[Migration] Creating default admin user...');
      const adminId = uuidv4();
      const hash = await bcrypt.hash('admin1234', 12);

      await client.query('BEGIN');

      await client.query(
        `INSERT INTO public.users (id, email, password_hash, raw_user_meta_data, is_active, email_verified)
         VALUES ($1, $2, $3, $4::jsonb, true, true)`,
        [adminId, adminEmail, hash, JSON.stringify({ full_name: 'Registrar Administrator' })]
      );

      await client.query(
        `INSERT INTO public.profiles (id, email, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [adminId, adminEmail, 'Registrar Administrator']
      );

      await client.query(
        `INSERT INTO public.user_roles (user_id, role)
         VALUES ($1, 'admin')
         ON CONFLICT (user_id, role) DO NOTHING`,
        [adminId]
      );

      await client.query('COMMIT');
      console.log('[Migration] Default admin created (email: admin@zdspgc.edu.ph, password: admin1234)');
    } else {
      console.log('[Migration] Admin user already exists.');
    }

    console.log('[Migration] Done.');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
    try { await client.query('ROLLBACK'); } catch {}
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
