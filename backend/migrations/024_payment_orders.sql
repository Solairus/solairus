-- 024_payment_orders.sql
-- Purpose: HD-wallet payment orders (per-transaction deposit addresses) for the
--          contract-free payment model. One row per order; the row IS the address map.
--          Also extends transactions.type to allow 'deposit' (top-up) ledger entries.
-- Notes: amounts in micro-USDT (6 decimals). hd_index 0 is reserved for the treasury.

BEGIN;

CREATE TABLE IF NOT EXISTS payment_orders (
  id              BIGSERIAL PRIMARY KEY,
  order_ref       TEXT NOT NULL UNIQUE,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hd_index        BIGINT NOT NULL,
  address         TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('license','agent','deposit')),
  tier_id         INTEGER,
  expected_micro  BIGINT,                     -- NULL/0 for open-ended deposit
  status          TEXT NOT NULL CHECK (status IN ('pending','processing','completed','cancelled','expired')) DEFAULT 'pending',
  tx_signature    TEXT UNIQUE,                -- sweep/settlement signature (replay + idempotency guard)
  transaction_id  BIGINT,                     -- ledger link
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status_expiry ON payment_orders (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_status ON payment_orders (user_id, status);

-- At most one live order per hd_index (so a reused index can't collide with a live one).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_orders_active_index
  ON payment_orders (hd_index)
  WHERE status IN ('pending','processing','completed');

DROP TRIGGER IF EXISTS trg_payment_orders_updated_at ON payment_orders;
CREATE TRIGGER trg_payment_orders_updated_at
BEFORE UPDATE ON payment_orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Extend transactions.type to allow 'deposit' (top-up credits)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'license_activation',
    'agent_activation',
    'user_withdrawal',
    'role_withdrawal',
    'admin_credit',
    'admin_debit',
    'transfer_in',
    'transfer_out',
    'agent_claim',
    'deposit'
  ));

COMMIT;
