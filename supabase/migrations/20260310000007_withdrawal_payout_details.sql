-- Add payout destination field (IBAN / crypto wallet / etc.) to withdrawals
alter table public.withdrawals
  add column if not exists payout_details text;

-- ─── Atomic withdrawal RPC ────────────────────────────────────────────────────
-- Single function that:
--   1. Locks the profile row (FOR UPDATE) → prevents double-spend race conditions
--   2. Validates minimum amount ($50) and sufficient balance
--   3. Deducts balance from profiles
--   4. Inserts a 'pending' withdrawal row
-- Returns the new withdrawal UUID so the caller can reference it.
create or replace function request_withdrawal(
  p_user_id       uuid,
  p_amount        numeric,
  p_payout_details text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance       numeric;
  v_withdrawal_id uuid;
begin
  if p_amount < 50 then
    raise exception 'BELOW_MINIMUM: Minimum withdrawal amount is $50.';
  end if;

  if p_payout_details is null or trim(p_payout_details) = '' then
    raise exception 'MISSING_PAYOUT_DETAILS: Payout destination is required.';
  end if;

  -- Lock the row so no concurrent withdrawal can read the same (un-decremented) balance
  select balance
    into v_balance
    from profiles
   where id = p_user_id
     for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE: Available balance is $%.', v_balance;
  end if;

  update profiles
     set balance    = balance - p_amount,
         updated_at = now()
   where id = p_user_id;

  insert into withdrawals (booster_id, amount, payout_details, status)
  values (p_user_id, p_amount, trim(p_payout_details), 'pending')
  returning id into v_withdrawal_id;

  return v_withdrawal_id;
end;
$$;

-- Deny direct invocation by end-users; only service-role bypasses this
revoke execute on function request_withdrawal(uuid, numeric, text) from public;
