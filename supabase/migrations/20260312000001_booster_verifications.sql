-- Creates the booster_verifications table for the ID verification workflow.

create table if not exists public.booster_verifications (
  id                    uuid        not null default gen_random_uuid() primary key,
  user_id               uuid        not null references public.profiles(id) on delete cascade,

  -- Status
  verification_status   text        not null default 'start_verification'
                        check (verification_status in ('start_verification', 'under_review', 'approved', 'declined')),

  -- Personal info
  first_name            text,
  last_name             text,
  dob                   text,            -- stored as ISO date string yyyy-mm-dd

  -- Government ID
  id_type               text check (id_type in ('passport', 'national_id')),
  id_serial_number      text,
  id_document_url       text,            -- storage path
  id_selfie_url         text,            -- storage path

  -- Address
  proof_of_address_text text,
  proof_of_address_url  text,            -- storage path

  -- Discord
  discord_username      text,
  discord_unique_id     text,

  -- Admin review
  admin_notes           text,
  reviewed_by           uuid references public.profiles(id),
  reviewed_at           timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One record per user (used as upsert conflict key)
create unique index if not exists booster_verifications_user_id_key
  on public.booster_verifications(user_id);

create index if not exists booster_verifications_status_idx
  on public.booster_verifications(verification_status);

-- RLS
alter table public.booster_verifications enable row level security;

-- Booster: full access to own record
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booster_verifications' and policyname = 'verifications: owner access'
  ) then
    create policy "verifications: owner access"
      on public.booster_verifications
      for all
      using  (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Admins: read all records
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booster_verifications' and policyname = 'verifications: admin read'
  ) then
    create policy "verifications: admin read"
      on public.booster_verifications for select
      using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'admin'
        )
      );
  end if;
end $$;
