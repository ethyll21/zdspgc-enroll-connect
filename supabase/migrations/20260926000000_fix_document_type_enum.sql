-- Migration: Add all required document_type enum values to public.documents table
-- The document_type enum in public.documents was missing several values

-- Add missing values to the document_type enum (IF NOT EXISTS prevents errors if already added)
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'psa_birth_certificate';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'form_138';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'transfer_certificate';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'registration_form';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'other';

-- Verify the values are in place (informational)
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.document_type'::regtype;
