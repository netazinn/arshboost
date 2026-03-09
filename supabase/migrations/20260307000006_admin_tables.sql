-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Admin System: withdrawals, dispute resolution, receipts storage
-- Depends on: 20260307000005_admin_system (accountant enum value)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Withdrawals table
create table if not exists public.withdrawals (
  id             uuid          primary key default gen_random_uuid(),
  booster_id     uuid          not null references public.profiles(id) on delete cascade,
  amount         numeric(10,2) not null check (amount > 0),
  status         text          not null default 'pending' check (status in ('pending','approved','rejected')),
  transaction_id text,
  receipt_url    text,
  notes          text,
  reviewed_by    uuid          references public.profiles(id),
  reviewed_at    timestamptz,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

create index if not exists withdrawals_booster_id_idx on public.withdrawals(booster_id);
create index if not exists withdrawals_status_idx     on public.withdrawals(status);
create index if not exists withdrawals_created_at_idx on public.withdrawals(created_at desc);

-- updated_at trigger
create or replace function public.set_withdrawals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists withdrawals_updated_at on public.withdrawals;
create trigger withdrawals_updated_at
  before update on public.withdrawals
  for each row execute function public.set_withdrawals_updated_at();

-- RLS
alter table public.withdrawals enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='withdrawals' and policyname='withdrawals: booster select own') then
    execute $p$
      create policy "withdrawals: booster select own"
        on public.withdrawals for select
        using (auth.uid() = booster_id);
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='withdrawals' and policyname='withdrawals: booster insert own') then
    execute $p$
      create policy "withdrawals: booster insert own"
        on public.withdrawals for insert
        with check (auth.uid() = booster_id);
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='withdrawals' and policyname='withdrawals: admin/accountant all') then
    execute $p$
      create policy "withdrawals: admin/accountant all"
        on public.withdrawals for all
        using (
          exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role in ('admin','accountant','support')
          )
        );
    $p$;
  end if;
end $$;

-- 2. Dispute resolution columns on orders
alter table public.orders
  add column if not exists resolution_notes      text,
  add column if not exists resolution_client_pct integer check (resolution_client_pct between 0 and 100),
  add column if not exists resolved_by           uuid references public.profiles(id),
  add column if not exists resolved_at           timestamptz;

-- 3. Storage bucket for withdrawal receipts (PDFs, max 10 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Storage policies for receipts (RLS on storage.objects)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'receipts: admin upload'
  ) then
    execute $p$
      create policy "receipts: admin upload"
        on storage.objects for insert
        with check (
          bucket_id = 'receipts'
          and auth.role() = 'authenticated'
          and exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin','accountant')
          )
        );
    $p$;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'receipts: admin select'
  ) then
    execute $p$
      create policy "receipts: admin select"
        on storage.objects for select
        using (
          bucket_id = 'receipts'
          and exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin','accountant')
          )
        );
    $p$;
  end if;
exception when others then null;
end $$;

-- 4. Enable Realtime on withdrawals
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'withdrawals'
  ) then
    alter publication supabase_realtime add table public.withdrawals;
  end if;
exception when others then null;
end $$;
