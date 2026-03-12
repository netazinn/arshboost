-- ============================================================
-- pg_cron Scheduling
--
-- Enables the pg_cron extension and schedules both automation
-- functions to run every hour.
--
-- IMPORTANT: pg_cron must be enabled in Supabase Dashboard first:
--   Database → Extensions → pg_cron → Enable
--
-- If you are running this via the Supabase SQL Editor, make sure
-- pg_cron is enabled before executing this migration.
--
-- Cron schedules (UTC):
--   auto_approve : every hour, on the hour   → 0 * * * *
--   auto_cancel  : every hour, 30 min offset → 30 * * * *
--                  (staggered to avoid simultaneous DB load)
-- ============================================================

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Remove any existing jobs with these names (idempotent re-run safety) ─────

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname IN ('arshboost_auto_approve', 'arshboost_auto_cancel');

-- ─── Schedule: Auto-Approve (every hour on the hour) ─────────────────────────

SELECT cron.schedule(
  'arshboost_auto_approve',           -- job name (unique)
  '0 * * * *',                        -- every hour, minute 0
  $$SELECT fn_handle_auto_approve_orders();$$
);

-- ─── Schedule: Auto-Cancel (every hour, offset 30 min) ───────────────────────

SELECT cron.schedule(
  'arshboost_auto_cancel',
  '30 * * * *',                       -- every hour, minute 30
  $$SELECT fn_handle_auto_cancel_orders();$$
);

-- ─── Verify scheduled jobs ────────────────────────────────────────────────────
-- Run this query after migration to confirm:
--
--   SELECT jobname, schedule, command, active
--     FROM cron.job
--    WHERE jobname LIKE 'arshboost_%';
