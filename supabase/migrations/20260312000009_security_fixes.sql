-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Security Analyzer Fixes
--
-- Fix 1: chat_messages "always true" WITH CHECK on UPDATE policy
-- Fix 2: payment_attempts RLS policies (RLS enabled, no policies)
-- Fix 3: set_updated_at + set_withdrawals_updated_at mutable search_path
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── Fix 1: chat_messages UPDATE policy ──────────────────────────────────────
-- The "chat: mark read by participants" policy had `with check (true)`, meaning
-- any participant who passed the USING clause could update *any column* to *any
-- value*.  Replace it with an explicit check that mirrors the USING clause.

drop policy if exists "chat: mark read by participants" on public.chat_messages;

create policy "chat: mark read by participants"
  on public.chat_messages
  for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.client_id = auth.uid() or o.booster_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.client_id = auth.uid() or o.booster_id = auth.uid())
    )
  );


-- ─── Fix 2: payment_attempts RLS policies ────────────────────────────────────
-- RLS was enabled but no policies existed, so the table was completely
-- inaccessible from the client SDK (service role bypasses RLS and is unaffected
-- by this).  Add:
--   • Users can SELECT their own rows.
--   • INSERT remains service-role-only (no permissive INSERT policy = blocked).
--   • Admins and accountants can SELECT all rows for reporting.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'payment_attempts'
      and policyname = 'payment_attempts: select own'
  ) then
    execute $p$
      create policy "payment_attempts: select own"
        on public.payment_attempts
        for select
        using (user_id = auth.uid());
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'payment_attempts'
      and policyname = 'payment_attempts: admin/accountant select all'
  ) then
    execute $p$
      create policy "payment_attempts: admin/accountant select all"
        on public.payment_attempts
        for select
        using (
          public.current_user_role() in ('admin', 'accountant', 'support')
        );
    $p$;
  end if;
end $$;


-- ─── Fix 3: lock function search_path ────────────────────────────────────────
-- Without SET search_path the planner resolves unqualified names at runtime.
-- A malicious user who can create objects in a schema earlier on the path could
-- shadow built-ins or public functions and escalate privileges.
-- Setting search_path = '' forces all references to be schema-qualified,
-- closing this attack vector.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_withdrawals_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
