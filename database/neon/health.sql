-- Neon project: dar-alirtiqaa-health
-- Schema-only bootstrap. Do not store diagnoses or medical reports in appointment requests.
BEGIN;
CREATE SCHEMA IF NOT EXISTS health;
REVOKE ALL ON SCHEMA health FROM PUBLIC;
CREATE TABLE IF NOT EXISTS health.appointment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
 phone text NOT NULL CHECK (phone ~ '^[+0-9 ()-]{7,30}$'),
 specialty text NOT NULL CHECK (char_length(btrim(specialty)) BETWEEN 2 AND 80),
 preferred_date date NOT NULL CHECK (preferred_date >= CURRENT_DATE AND preferred_date <= CURRENT_DATE + 90),
 preferred_time time NOT NULL,
 privacy_consent boolean NOT NULL CHECK (privacy_consent IS TRUE),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','cancelled','completed')),
 source text NOT NULL DEFAULT 'website' CHECK (source IN ('website','admin')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS health.service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_number text NOT NULL UNIQUE,
 applicant_name text NOT NULL CHECK (char_length(btrim(applicant_name)) BETWEEN 2 AND 120),
 phone text NOT NULL CHECK (phone ~ '^[+0-9 ()-]{7,30}$'),
 service_code text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','approved','rejected','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS health.documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 document_type text NOT NULL,
 storage_key text NOT NULL,
 uploaded_by text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS health.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 description text,
 assigned_to text,
 due_at timestamptz,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA health FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA health FROM PUBLIC;
COMMIT;
