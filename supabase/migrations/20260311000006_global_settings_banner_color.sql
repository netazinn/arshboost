-- ============================================================
-- Global Settings: Add announcement banner color column
-- ============================================================

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS announcement_color TEXT NOT NULL DEFAULT 'amber';

COMMENT ON COLUMN public.global_settings.announcement_color IS 'Preset color key for the announcement banner: amber | green | red | blue | purple | slate';
