-- 009_buckets.sql
-- Purpose: Track global role buckets and immutable bucket histories for distributions
-- Tables:
--  - bucket_balances: single-row ledger of current balances per role
--  - bucket_histories: append-only records of changes with post-transaction balance

BEGIN;

-- Global bucket balances (USDT units with 6 decimals)
CREATE TABLE IF NOT EXISTS bucket_balances (
  id BIGSERIAL PRIMARY KEY,
  admin NUMERIC(20,6) NOT NULL DEFAULT 0,
  dev NUMERIC(20,6) NOT NULL DEFAULT 0,
  marketer_1 NUMERIC(20,6) NOT NULL DEFAULT 0,
  marketer_2 NUMERIC(20,6) NOT NULL DEFAULT 0,
  trader NUMERIC(20,6) NOT NULL DEFAULT 0,
  reserve NUMERIC(20,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bucket_balances_non_negative CHECK (
    admin >= 0 AND dev >= 0 AND marketer_1 >= 0 AND marketer_2 >= 0 AND trader >= 0 AND reserve >= 0
  )
);

-- Touch updated_at on update
DROP TRIGGER IF EXISTS trg_bucket_balances_updated_at ON bucket_balances;
CREATE TRIGGER trg_bucket_balances_updated_at
BEFORE UPDATE ON bucket_balances
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Seed a single global row if empty
INSERT INTO bucket_balances (admin, dev, marketer_1, marketer_2, trader, reserve)
SELECT 0, 0, 0, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM bucket_balances);

-- Immutable bucket histories: per change, with post-change balance
CREATE TABLE IF NOT EXISTS bucket_histories (
  id BIGSERIAL PRIMARY KEY,
  bucket_ref TEXT NOT NULL CHECK (bucket_ref IN ('admin','dev','marketer_1','marketer_2','trader','reserve')),
  amount NUMERIC(20,6) NOT NULL, -- positive credit, negative debit
  bucket_balance NUMERIC(20,6) NOT NULL, -- balance after applying amount
  transaction_id BIGINT NULL REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bucket_histories_bucket_ref ON bucket_histories (bucket_ref);
CREATE INDEX IF NOT EXISTS idx_bucket_histories_created_at ON bucket_histories (created_at);

COMMIT;