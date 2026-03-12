-- Add is_banned column to profiles for user suspension management

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

comment on column public.profiles.is_banned is
  'When true the user is suspended and cannot access the platform.';

-- Index for fast lookup during auth checks
create index if not exists profiles_is_banned_idx on public.profiles (is_banned)
  where is_banned = true;
