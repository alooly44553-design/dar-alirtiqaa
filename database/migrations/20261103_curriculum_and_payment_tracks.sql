-- Education curriculum separation and early-childhood payment selection.
-- Applied and tested only on Neon branch education-fees-curriculum-test-2026-11-03.
ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS curriculum_track text,
  ADD COLUMN IF NOT EXISTS curriculum_country text,
  ADD COLUMN IF NOT EXISTS payment_plan text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'education_student_curriculum_track_check') THEN
    ALTER TABLE education.student_registrations
      ADD CONSTRAINT education_student_curriculum_track_check
      CHECK (curriculum_track IS NULL OR curriculum_track IN ('saudi_curriculum', 'multi_country_curriculum'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'education_student_payment_plan_check') THEN
    ALTER TABLE education.student_registrations
      ADD CONSTRAINT education_student_payment_plan_check
      CHECK (payment_plan IS NULL OR payment_plan IN ('annual', 'monthly_installments'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS education_student_registrations_curriculum_idx
  ON education.student_registrations (curriculum_track, curriculum_country, created_at DESC);
