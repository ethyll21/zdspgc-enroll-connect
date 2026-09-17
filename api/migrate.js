'use strict';

/**
 * Auto-migration: runs on server startup to create all required tables
 * in the production database using only the public schema.
 */

const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function runMigrations() {
  const client = await db.getClient();
  try {
    console.log('[Migration] Starting...');

    // ── 1. public.users (replaces auth.users) ───────────────────────────────────
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
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB;`);

    // ── 2. public.profiles ──────────────────────────────────────────────────────
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

    // ── 3. public.user_roles ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_roles (
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, role)
      );
    `);

    // ── 4. public.programs ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.programs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // ── 5. public.students ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE,
        student_no TEXT,
        first_name TEXT NOT NULL,
        middle_name TEXT,
        last_name TEXT NOT NULL,
        suffix TEXT,
        gender TEXT,
        date_of_birth DATE,
        place_of_birth TEXT,
        civil_status TEXT,
        religion TEXT,
        citizenship TEXT DEFAULT 'Filipino',
        address TEXT,
        postal_code TEXT,
        contact_number TEXT,
        email TEXT,
        program_id UUID,
        year_level TEXT,
        major TEXT,
        previous_school TEXT,
        family_background JSONB DEFAULT '{}',
        educational_background JSONB DEFAULT '{}',
        pledge_accepted BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // ── 6. public.enrollments ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL,
        school_year TEXT NOT NULL,
        semester TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        student_type TEXT DEFAULT 'new',
        date_enrolled DATE DEFAULT CURRENT_DATE,
        subjects JSONB DEFAULT '[]',
        total_units NUMERIC DEFAULT 0,
        advised_by TEXT,
        approved_by TEXT,
        rotc_watc JSONB DEFAULT '{}',
        remarks TEXT,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // ── 7. public.documents ─────────────────────────────────────────────────────
    // Create document_type enum if missing
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
          CREATE TYPE document_type AS ENUM (
            'birth_certificate', 'form138', 'good_moral', 'transfer_credentials',
            'id_photo', 'honorable_dismissal', 'other'
          );
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL,
        enrollment_id UUID,
        doc_type document_type,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        size_bytes BIGINT,
        status TEXT DEFAULT 'pending',
        remarks TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // ── 8. public.validation_records ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.validation_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        enrollment_id UUID NOT NULL,
        validated_by UUID,
        result TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // ── 9. public.notifications ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        link TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // ── 10. Seed programs (only ACT, BSIS, BPED) ────────────────────────────────
    const allowedPrograms = [
      ['ACT',  'Associate in Computer Technology'],
      ['BSIS', 'Bachelor of Science in Information Systems'],
      ['BPED', 'Bachelor of Physical Education'],
    ];
    for (const [code, name] of allowedPrograms) {
      await client.query(
        `INSERT INTO public.programs (code, name, active) VALUES ($1, $2, true)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = true`,
        [code, name]
      );
    }
    // Deactivate any other programs that may exist
    await client.query(
      `UPDATE public.programs SET active = false WHERE code NOT IN ('ACT', 'BSIS', 'BPED')`
    );

    // ── 11. Seed default admin user ─────────────────────────────────────────────
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
        `INSERT INTO public.profiles (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [adminId, adminEmail, 'Registrar Administrator']
      );
      await client.query(
        `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING`,
        [adminId]
      );
      await client.query('COMMIT');
      console.log('[Migration] Default admin created (email: admin@zdspgc.edu.ph, password: admin1234)');
    } else {
      console.log('[Migration] Admin user already exists.');
    }

    console.log('[Migration] All done.');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
    try { await client.query('ROLLBACK'); } catch {}
  } finally {
    try { client.release(); } catch {}
  }
}

module.exports = { runMigrations };
