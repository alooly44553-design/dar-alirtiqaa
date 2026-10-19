-- Additive migration: centrally record meetings created by the protected Zoom API.
-- This migration does not change existing fees, educational timetables, or student records.
CREATE SCHEMA IF NOT EXISTS education;

CREATE TABLE IF NOT EXISTS education.zoom_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id text NOT NULL UNIQUE,
  topic text NOT NULL,
  agenda text NOT NULL DEFAULT '',
  start_time timestamptz NOT NULL,
  timezone text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  join_url text NOT NULL CHECK (join_url LIKE 'https://%.zoom.us/%' OR join_url LIKE 'https://zoom.us/%'),
  passcode text,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zoom_meetings_start_time_idx
  ON education.zoom_meetings (start_time);
CREATE INDEX IF NOT EXISTS zoom_meetings_creator_created_idx
  ON education.zoom_meetings (created_by, created_at DESC);

REVOKE ALL ON TABLE education.zoom_meetings FROM PUBLIC;

COMMENT ON TABLE education.zoom_meetings IS
  'Zoom meeting metadata created through the authenticated, admin-authorized server API. Never store Zoom host start URLs or OAuth credentials.';
COMMENT ON COLUMN education.zoom_meetings.join_url IS
  'Participant join URL only. Privileged host launch URLs must not be stored here.';
