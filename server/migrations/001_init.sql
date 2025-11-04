-- Migration: Initial schema for transaction tracking
-- Purpose: Create core tables and indexes for recording payments and withdrawals.
-- Notes: Keep it simple and focused; no unnecessary abstractions.

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('license_activation','agent_activation','user_withdrawal','role_withdrawal')),
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','failed')) DEFAULT 'pending',
  signature TEXT UNIQUE,
  initiator_wallet TEXT NOT NULL,
  recipient_wallet TEXT,
  program_id TEXT,
  amount BIGINT NOT NULL,
  mint_address TEXT NOT NULL,
  decimals SMALLINT NOT NULL DEFAULT 6,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes to support common queries
CREATE INDEX IF NOT EXISTS idx_tx_signature ON transactions (signature);
CREATE INDEX IF NOT EXISTS idx_tx_initiator ON transactions (initiator_wallet);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_created_at ON transactions (created_at);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();