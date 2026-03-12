-- ─── Create order-proofs storage bucket ─────────────────────────────────────
--
-- Idempotent: skips if the bucket already exists.
-- Public = true so getPublicUrl() returns directly-accessible URLs without
-- requiring signed tokens.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-proofs',
  'order-proofs',
  true,
  10485760,   -- 10 MB max per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
