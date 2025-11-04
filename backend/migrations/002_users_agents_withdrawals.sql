-- Migration: Add users, agents tables and withdrawals view
-- Purpose: Normalize key entities and provide a filtered withdrawals view from transactions
-- Notes: Follows single-source-of-truth by deriving withdrawals from transactions

-- Users table: tracks license status, expiration, and referral
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  user_address TEXT NOT NULL UNIQUE,
  license_status TEXT NOT NULL CHECK (license_status IN ('none','active','expired','revoked')) DEFAULT 'none',
  license_expiration TIMESTAMPTZ NULL,
  ref_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_user_address ON users (user_address);
CREATE INDEX IF NOT EXISTS idx_users_license_status ON users (license_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

-- Trigger to keep updated_at current (reuses touch_updated_at)
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Agents table: records user-activated agents
CREATE TABLE IF NOT EXISTS agents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_label TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','suspended')) DEFAULT 'active',
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ NULL,
  activation_signature TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents (user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_activated_at ON agents (activated_at);

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Withdrawals view: filters withdrawals from transactions to preserve single source of truth
CREATE OR REPLACE VIEW withdrawals AS
SELECT
  id AS transaction_id,
  CASE WHEN type = 'user_withdrawal' THEN 'user' ELSE 'role' END AS withdrawal_type,
  status,
  signature,
  initiator_wallet,
  recipient_wallet,
  program_id,
  amount,
  mint_address,
  decimals,
  metadata,
  created_at,
  updated_at
FROM transactions
WHERE type IN ('user_withdrawal','role_withdrawal');