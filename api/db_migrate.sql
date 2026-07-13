-- Migration: Add local auth fields to auth.users
-- This enables full local JWT authentication without Supabase

-- 1. Add password_hash column to auth.users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Add is_active flag
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 3. Add email_verified flag
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- 4. Ensure email is not null and unique
ALTER TABLE auth.users ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role'
  ) THEN
    CREATE TYPE app_role AS ENUM ('student', 'admin');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key' AND conrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE auth.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END
$$;

-- 5. Update handle_new_user trigger to accept password_hash from raw_user_meta_data
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

-- 6. Create a function to verify password (for use in API)
CREATE OR REPLACE FUNCTION auth.verify_password(p_email TEXT, p_password_hash TEXT)
RETURNS TABLE(id UUID, email TEXT, raw_user_meta_data JSONB, is_active BOOLEAN)
LANGUAGE SQL SECURITY DEFINER SET search_path = auth AS $$
  SELECT u.id, u.email, u.raw_user_meta_data, u.is_active
  FROM auth.users u
  WHERE u.email = p_email
    AND u.password_hash = p_password_hash
    AND u.is_active = true;
$$;

-- 7. Grant access
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT ALL ON auth.users TO postgres;
