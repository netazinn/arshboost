-- ============================================================
-- Automation Foundation
--
-- 1. Add `approved` to order_status enum (financially-closed state)
-- 2. Add `completed_at`  – timestamp when order entered waiting_action
-- 3. Add `net_payout`    – booster's earning for this order
-- 4. Create automation_logs table
-- ============================================================

-- ─── 1. Extend order_status enum ─────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── 2. Orders: new columns ───────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS net_payout   NUMERIC(10,2) CHECK (net_payout >= 0);

COMMENT ON COLUMN orders.completed_at IS
  'UTC timestamp when the order entered waiting_action (booster submitted completion). '
  'Used by the auto-approve cron to measure elapsed time.';

COMMENT ON COLUMN orders.net_payout IS
  'Booster earnings for this order (order price minus flat platform fee). '
  'Credited to booster balance when status transitions to approved.';

-- Index so cron functions can efficiently find orders needing action
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders (completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (created_at)
  WHERE status = 'awaiting_payment';

-- ─── 3. automation_logs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name     TEXT        NOT NULL,
  orders_count INTEGER     NOT NULL DEFAULT 0,
  message      TEXT        NOT NULL,
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.automation_logs IS
  'Records each cron job execution: job name, orders affected, and a summary message.';

CREATE INDEX IF NOT EXISTS idx_automation_logs_ran_at  ON automation_logs (ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_job_name ON automation_logs (job_name);

-- RLS: admins (service_role) write; authenticated users can read for audit UI
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_logs_select"
  ON public.automation_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "automation_logs_service_role_all"
  ON public.automation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
