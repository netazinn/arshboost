-- The snapshot_prev_signin trigger referenced old.last_sign_in_ip which does
-- not exist on auth.users (IP lives in auth.sessions, not auth.users).
-- This caused "Database error granting user" on every login attempt.
-- Drop the trigger and its function so logins work again.

drop trigger if exists trg_snapshot_prev_signin on auth.users;
drop function if exists public.snapshot_prev_signin();
