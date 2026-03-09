-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Fix RLS: chat_messages + withdrawals
-- Fixes:
--   1. Admin/support/accountant can INSERT messages into any order chat (fix god-mode send)
--   2. chat: read policy — add accountant to staff readers
--   3. DM: staff read/insert policies — add accountant
--   4. Withdrawals SELECT policy — drop/recreate to ensure correctness
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow admin / support / accountant to INSERT into any order chat
--    (The existing "chat: insert by participants" only covers client+booster)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages'
      and policyname = 'chat: admin/staff insert any order'
  ) then
    execute $policy$
      create policy "chat: admin/staff insert any order"
        on public.chat_messages for insert
        with check (
          sender_id = auth.uid()
          and order_id is not null
          and public.current_user_role() in ('admin', 'support', 'accountant')
        );
    $policy$;
  end if;
end;
$$;

-- 2. Expand chat: read by participants — accountant needs read access for Master Inbox
drop policy if exists "chat: read by participants" on public.chat_messages;
create policy "chat: read by participants"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.client_id = auth.uid() or o.booster_id = auth.uid())
    )
    or public.current_user_role() in ('admin', 'support', 'accountant')
  );

-- 3. DM: staff reads all threads — add accountant
drop policy if exists "dm: staff reads all threads" on public.chat_messages;
create policy "dm: staff reads all threads"
  on public.chat_messages for select
  using (
    dm_thread_id is not null
    and public.current_user_role() in ('admin', 'support', 'accountant')
  );

-- 4. DM: staff inserts threads — add accountant
drop policy if exists "dm: staff inserts threads" on public.chat_messages;
create policy "dm: staff inserts threads"
  on public.chat_messages for insert
  with check (
    dm_thread_id is not null
    and sender_id = auth.uid()
    and public.current_user_role() in ('admin', 'support', 'accountant')
  );

-- 5. Withdrawals: ensure admin/accountant/support SELECT policy exists and is correct
--    (Drop and recreate the all-access policy to guarantee it covers SELECT)
drop policy if exists "withdrawals: admin/accountant all" on public.withdrawals;
create policy "withdrawals: admin/accountant all"
  on public.withdrawals for all
  using (
    public.current_user_role() in ('admin', 'accountant', 'support')
  )
  with check (
    public.current_user_role() in ('admin', 'accountant', 'support')
  );
