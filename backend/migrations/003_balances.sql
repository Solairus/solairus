-- Migration: Balances and Balance History
-- Purpose: Track current balances per wallet/mint and immutable history of changes
-- Notes: Keep single source of truth for withdrawals in transactions; history may link to transactions

-- Balances table: one row per wallet + mint
CREATE TABLE IF NOT EXISTS balances (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  mint_address TEXT NOT NULL,
  decimals SMALLINT NOT NULL DEFAULT 6,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_balance_wallet_mint UNIQUE (wallet_address, mint_address)
);

CREATE INDEX IF NOT EXISTS idx_balances_wallet ON balances (wallet_address);
CREATE INDEX IF NOT EXISTS idx_balances_mint ON balances (mint_address);
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON balances (user_id);
CREATE INDEX IF NOT EXISTS idx_balances_created_at ON balances (created_at);

DROP TRIGGER IF EXISTS trg_balances_updated_at ON balances;
CREATE TRIGGER trg_balances_updated_at
BEFORE UPDATE ON balances
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Balance history: immutable ledger of balance changes
CREATE TABLE IF NOT EXISTS balance_history (
  id BIGSERIAL PRIMARY KEY,
  balance_id BIGINT NOT NULL REFERENCES balances(id) ON DELETE CASCADE,
  change BIGINT NOT NULL, -- positive for credit, negative for debit
  event_type TEXT NOT NULL CHECK (event_type IN ('deposit','withdrawal','reward','adjustment')),
  source_tx_id BIGINT NULL REFERENCES transactions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_history_balance_id ON balance_history (balance_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_created_at ON balance_history (created_at);

-- Trigger: apply balance changes after history insert
CREATE OR REPLACE FUNCTION apply_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE balances SET balance = balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_balance_history_apply ON balance_history;
CREATE TRIGGER trg_balance_history_apply
AFTER INSERT ON balance_history
FOR EACH ROW EXECUTE FUNCTION apply_balance_change();