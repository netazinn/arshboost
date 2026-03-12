-- Atomic balance increment to avoid read-modify-write race conditions.
-- Called by the service-role client only (no RLS exposure to end-users).
create or replace function increment_profile_balance(
  p_user_id uuid,
  p_amount  numeric
)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set balance     = balance + p_amount,
         updated_at  = now()
   where id = p_user_id;
$$;

-- Revoke direct execution from all roles; the service-role bypasses RLS/grants
-- via the security-definer context, so no explicit grant is needed.
revoke execute on function increment_profile_balance(uuid, numeric) from public;
