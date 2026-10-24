-- Health-centers-only migration.
-- Creates the rate-limit table required by api/health/appointments.js.
-- This file defines the migration; it must be reviewed and applied explicitly
-- to the dedicated dar-alirtiqaa-health database before enabling online intake.
BEGIN;

CREATE SCHEMA IF NOT EXISTS health;

CREATE TABLE IF NOT EXISTS health.appointment_request_rate_limits (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 5)
);

REVOKE ALL ON TABLE health.appointment_request_rate_limits FROM PUBLIC;

COMMIT;
