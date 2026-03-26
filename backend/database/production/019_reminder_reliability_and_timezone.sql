-- ============================================================
-- 019: Reminder reliability + timezone support
-- Adds:
--   1) users.timezone (global reminder correctness)
--   2) reminder_actions (Redis-fallback persistence)
-- Safe to re-run (idempotent)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

CREATE TABLE IF NOT EXISTS reminder_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('taken', 'skip', 'snooze')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snooze_until TIMESTAMPTZ,
  source TEXT DEFAULT 'app',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, reminder_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_reminder_actions_user_scheduled
  ON reminder_actions(user_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_actions_reminder
  ON reminder_actions(reminder_id, acted_at DESC);

ALTER TABLE reminder_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role full access reminder actions" ON reminder_actions;
END $$;

CREATE POLICY "Service role full access reminder actions" ON reminder_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

SELECT '✅ 019_reminder_reliability_and_timezone applied' AS status;
