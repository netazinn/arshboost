-- Revenue dashboard query performance indexes
-- These support the getRevenueStats() action which filters orders by status
-- and sums booster balances.

-- Partial index covering only the three revenue-generating statuses.
-- Dramatically reduces scan size for the revenue query.
CREATE INDEX IF NOT EXISTS idx_orders_revenue_status
  ON orders (status, price, created_at, completed_at)
  WHERE status IN ('completed', 'approved', 'waiting_action');

-- Partial index for the pending booster balances aggregation.
CREATE INDEX IF NOT EXISTS idx_profiles_booster_balance
  ON profiles (balance)
  WHERE role = 'booster';
