-- ─── Proof-of-Work: add proof_image_url to orders ────────────────────────────
--
-- When a booster marks an order as complete they must upload a screenshot.
-- The public URL of that screenshot is stored here so the client can review it
-- before releasing funds.
-- ─────────────────────────────────────────────────────────────────────────────

alter table orders
  add column if not exists proof_image_url text;
