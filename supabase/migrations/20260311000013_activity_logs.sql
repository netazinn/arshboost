-- ============================================================
-- Activity Logs / Audit Trail
--
-- Tracks every significant administrative action so the audit
-- trail can be reviewed from the /admin/activity-logs page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT        NOT NULL,   -- e.g. 'settings.financials.update'
  target_id   TEXT,                   -- UUID or text ID of the affected entity
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.activity_logs              IS 'Admin audit trail — one row per significant administrative action.';
COMMENT ON COLUMN public.activity_logs.action_type  IS 'Dot-separated action identifier, e.g. user.banned, withdrawal.approved.';
COMMENT ON COLUMN public.activity_logs.target_id    IS 'String ID of the affected row (user ID, order ID, withdrawal ID, etc.).';
COMMENT ON COLUMN public.activity_logs.details      IS 'Freeform JSONB payload (old vs new values, notes, etc.).';

CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id    ON public.activity_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at  ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON public.activity_logs (action_type);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins and accountants can read logs; no other roles can access them.
CREATE POLICY "activity_logs: admin read"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id   = auth.uid()
         AND role IN ('admin', 'accountant')
    )
  );

-- Only the service-role (server actions) may insert logs.
CREATE POLICY "activity_logs: service_role all"
  ON public.activity_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
