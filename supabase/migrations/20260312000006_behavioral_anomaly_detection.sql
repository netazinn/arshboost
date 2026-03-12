-- ─── Behavioral Anomaly Detection Schema ────────────────────────────────────
--
-- Adds:
--   1. `risk_flags`   TEXT[]  on profiles  — list of violation codes
--   2. `risk_score`   INT     on profiles  — 0-100 severity score
--   3. `manual_review` BOOL   on orders    — admin must approve before proceeding
--   4. `user_flags`   table                — audit log of every flag event
--   5. `payment_attempts` table            — rolling payment velocity window
--   6. `prev_sign_in_ip` TEXT on profiles  — previous IP for impossible travel
--   7. `prev_sign_in_at` TIMESTAMPTZ on profiles — previous sign-in time

-- ─── 1. Extend profiles ───────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists risk_flags   text[]      not null default '{}',
  add column if not exists risk_score   int         not null default 0,
  add column if not exists prev_sign_in_ip  text,
  add column if not exists prev_sign_in_at  timestamptz;

comment on column public.profiles.risk_flags      is 'Array of active flag codes e.g. DLP_VIOLATION, IMPOSSIBLE_TRAVEL';
comment on column public.profiles.risk_score      is 'Aggregated risk score 0–100';
comment on column public.profiles.prev_sign_in_ip is 'IP address of the previous login session (for impossible travel detection)';
comment on column public.profiles.prev_sign_in_at is 'Timestamp of the previous login session';

-- ─── 2. Extend orders ─────────────────────────────────────────────────────────

alter table public.orders
  add column if not exists manual_review bool not null default false;

comment on column public.orders.manual_review is 'When true, order is held for admin approval before entering the booster pool';

-- ─── 3. user_flags audit log ─────────────────────────────────────────────────

create table if not exists public.user_flags (
  id          uuid        not null default gen_random_uuid() primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  flag        text        not null,   -- e.g. 'DLP_VIOLATION', 'IMPOSSIBLE_TRAVEL', 'PAYMENT_VELOCITY'
  detail      text,                   -- human-readable context / snippet
  created_at  timestamptz not null default now()
);

create index if not exists user_flags_user_id_idx  on public.user_flags(user_id);
create index if not exists user_flags_flag_idx      on public.user_flags(flag);
create index if not exists user_flags_created_at_idx on public.user_flags(created_at desc);

alter table public.user_flags enable row level security;

-- Admins + support can read; nobody (except service role) can insert via client
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_flags' and policyname = 'user_flags: admin read'
  ) then
    create policy "user_flags: admin read"
      on public.user_flags for select to authenticated
      using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role in ('admin', 'support')
        )
      );
  end if;
end $$;

-- ─── 4. payment_attempts velocity table ──────────────────────────────────────

create table if not exists public.payment_attempts (
  id         uuid        not null default gen_random_uuid() primary key,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  amount     numeric(10,2) not null,
  status     text        not null check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists payment_attempts_user_id_idx    on public.payment_attempts(user_id);
create index if not exists payment_attempts_created_at_idx on public.payment_attempts(created_at desc);

alter table public.payment_attempts enable row level security;

-- Service role only — no direct client access
-- (RLS enabled with no permissive policies = service role bypass required)
