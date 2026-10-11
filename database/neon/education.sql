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
 consent_given boolean NOT NULL DEFAULT false,
 consent_recorded_at timestamptz,
 consent_text text,
 attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array')
);

-- Idempotent additive migration for databases created before consent auditing was added.
ALTER TABLE education.student_registrations
 ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;
ALTER TABLE education.student_registrations
 ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz;
ALTER TABLE education.student_registrations
 ADD COLUMN IF NOT EXISTS consent_text text;

CREATE UNIQUE INDEX IF NOT EXISTS education_student_registrations_number_uq
 ON education.student_registrations (registration_number)
 WHERE registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS education_student_registrations_created_idx
 ON education.student_registrations (created_at DESC);

CREATE TABLE IF NOT EXISTS education.service_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_code text NOT NULL UNIQUE,
 service_name text NOT NULL CHECK (char_length(btrim(service_name)) BETWEEN 2 AND 160),
 service_category text NOT NULL,
 description text,
 registration_method text NOT NULL,
 registration_method_label text NOT NULL,
 form_fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(form_fields) = 'array'),
 consent_text text,
 requires_management_review boolean NOT NULL DEFAULT true,
 is_active boolean NOT NULL DEFAULT true,
 display_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS education_service_catalog_active_order_idx
 ON education.service_catalog (display_order) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS education.service_fee_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_id uuid NOT NULL REFERENCES education.service_catalog(id),
 fee_code text NOT NULL,
 fee_type text NOT NULL,
 fee_name text NOT NULL,
 description text,
 amount numeric(12,2) CHECK (amount IS NULL OR amount >= 0),
 currency text NOT NULL DEFAULT 'SAR',
 calculation_method text NOT NULL DEFAULT 'fixed',
 is_required boolean NOT NULL DEFAULT true,
 condition_rule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(condition_rule) = 'object'),
 payment_stage text NOT NULL DEFAULT 'before_acceptance',
 display_order integer NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true,
 effective_from date NOT NULL DEFAULT current_date,
 effective_to date,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (service_id, fee_code),
 CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS education_service_fee_items_lookup_idx
 ON education.service_fee_items (service_id, display_order, fee_code);
CREATE INDEX IF NOT EXISTS education_service_fee_items_active_idx
 ON education.service_fee_items (service_id, effective_from, effective_to)
 WHERE is_active = true;

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
 phone text CHECK (phone IS NULL OR phone ~ '^[+0-9 ()-]{7,30}
-- School learning portal data is stored only in the education Neon project.
-- Profile/master-data IDs (staff, learners, programs, subjects, classrooms) are UUID references
-- while those legacy identity/master records are being migrated in a later controlled phase.
CREATE TABLE IF NOT EXISTS education.school_lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 program_id uuid,
 subject_id uuid,
 teacher_id uuid,
 classroom_id uuid,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 explanation text,
 objectives text,
 resources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(resources) = 'array'),
 ai_generated boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 scheduled_for timestamptz,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS education_school_lessons_teacher_created_idx
 ON education.school_lessons (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS education_school_lessons_status_schedule_idx
 ON education.school_lessons (status, scheduled_for);

CREATE TABLE IF NOT EXISTS education.school_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lesson_id uuid REFERENCES education.school_lessons(id) ON DELETE CASCADE,
 classroom_id uuid,
 subject_id uuid,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
 instructions text,
 due_at timestamptz,
 max_score numeric NOT NULL DEFAULT 100 CHECK (max_score > 0),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS education_school_assignments_lesson_status_idx
 ON education.school_assignments (lesson_id, status, due_at);

CREATE TABLE IF NOT EXISTS education.school_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assignment_id uuid NOT NULL REFERENCES education.school_assignments(id) ON DELETE CASCADE,
 learner_id uuid NOT NULL,
 learner_name text NOT NULL DEFAULT '',
 answer_text text,
 attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array'),
 submitted_at timestamptz,
 status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','reviewed','returned')),
 score numeric CHECK (score IS NULL OR score >= 0),
 feedback text,
 ai_feedback text,
 ai_review_status text NOT NULL DEFAULT 'not_requested' CHECK (ai_review_status IN ('not_requested','pending','ready','approved')),
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (assignment_id, learner_id)
);
ALTER TABLE education.school_submissions
 ADD COLUMN IF NOT EXISTS learner_name text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS education_school_submissions_assignment_status_idx
 ON education.school_submissions (assignment_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS education_school_submissions_learner_created_idx
 ON education.school_submissions (learner_id, created_at DESC);

REVOKE ALL ON ALL TABLES IN SCHEMA education FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA education FROM PUBLIC;
COMMIT;
),
 applicant_email text,
 service_code text NOT NULL REFERENCES education.service_catalog(service_code),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','approved','rejected','completed')),
 consent_given boolean NOT NULL DEFAULT false,
 consent_recorded_at timestamptz,
 consent_text text,
 management_note text,
 documented boolean NOT NULL DEFAULT false,
 documented_at timestamptz,
 document_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS applicant_email text;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS consent_text text;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS management_note text;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS documented boolean NOT NULL DEFAULT false;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS documented_at timestamptz;
ALTER TABLE education.service_requests ADD COLUMN IF NOT EXISTS document_reference text;
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'education_service_requests_service_code_fkey'
    AND conrelid = 'education.service_requests'::regclass
 ) THEN
  ALTER TABLE education.service_requests
   ADD CONSTRAINT education_service_requests_service_code_fkey
   FOREIGN KEY (service_code) REFERENCES education.service_catalog(service_code);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS education_service_requests_created_idx
 ON education.service_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS education_service_requests_status_idx
 ON education.service_requests (status, created_at DESC);
REVOKE ALL ON ALL TABLES IN SCHEMA education FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA education FROM PUBLIC;
COMMIT;
