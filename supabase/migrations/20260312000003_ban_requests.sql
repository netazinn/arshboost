-- Ban/Unban request queue — lets support agents submit ban requests
-- that require admin approval before taking effect.

create table if not exists public.ban_requests (
  id           uuid        not null default gen_random_uuid() primary key,
  target_id    uuid        not null references public.profiles(id) on delete cascade,
  requested_by uuid        not null references public.profiles(id),
  action       text        not null check (action in ('ban', 'unban')),
  reason       text,
  status       text        not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  resolved_by  uuid        references public.profiles(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists ban_requests_status_idx
  on public.ban_requests(status);

create index if not exists ban_requests_target_idx
  on public.ban_requests(target_id);

-- RLS
alter table public.ban_requests enable row level security;

-- Support + admin can insert requests
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ban_requests' and policyname = 'ban_requests: staff insert'
  ) then
    create policy "ban_requests: staff insert"
      on public.ban_requests for insert to authenticated
      with check (
        requested_by = auth.uid()
        and exists (
          select 1 from public.profiles
          where id = auth.uid() and role in ('support', 'admin')
        )
      );
  end if;
end $$;

-- Support can read their own requests; admins can read all
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ban_requests' and policyname = 'ban_requests: read'
  ) then
    create policy "ban_requests: read"
      on public.ban_requests for select to authenticated
      using (
        requested_by = auth.uid()
        or exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'admin'
        )
      );
  end if;
end $$;
