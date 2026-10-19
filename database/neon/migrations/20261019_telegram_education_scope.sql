-- Telegram educational-only scope isolation.
-- Existing rows are intentionally marked unclassified, not deleted or exposed by the education bot.
ALTER TABLE education.telegram_conversations
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'unclassified';

ALTER TABLE education.telegram_tasks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'unclassified';

ALTER TABLE education.telegram_video_jobs
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'unclassified';

CREATE INDEX IF NOT EXISTS telegram_tasks_scope_chat_due_idx
  ON education.telegram_tasks (scope, chat_id, status, due_at);

CREATE INDEX IF NOT EXISTS telegram_video_jobs_scope_chat_created_idx
  ON education.telegram_video_jobs (scope, chat_id, created_at DESC);

COMMENT ON COLUMN education.telegram_conversations.scope IS
  'Logical scope for the Telegram assistant; legacy rows stay unclassified and are never loaded into new education sessions.';

COMMENT ON COLUMN education.telegram_tasks.scope IS
  'Logical scope for Telegram tasks; the education bot reads and writes only scope=education.';

COMMENT ON COLUMN education.telegram_video_jobs.scope IS
  'Logical scope for Telegram video jobs; the education bot reads and writes only scope=education.';
