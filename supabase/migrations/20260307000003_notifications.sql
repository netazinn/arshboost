-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — In-App Notification System
-- Creates the notifications table, RLS policies, and Realtime publication.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. notifications table
create table if not exists public.notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  body             text not null,
  -- type values: 'order_created' | 'order_completed' | 'order_dispute' | 'order_support' | 'order_cancelled'
  type             text not null,
  related_order_id uuid references public.orders(id) on delete set null,
  read             boolean not null default false,
  created_at       timestamptz not null default now()
);

-- 2. Index for fast per-user lookups
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read);

-- 3. RLS
alter table public.notifications enable row level security;

-- Users can SELECT only their own notifications
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'notifications: read own'
  ) then
    execute $p$
      create policy "notifications: read own"
        on public.notifications for select
        using (auth.uid() = user_id);
    $p$;
  end if;
end; $$;

-- Users can UPDATE (mark read) their own notifications
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'notifications: mark read'
  ) then
    execute $p$
      create policy "notifications: mark read"
        on public.notifications for update
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $p$;
  end if;
end; $$;

-- 4. Enable Realtime so clients receive new notifications instantly via INSERT events
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
