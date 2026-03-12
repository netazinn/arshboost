-- ─── Order State Machine: new statuses + support_needed flag ──────────────────
--
-- New statuses:
--   waiting_action   – booster marked complete, waiting for client to approve
--   cancel_requested – cancellation requested, chat locked pending review
--
-- The existing 'dispute' status already covers the dispute lock.
-- We add 'support' status as an alias via app code ('support' was already used).

-- 1. Extend the order_status enum with new values (safe: adds only if absent)
do $$ begin
  alter type order_status add value if not exists 'waiting_action';
exception when others then null;
end $$;

do $$ begin
  alter type order_status add value if not exists 'cancel_requested';
exception when others then null;
end $$;

-- 2. Add support_needed boolean flag (default false; used for soft flag without status change)
alter table orders
  add column if not exists support_needed boolean not null default false;

-- 3. Allow booster to update orders they own (needed for new state transitions)
--    The existing "orders: booster update" policy already covers booster_id = auth.uid(),
--    so no additional policy is needed — the service-role path in executeOrderAction
--    bypasses RLS anyway for consistency.

-- 4. Allow client to update their own orders (needed for approve + release)
--    The existing client update policy may be restricted; add a broad client update policy.
drop policy if exists "orders: client update own" on orders;
create policy "orders: client update own"
  on orders for update
  using (client_id = auth.uid());

-- 5. Ensure Realtime is publishing orders table changes (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
exception when others then null;
end $$;
