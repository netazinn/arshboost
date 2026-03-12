-- ============================================================
-- Order Lifecycle Triggers
--
-- Trigger 1 – trg_set_completed_at
--   Fires BEFORE UPDATE on orders.
--   When status transitions TO 'waiting_action' for the first time,
--   stamps completed_at = NOW() so auto-approve has a reference point.
--
-- Trigger 2 – trg_handle_order_approved
--   Fires AFTER UPDATE on orders.
--   When status transitions TO 'approved', credits net_payout to the
--   booster's balance via the existing increment_profile_balance() RPC.
-- ============================================================

-- ─── Trigger 1: stamp completed_at on waiting_action ─────────────────────────

CREATE OR REPLACE FUNCTION fn_set_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only stamp once: when entering waiting_action from any other status.
  IF NEW.status = 'waiting_action' AND (OLD.status IS DISTINCT FROM 'waiting_action') THEN
    -- Don't overwrite a timestamp already set (e.g. idempotent re-run)
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_completed_at ON orders;
CREATE TRIGGER trg_set_completed_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_completed_at();

-- ─── Trigger 2: credit booster on approval ────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_handle_order_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on the transition INTO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Only pay out if the order has a booster and a positive net_payout
    IF NEW.booster_id IS NOT NULL AND NEW.net_payout IS NOT NULL AND NEW.net_payout > 0 THEN
      PERFORM increment_profile_balance(NEW.booster_id, NEW.net_payout);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_order_approved ON orders;
CREATE TRIGGER trg_handle_order_approved
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_handle_order_approved();
