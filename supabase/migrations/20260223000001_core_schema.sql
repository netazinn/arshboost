-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Core Schema Migration 001
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type user_role as enum ('admin', 'booster', 'client', 'support');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type service_type as enum (
    'rank_boost',
    'win_boost',
    'duo_boost',
    'placement_matches',
    'unrated_matches'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum (
    'pending',
    'awaiting_payment',
    'in_progress',
    'completed',
    'cancelled',
    'dispute'
  );
exception when duplicate_object then null;
end $$;

-- ─── profiles ────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text        not null unique,
  role        user_role   not null default 'client',
  username    text        unique,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  profiles              is 'Extended user data linked to Supabase Auth.';
comment on column profiles.role         is 'Access control role: admin | booster | client | support';

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure public.set_updated_at();

-- ─── games ───────────────────────────────────────────────────────────────────

create table if not exists games (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  slug       text        not null unique,
  logo_url   text        not null,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

comment on table games is 'Supported games on the platform (e.g. League of Legends, Valorant).';

-- ─── games_services ──────────────────────────────────────────────────────────

create table if not exists games_services (
  id          uuid         primary key default gen_random_uuid(),
  game_id     uuid         not null references games(id) on delete cascade,
  type        service_type not null,
  label       text         not null,
  base_price  numeric(10,2) not null check (base_price >= 0),
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  unique (game_id, type)
);

comment on table  games_services            is 'Services available per game.';
comment on column games_services.base_price is 'Base price in USD cents stored as decimal.';

-- ─── orders ──────────────────────────────────────────────────────────────────

create table if not exists orders (
  id          uuid         primary key default gen_random_uuid(),
  client_id   uuid         not null references profiles(id) on delete restrict,
  booster_id  uuid         references profiles(id) on delete set null,
  game_id     uuid         not null references games(id) on delete restrict,
  service_id  uuid         not null references games_services(id) on delete restrict,
  status      order_status not null default 'pending',
  price       numeric(10,2) not null check (price >= 0),
  details     jsonb        not null default '{}',
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

comment on table  orders          is 'Boost orders placed by clients.';
comment on column orders.details  is 'Game-specific metadata (e.g. current rank, target rank).';
comment on column orders.price    is 'Final calculated price at time of order.';

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute procedure public.set_updated_at();

-- Index for client dashboard queries
create index if not exists idx_orders_client_id  on orders(client_id);
create index if not exists idx_orders_booster_id on orders(booster_id);
create index if not exists idx_orders_status     on orders(status);

-- ─── chat_messages ───────────────────────────────────────────────────────────

create table if not exists chat_messages (
  id         uuid        primary key default gen_random_uuid(),
  order_id   uuid        not null references orders(id) on delete cascade,
  sender_id  uuid        not null references profiles(id) on delete restrict,
  content    text        not null default '',
  image_url  text,
  created_at timestamptz not null default now()
);

comment on table chat_messages is 'Per-order chat between client, booster, and support.';

create index if not exists idx_chat_messages_order_id on chat_messages(order_id);
