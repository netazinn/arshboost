-- Add booster balance column to profiles
alter table profiles
  add column if not exists balance numeric(10,2) not null default 0.00
    constraint profiles_balance_nonneg check (balance >= 0);

comment on column profiles.balance is 'Accumulated booster earnings (USD), credited on order approval.';
