-- 012_balance_history_column_order.sql
-- Purpose: Reorder balance_history columns to match requested sequence
-- Requested order (after id):
--   balance_id, amount, balance, transaction_id, metadata, created_at

BEGIN;

-- Create a new table with columns in the exact desired order
CREATE TABLE IF NOT EXISTS balance_history_new (
  id BIGSERIAL PRIMARY KEY,
  balance_id BIGINT NOT NULL REFERENCES balances(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL DEFAULT 0,
  balance BIGINT NOT NULL DEFAULT 0,
  transaction_id BIGINT NULL REFERENCES transactions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copy existing data into the new table preserving ids
INSERT INTO balance_history_new (id, balance_id, amount, balance, transaction_id, metadata, created_at)
SELECT id, balance_id, amount, balance, transaction_id, metadata, created_at
FROM balance_history;

-- Detach trigger from old table to avoid confusion
DROP TRIGGER IF EXISTS trg_balance_history_apply ON balance_history;

-- Swap tables
ALTER TABLE balance_history RENAME TO balance_history_old;
ALTER TABLE balance_history_new RENAME TO balance_history;

-- Recreate indexes on the new table
CREATE INDEX IF NOT EXISTS idx_balance_history_balance_id ON balance_history (balance_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_created_at ON balance_history (created_at);

-- Reattach trigger to the new table using existing function
CREATE TRIGGER trg_balance_history_apply
AFTER INSERT ON balance_history
FOR EACH ROW EXECUTE FUNCTION apply_balance_change();

-- Drop old table
DROP TABLE IF EXISTS balance_history_old;

COMMIT;