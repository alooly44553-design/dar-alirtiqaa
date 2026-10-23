-- Add email-based, verified-identity linking for health-center staff.
-- Safe additive migration: preserves existing staff rows and roles.
ALTER TABLE public.health_center_staff
  ADD COLUMN IF NOT EXISTS email text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS health_center_staff_email_lower_unique_idx
  ON public.health_center_staff (lower(email))
  WHERE email IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'health_center_staff_email_format_check'
      AND conrelid = 'public.health_center_staff'::regclass
  ) THEN
    ALTER TABLE public.health_center_staff
      ADD CONSTRAINT health_center_staff_email_format_check
      CHECK (
        email IS NULL OR (
          email = lower(btrim(email))
          AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        )
      );
  END IF;
END
$$;
