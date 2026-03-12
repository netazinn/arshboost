-- Automatically snapshot the current IP/timestamp as "prev" when Supabase Auth
-- updates last_sign_in_at for a user. This powers impossible travel detection.
--
-- Supabase stores auth data in auth.users. We listen via a trigger on auth.users
-- and copy last_sign_in_ip → prev_sign_in_ip (and last_sign_in_at → prev_sign_in_at)
-- on the public.profiles row ONLY when the IP actually changes.

create or replace function public.snapshot_prev_signin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only act when last_sign_in_at advances (i.e. a real new login)
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or new.last_sign_in_at > old.last_sign_in_at)
  then
    update public.profiles
    set
      prev_sign_in_ip = old.last_sign_in_ip,
      prev_sign_in_at = old.last_sign_in_at
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_snapshot_prev_signin on auth.users;
create trigger trg_snapshot_prev_signin
  after update on auth.users
  for each row execute procedure public.snapshot_prev_signin();
