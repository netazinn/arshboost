-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Takeover Orders
-- When a dispute is partially resolved, the remaining work can be re-listed
-- as a "takeover" order for a new booster to claim.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.orders
  add column if not exists is_takeover   boolean not null default false,
  add column if not exists takeover_note text;
