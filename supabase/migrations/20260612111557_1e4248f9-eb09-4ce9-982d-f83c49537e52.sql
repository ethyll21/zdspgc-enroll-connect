
-- Roles
CREATE TYPE public.app_role AS ENUM ('student', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  contact_number TEXT,
  birthdate DATE,
  gender TEXT,
  address TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles self select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles self insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles self update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + assign student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Programs
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Programs readable by signed in" ON public.programs
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Programs admin manage" ON public.programs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.programs (code, name, description) VALUES
  ('BSED', 'Bachelor of Secondary Education', 'Four-year teacher education program'),
  ('BEED', 'Bachelor of Elementary Education', 'Four-year teacher education program'),
  ('BSIT', 'Bachelor of Science in Information Technology', 'Four-year IT degree program'),
  ('BSCRIM', 'Bachelor of Science in Criminology', 'Four-year criminology program'),
  ('BSBA', 'Bachelor of Science in Business Administration', 'Four-year business program');

-- Application status enum
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected', 'correction');
CREATE TYPE public.document_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.student_type AS ENUM ('new', 'transferee', 'returnee', 'old');

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id),
  year_level TEXT NOT NULL,
  student_type public.student_type NOT NULL DEFAULT 'new',
  previous_school TEXT,
  previous_school_address TEXT,
  year_graduated TEXT,
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  semester TEXT NOT NULL DEFAULT '1st Semester',
  status public.application_status NOT NULL DEFAULT 'pending',
  admin_remarks TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apps student select" ON public.applications
  FOR SELECT TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Apps student insert" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Apps student update" ON public.applications
  FOR UPDATE TO authenticated
  USING ((auth.uid() = student_id AND status IN ('pending','correction')) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Apps student delete" ON public.applications
  FOR DELETE TO authenticated USING (auth.uid() = student_id AND status = 'pending');

CREATE TRIGGER applications_set_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Documents
CREATE TABLE public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status public.document_status NOT NULL DEFAULT 'pending',
  remarks TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
GRANT ALL ON public.application_documents TO service_role;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docs student select" ON public.application_documents
  FOR SELECT TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Docs student insert" ON public.application_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Docs student update" ON public.application_documents
  FOR UPDATE TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Docs student delete" ON public.application_documents
  FOR DELETE TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));
