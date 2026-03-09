-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Row Level Security (RLS) Policies Migration 002
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
alter table profiles      enable row level security;
alter table games         enable row level security;
alter table games_services enable row level security;
alter table orders        enable row level security;
alter table chat_messages enable row level security;

-- ─── Helper: role check ──────────────────────────────────────────────────────

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ─── profiles policies ───────────────────────────────────────────────────────

-- Users can read their own profile; admins & support can read all
create policy "profiles: select own or admin/support"
  on profiles for select
  using (
    id = auth.uid()
    or public.current_user_role() in ('admin', 'support')
  );

-- Users can update only their own profile
create policy "profiles: update own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── games policies ──────────────────────────────────────────────────────────

-- Public read for active games
create policy "games: public read active"
  on games for select
  using (is_active = true);

-- Admin-only write
create policy "games: admin write"
  on games for all
  using (public.current_user_role() = 'admin');

-- ─── games_services policies ─────────────────────────────────────────────────

create policy "games_services: public read active"
  on games_services for select
  using (is_active = true);

create policy "games_services: admin write"
  on games_services for all
  using (public.current_user_role() = 'admin');

-- ─── orders policies ─────────────────────────────────────────────────────────

-- Client: read & create own orders
create policy "orders: client read own"
  on orders for select
  using (client_id = auth.uid());

create policy "orders: client insert"
  on orders for insert
  with check (client_id = auth.uid());

-- Client: cancel own pending/awaiting_payment order
create policy "orders: client cancel"
  on orders for update
  using (client_id = auth.uid() and status in ('pending', 'awaiting_payment'))
  with check (status = 'cancelled');

-- Booster: read assigned orders + all in_progress orders (job board)
create policy "orders: booster read"
  on orders for select
  using (
    booster_id = auth.uid()
    or (public.current_user_role() = 'booster' and status = 'in_progress')
  );

-- Booster: claim + update status on assigned orders
create policy "orders: booster update"
  on orders for update
  using (
    public.current_user_role() = 'booster'
    and (booster_id = auth.uid() or booster_id is null)
  );

-- Support: read all orders (read-only)
create policy "orders: support read all"
  on orders for select
  using (public.current_user_role() = 'support');

-- Support: write access only on disputed orders
create policy "orders: support update disputed"
  on orders for update
  using (public.current_user_role() = 'support' and status = 'dispute');

-- Admin: full access
create policy "orders: admin all"
  on orders for all
  using (public.current_user_role() = 'admin');

-- ─── chat_messages policies ──────────────────────────────────────────────────

-- Participants (client + booster) can read messages for their orders
create policy "chat: read by participants"
  on chat_messages for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (o.client_id = auth.uid() or o.booster_id = auth.uid())
    )
    or public.current_user_role() in ('admin', 'support')
  );

-- Client & booster can send messages in their orders
create policy "chat: insert by participants"
  on chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.id = order_id
        and (o.client_id = auth.uid() or o.booster_id = auth.uid())
    )
  );

-- Support can write only to disputed orders
create policy "chat: support insert on dispute"
  on chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.current_user_role() = 'support'
    and exists (
      select 1 from orders o
      where o.id = order_id and o.status = 'dispute'
    )
  );
