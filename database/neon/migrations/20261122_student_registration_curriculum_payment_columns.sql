-- QA-only additive compatibility migration.
-- Target: Neon project still-term-43673824, branch br-late-dawn-azs3g3i2, database neondb.
-- Adds the fields selected and written by api/education/admin-registrations.js.
-- Existing registration records are preserved; all new columns are nullable.
ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS curriculum_reference text;
ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS tuition_period text;
ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS installment_count smallint;
