-- Neon project: dar-alirtiqaa-public-services
BEGIN;
CREATE SCHEMA IF NOT EXISTS public_services;
REVOKE ALL ON SCHEMA public_services FROM PUBLIC;
CREATE TABLE IF NOT EXISTS public_services.service_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_code text NOT NULL UNIQUE,
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
 description text,
 requirements jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(requirements) = 'array'),
 fees jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fees) = 'object'),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public_services.service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_number text NOT NULL UNIQUE,
 applicant_name text NOT NULL CHECK (char_length(btrim(applicant_name)) BETWEEN 2 AND 120),
 phone text CHECK (phone IS NULL OR phone ~ '^[+0-9 ()-]{7,30}$'),
 email text,
 service_code text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','approved','rejected','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public_services.documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 document_type text NOT NULL,
 storage_key text NOT NULL,
 uploaded_by text,
 request_id uuid REFERENCES public_services.service_requests(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public_services.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 description text,
 assigned_to text,
 due_at timestamptz,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA public_services FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public_services FROM PUBLIC;
COMMIT;
