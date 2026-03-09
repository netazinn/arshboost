-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Add accountant to user_role enum
-- Must be a separate migration before any usage of 'accountant' in RLS/tables.
-- ─────────────────────────────────────────────────────────────────────────────

alter type user_role add value if not exists 'accountant';
