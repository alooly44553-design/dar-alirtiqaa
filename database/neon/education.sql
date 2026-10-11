-- Neon project: dar-alirtiqaa-education
-- Schema-only bootstrap for a fresh database. This file does not copy production data.
-- Keep this definition aligned with the live education.student_registrations table.
BEGIN;
CREATE SCHEMA IF NOT EXISTS education;
REVOKE ALL ON SCHEMA education FROM PUBLIC;

CREATE TABLE IF NOT EXISTS education.student_registrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
 guardian_name text,
 phone text CHECK (phone ~ '^[+0-9 ()-]{7,30}$'),
 email text,
 requested_program text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','enrolled')),
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 registration_number text,
 student_name text,
 gender text CHECK (gender IS NULL OR gender IN ('male','female')),
 date_of_birth date,
 nationality text,
 identity_type text,
 identity_number text,
 guardian_relationship text,
 guardian_phone text,
 address text,
 previous_education text,
 approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','under_review','approved','rejected','enrolled')),
 approved_at timestamptz,
 approved_by uuid,
 approval_note text,
 documented boolean NOT NULL DEFAULT false,
 documented_at timestamptz,
 documented_by uuid,
 document_reference text,
 attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array')
);
CREATE UNIQUE INDEX IF NOT EXISTS education_student_registrations_number_uq
 ON education.student_registrations (registration_number)
 WHERE registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS education_student_registrations_created_idx
 ON education.student_registrations (created_at DESC);

CREATE TABLE IF NOT EXISTS education.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 description text,
 assigned_to text,
 due_at timestamptz,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS education.documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 document_type text NOT NULL,
 storage_key text NOT NULL,
 uploaded_by text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS education.service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_number text NOT NULL UNIQUE,
 applicant_name text NOT NULL CHECK (char_length(btrim(applicant_name)) BETWEEN 2 AND 120),
 phone text CHECK (phone IS NULL OR phone ~ '^[+0-9 ()-]{7,30}$'),
 service_code text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','approved','rejected','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA education FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA education FROM PUBLIC;
COMMIT;
