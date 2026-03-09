-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Direct Messages (Order-less Staff Channels)
-- Allows Boosters to message Admin, Support, and Accountant directly
-- without an order. Extends chat_messages rather than adding a new table.
--
-- Changes:
--   1. order_id → nullable  (existing rows unaffected — all have order_id set)
--   2. dm_thread_id TEXT     format: '{booster_user_id}:admin|support|accountant'
--   3. CHECK constraint      every row has EITHER order_id OR dm_thread_id
--   4. Index on dm_thread_id
--   5. Four new RLS policies for Booster ↔ Staff DM access
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Make order_id nullable
alter table public.chat_messages
  alter column order_id drop not null;

-- 2. Add dm_thread_id
alter table public.chat_messages
  add column if not exists dm_thread_id text;

-- 3. Index for fast thread queries
create index if not exists idx_chat_messages_dm_thread_id
  on public.chat_messages(dm_thread_id)
  where dm_thread_id is not null;

-- 4. Exactly-one-context constraint (XOR)
alter table public.chat_messages
  add constraint chat_messages_context_check
  check (
    (order_id is not null and dm_thread_id is null)
    or
    (order_id is null and dm_thread_id is not null)
  );

-- 5. Booster: read own DM threads (thread_id starts with their user_id)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages'
      and policyname = 'dm: booster reads own threads'
  ) then
    execute $policy$
      create policy "dm: booster reads own threads"
        on public.chat_messages for select
        using (
          dm_thread_id is not null
          and dm_thread_id like (auth.uid()::text || ':%')
        );
    $policy$;
  end if;
end;
$$;

-- 6. Booster: insert into own DM threads
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages'
      and policyname = 'dm: booster inserts own threads'
  ) then
    execute $policy$
      create policy "dm: booster inserts own threads"
        on public.chat_messages for insert
        with check (
          dm_thread_id is not null
          and dm_thread_id like (auth.uid()::text || ':%')
          and sender_id = auth.uid()
        );
    $policy$;
  end if;
end;
$$;

-- 7. Admin/Support: read all DM threads
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages'
      and policyname = 'dm: staff reads all threads'
  ) then
    execute $policy$
      create policy "dm: staff reads all threads"
        on public.chat_messages for select
        using (
          dm_thread_id is not null
          and public.current_user_role() in ('admin', 'support')
        );
    $policy$;
  end if;
end;
$$;

-- 8. Admin/Support: reply into any DM thread
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages'
      and policyname = 'dm: staff inserts threads'
  ) then
    execute $policy$
      create policy "dm: staff inserts threads"
        on public.chat_messages for insert
        with check (
          dm_thread_id is not null
          and sender_id = auth.uid()
          and public.current_user_role() in ('admin', 'support')
        );
    $policy$;
  end if;
end;
$$;
