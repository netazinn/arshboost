-- ─── Tighten booster UPDATE RLS policy ───────────────────────────────────────
--
-- The original "orders: booster update" policy had no WITH CHECK clause,
-- meaning a booster could theoretically set any column value on their row.
-- This migration replaces it with an explicit policy that:
--   USING  → row is visible/updateable only if it's the booster's own assigned order
--   WITH CHECK → after the update the row must still match one of the valid
--                boosting statuses (prevents a booster from, e.g., marking
--                an order as 'completed' directly, bypassing client approval).
--
-- NOTE: executeOrderAction uses the service role (bypasses RLS).
-- This policy is the defence-in-depth layer for any direct client-side
-- Supabase calls and future direct-SDK paths.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "orders: booster update" on orders;

create policy "orders: booster update"
  on orders
  for update
  using (
    -- Can only touch rows assigned to this booster
    public.current_user_role() = 'booster'
    and booster_id = auth.uid()
  )
  with check (
    -- After the update the row must still be this booster's row
    booster_id = auth.uid()
    -- Only allow the status transitions a booster is permitted to make
    and status in (
      'in_progress',       -- progressing / claiming back
      'waiting_action',    -- mark complete → waiting for client approval
      'dispute',           -- open dispute
      'cancel_requested'   -- request cancellation
    )
  );

-- Keep the claim policy separate (booster_id is null → claiming an open order)
drop policy if exists "orders: booster claim" on orders;

create policy "orders: booster claim"
  on orders
  for update
  using (
    public.current_user_role() = 'booster'
    and booster_id is null
    and status = 'in_progress'
  )
  with check (
    booster_id = auth.uid()
    and status = 'in_progress'
  );
