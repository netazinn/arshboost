-- ============================================================
-- Global Settings: Add operational control columns
-- ============================================================

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS is_maintenance_mode       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS halt_new_orders           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_complete_hours       INTEGER     NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS auto_cancel_hours         INTEGER     NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS iban_cooldown_days        INTEGER     NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.global_settings.is_maintenance_mode        IS 'When true, platform is in read-only/maintenance mode for users.';
COMMENT ON COLUMN public.global_settings.halt_new_orders            IS 'When true, clients cannot place new orders.';
COMMENT ON COLUMN public.global_settings.auto_complete_hours        IS 'Hours after order completion before auto-approval if client does not dispute.';
COMMENT ON COLUMN public.global_settings.auto_cancel_hours          IS 'Hours before an inactive pending/unpaid order is automatically cancelled.';
COMMENT ON COLUMN public.global_settings.iban_cooldown_days         IS 'Days a booster must wait before changing their bank details again.';
