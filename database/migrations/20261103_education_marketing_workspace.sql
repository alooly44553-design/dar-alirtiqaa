-- Education marketing workspace: persistent internal operations only.
-- No social publishing, messaging, file uploads, budgets, or external credentials are enabled.
-- Apply to an isolated education Neon branch first; production requires separate approval.

CREATE SCHEMA IF NOT EXISTS education_marketing;
REVOKE ALL ON SCHEMA education_marketing FROM PUBLIC;

CREATE TABLE IF NOT EXISTS education_marketing.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text UNIQUE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  objective text,
  audience text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('idea','draft','review','approved','active','completed','blocked','archived')),
  starts_on date,
  ends_on date,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS education_marketing.team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL CHECK (char_length(btrim(role_name)) BETWEEN 2 AND 120),
  department text NOT NULL DEFAULT 'marketing',
  role_kind text NOT NULL DEFAULT 'virtual' CHECK (role_kind IN ('virtual','human')),
  responsibilities text,
  permission_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, role_name)
);

CREATE TABLE IF NOT EXISTS education_marketing.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('website','whatsapp','telegram','instagram','facebook','youtube','tiktok','x','linkedin','other')),
  channel_name text NOT NULL CHECK (char_length(btrim(channel_name)) BETWEEN 2 AND 160),
  external_reference text,
  connection_status text NOT NULL DEFAULT 'planned'
    CHECK (connection_status IN ('planned','unverified','connected','disabled')),
  publishing_enabled boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT true,
  last_verified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, channel_name)
);

CREATE TABLE IF NOT EXISTS education_marketing.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES education_marketing.campaigns(id) ON DELETE SET NULL,
  area text NOT NULL DEFAULT 'operations'
    CHECK (area IN ('planning','content','design','video','publishing','community','support','analytics','operations')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  description text,
  assigned_role_id uuid REFERENCES education_marketing.team_roles(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','review','blocked','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS education_marketing.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES education_marketing.campaigns(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES education_marketing.channels(id) ON DELETE SET NULL,
  content_type text NOT NULL DEFAULT 'post'
    CHECK (content_type IN ('post','story','video','reel','article','brochure','announcement','other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 12000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('idea','draft','review','approved','scheduled','published','blocked','failed','archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_reference text,
  approval_required boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS education_marketing.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES education_marketing.campaigns(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('copy','image','video','brochure','poster','document','other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  description text,
  text_content text,
  storage_key text,
  storage_status text NOT NULL DEFAULT 'not_configured'
    CHECK (storage_status IN ('not_configured','pending_review','stored','rejected')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS education_marketing.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES education_marketing.campaigns(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES education_marketing.channels(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  event_type text NOT NULL DEFAULT 'content'
    CHECK (event_type IN ('content','campaign','meeting','deadline','event','other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','confirmed','completed','cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS education_marketing.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_tasks_status_due_idx
  ON education_marketing.tasks (status, due_at);
CREATE INDEX IF NOT EXISTS marketing_posts_status_schedule_idx
  ON education_marketing.posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS marketing_calendar_starts_idx
  ON education_marketing.calendar_events (starts_at);
CREATE INDEX IF NOT EXISTS marketing_audit_entity_idx
  ON education_marketing.audit_log (entity_type, entity_id, created_at DESC);

REVOKE ALL ON ALL TABLES IN SCHEMA education_marketing FROM PUBLIC;
