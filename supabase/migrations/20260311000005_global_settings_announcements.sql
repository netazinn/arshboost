-- ============================================================
-- Global Settings: Add announcement banner columns
-- ============================================================

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS is_announcement_active BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS announcement_text      TEXT         NOT NULL DEFAULT '';

COMMENT ON COLUMN public.global_settings.is_announcement_active IS 'When true, the announcement banner is shown to all visitors.';
COMMENT ON COLUMN public.global_settings.announcement_text      IS 'Text content of the global announcement banner.';
