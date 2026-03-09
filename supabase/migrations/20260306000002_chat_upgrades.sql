-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Chat Upgrades
-- Adds: is_system, system_type, is_read columns; chat-images storage bucket.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. is_system: marks automated system messages inserted by participants on behalf of the system.
--    sender_id is the real user who triggered the action (satisfies existing RLS insert policy).
alter table chat_messages
  add column if not exists is_system boolean not null default false;

-- 2. system_type: controls color-coded badge rendering in the UI.
--    Values: 'completed' | 'dispute' | 'support' | 'cancel' — null for normal messages.
alter table chat_messages
  add column if not exists system_type text;

-- 3. is_read: read receipt flag. Sender sees a single checkmark until the receiver marks it read.
alter table chat_messages
  add column if not exists is_read boolean not null default false;

-- 4. Allow order participants to flip is_read = true on incoming messages.
--    (Participants can already INSERT; this adds UPDATE permission scoped to their orders.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages'
      and policyname = 'chat: mark read by participants'
  ) then
    execute $policy$
      create policy "chat: mark read by participants"
        on chat_messages for update
        using (
          exists (
            select 1 from orders o
            where o.id = order_id
              and (o.client_id = auth.uid() or o.booster_id = auth.uid())
          )
        )
        with check (true);
    $policy$;
  end if;
end;
$$;

-- 5. Storage bucket for chat image attachments (public read, authenticated write).
insert into storage.buckets (id, name, public)
  values ('chat-images', 'chat-images', true)
  on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat images: upload by auth'
  ) then
    execute $policy$
      create policy "chat images: upload by auth"
        on storage.objects for insert
        with check (
          bucket_id = 'chat-images'
          and auth.role() = 'authenticated'
        );
    $policy$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat images: public read'
  ) then
    execute $policy$
      create policy "chat images: public read"
        on storage.objects for select
        using (bucket_id = 'chat-images');
    $policy$;
  end if;
end;
$$;
