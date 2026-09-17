'use strict';

/**
 * Auto-migration: runs on server startup to ensure the auth schema and all
 * required tables exist in the production database.
 */

const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function runMigrations() {
  const client = await db.getClient();
  try {
    console.log('[Migration] Checking schema...');

    // 1. Ensure auth schema exists
    await client.query('CREATE SCHEMA IF NOT EXISTS auth;');

    // 2. Ensure auth.users table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT,
        raw_user_meta_data JSONB,
        is_active BOOLEAN NOT NULL DEFAULT true,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. Add any missing columns (idempotent)
    await client.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await client.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;`);

    // 4. Ensure app_role type exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
          CREATE TYPE app_role AS ENUM ('student', 'admin');
        END IF;
      END $$;
    `);

    // 5. Ensure public.profiles table exists
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

    // 6. Ensure public.user_roles table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_roles (
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, role)
      );
    `);

    // 7. Ensure handle_new_user trigger function exists
    await client.query(`
      CREATE OR REPLACE FUNCTION handle_new_user()
      RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', '')
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'student')
        ON CONFLICT (user_id, role) DO NOTHING;

        RETURN NEW;
      END;
      $$;
    `);

    // 8. Ensure trigger is attached
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'on_auth_user_created'
          AND tgrelid = 'auth.users'::regclass
        ) THEN
          CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION handle_new_user();
        END IF;
      END $$;
    `);

    // 9. Seed default admin user if it doesn't exist
    const adminEmail = 'admin@zdspgc.edu.ph';
    const adminRes = await client.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
    if (adminRes.rows.length === 0) {
      console.log('[Migration] Creating default admin user...');
      const adminId = uuidv4();
      const hash = await bcrypt.hash('admin1234', 12);

      await client.query('BEGIN');

      await client.query(
        `INSERT INTO auth.users (id, email, password_hash, raw_user_meta_data, is_active, email_verified)
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
    }

    console.log('[Migration] Done.');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
    // Don't crash the server on migration failure — log and continue
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
