-- ============================================================
-- Automation Functions
--
-- fn_handle_auto_approve_orders()
--   Promotes waiting_action orders to approved when the elapsed time
--   since completed_at exceeds the auto_complete_hours setting.
--
-- fn_handle_auto_cancel_orders()
--   Cancels awaiting_payment orders when elapsed time since created_at
--   exceeds the auto_cancel_hours setting.
--
-- Both functions:
--   • Read live settings from global_settings (id = 1).
--   • Fall back to safe defaults if the settings row is missing.
--   • Write a row to automation_logs for every run (even 0-order runs).
--   • Operate entirely in UTC (PostgreSQL default).
-- ============================================================

-- ─── Auto-Approve ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_handle_auto_approve_orders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours        INTEGER;
  v_cutoff       TIMESTAMPTZ;
  v_count        INTEGER;
  v_message      TEXT;
BEGIN
  -- Read setting; fall back to 72 h if global_settings is absent
  SELECT COALESCE(auto_complete_hours, 72)
    INTO v_hours
    FROM global_settings
   WHERE id = 1;

  IF NOT FOUND THEN
    v_hours := 72;
  END IF;

  v_cutoff := NOW() - (v_hours || ' hours')::INTERVAL;

  -- Promote eligible orders and capture how many were affected
  WITH updated AS (
    UPDATE orders
       SET status = 'approved'
     WHERE status      = 'waiting_action'
       AND completed_at IS NOT NULL
       AND completed_at <= v_cutoff
       AND booster_id   IS NOT NULL   -- safety: must have an assigned booster
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  v_message := 'Auto-approved ' || v_count || ' order(s) '
            || '(threshold: ' || v_hours || ' h, cutoff: '
            || TO_CHAR(v_cutoff AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC)';

  INSERT INTO automation_logs (job_name, orders_count, message)
  VALUES ('auto_approve', v_count, v_message);

EXCEPTION WHEN OTHERS THEN
  -- Never let a cron job die silently: log the error and re-raise
  INSERT INTO automation_logs (job_name, orders_count, message)
  VALUES ('auto_approve', 0, 'ERROR: ' || SQLERRM);
  RAISE;
END;
$$;

-- ─── Auto-Cancel ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_handle_auto_cancel_orders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours   INTEGER;
  v_cutoff  TIMESTAMPTZ;
  v_count   INTEGER;
  v_message TEXT;
BEGIN
  -- Read setting; fall back to 48 h if global_settings is absent
  SELECT COALESCE(auto_cancel_hours, 48)
    INTO v_hours
    FROM global_settings
   WHERE id = 1;

  IF NOT FOUND THEN
    v_hours := 48;
  END IF;

  v_cutoff := NOW() - (v_hours || ' hours')::INTERVAL;

  WITH updated AS (
    UPDATE orders
       SET status = 'cancelled'
     WHERE status     = 'awaiting_payment'
       AND created_at <= v_cutoff
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  v_message := 'Auto-cancelled ' || v_count || ' order(s) '
            || '(threshold: ' || v_hours || ' h, cutoff: '
            || TO_CHAR(v_cutoff AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC)';

  INSERT INTO automation_logs (job_name, orders_count, message)
  VALUES ('auto_cancel', v_count, v_message);

EXCEPTION WHEN OTHERS THEN
  INSERT INTO automation_logs (job_name, orders_count, message)
  VALUES ('auto_cancel', 0, 'ERROR: ' || SQLERRM);
  RAISE;
END;
$$;

-- Revoke direct public execution; these run only via pg_cron (superuser context)
-- or from service_role triggers.
REVOKE EXECUTE ON FUNCTION fn_handle_auto_approve_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_handle_auto_cancel_orders()  FROM PUBLIC;
