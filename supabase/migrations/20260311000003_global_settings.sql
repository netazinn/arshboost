-- ============================================================
-- Global Settings: Platform singleton configuration table
-- One row, id always = 1. Enforced via PRIMARY KEY + CHECK.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.global_settings (
  id                    INTEGER     PRIMARY KEY DEFAULT 1,
  flat_platform_fee     NUMERIC(10, 2) NOT NULL DEFAULT 4,
  min_withdrawal_amount NUMERIC(10, 2) NOT NULL DEFAULT 50,
  duo_boost_multiplier  NUMERIC(10, 4) NOT NULL DEFAULT 1.5,
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by            UUID REFERENCES auth.users(id),

  CONSTRAINT single_row CHECK (id = 1)
);

COMMENT ON TABLE  public.global_settings IS 'Singleton table (id=1). Holds platform-wide financial and operational settings.';
COMMENT ON COLUMN public.global_settings.flat_platform_fee     IS 'Fixed currency amount deducted from every order as the platform fee.';
COMMENT ON COLUMN public.global_settings.min_withdrawal_amount IS 'Minimum amount a booster may request in a single withdrawal.';
COMMENT ON COLUMN public.global_settings.duo_boost_multiplier  IS 'Price multiplier applied to the total when the duo-boost option is selected.';

-- ─── Seed default row ─────────────────────────────────────────────────────────
INSERT INTO public.global_settings (id, flat_platform_fee, min_withdrawal_amount, duo_boost_multiplier)
VALUES (1, 4, 50, 1.5)
ON CONFLICT (id) DO NOTHING;

-- ─── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user or anonymous visitor can read settings
-- (needed for client-side price previews, etc.)
CREATE POLICY "global_settings_select"
  ON public.global_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Service-role (used exclusively in server actions) can read & write
CREATE POLICY "global_settings_service_role_all"
  ON public.global_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
