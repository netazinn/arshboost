-- ─── Transactions table ──────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.

create type transaction_status as enum ('pending', 'completed', 'failed', 'refunded');
create type payment_method     as enum ('card', 'paypal', 'crypto', 'balance', 'other');

create table transactions (
  id               uuid                     primary key default gen_random_uuid(),
  user_id          uuid                     not null references auth.users(id) on delete cascade,
  order_id         uuid                     references orders(id) on delete set null,
  payment_method   payment_method           not null default 'card',
  status           transaction_status       not null default 'pending',
  amount           numeric(10, 2)           not null,
  currency         text                     not null default 'USD',
  promo_code       text,
  discount_amount  numeric(10, 2)           not null default 0,
  created_at       timestamptz              not null default now(),
  updated_at       timestamptz              not null default now()
);

-- Indexes
create index transactions_user_id_idx  on transactions(user_id);
create index transactions_order_id_idx on transactions(order_id);
create index transactions_created_at_idx on transactions(created_at desc);

-- Updated_at trigger (reuse or create)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- Row-level security
alter table transactions enable row level security;

-- Clients can only view their own transactions
create policy "clients_select_own_transactions"
  on transactions for select
  using (auth.uid() = user_id);

-- Only service role can insert/update/delete
create policy "service_manage_transactions"
  on transactions for all
  using (auth.role() = 'service_role');
