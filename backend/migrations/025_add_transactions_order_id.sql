-- 025_add_transactions_order_id.sql
-- Purpose: Add order_id column to transactions table for consistent
--          order tracking across all withdrawal types (user + role).
--          Every withdrawal flow now creates an order UUID that persists
--          in the ledger alongside the on-chain signature.

BEGIN;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Index for order_id lookups (admin reconciliation, user support)
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions (order_id);

COMMIT;
