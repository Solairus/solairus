-- Migration: Pivot balances to per-user buckets (main/bonus/reward/credit)
-- Purpose: One balance row per user; history applies changes to specific buckets

-- 1) Drop wallet/mint uniqueness and indices from previous design
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_balance_wallet_mint'
  ) THEN
    ALTER TABLE balances DROP CONSTRAINT uq_balance_wallet_mint;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- balances not present; ignore
END $$;

DROP INDEX IF EXISTS idx_balances_wallet;
DROP INDEX IF EXISTS idx_balances_mint;

-- 2) Add bucketed balance columns and migrate existing total into main_balance
ALTER TABLE balances
  ADD COLUMN IF NOT EXISTS main_balance BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_balance BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_balance BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_balance BIGINT NOT NULL DEFAULT 0;

-- Migrate old single balance (if exists) into main_balance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balances' AND column_name = 'balance'
  ) THEN
    UPDATE balances SET main_balance = balance;
  END IF;
END $$;

-- 3) Drop wallet/mint/decimals and old balance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balances' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE balances DROP COLUMN wallet_address;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balances' AND column_name = 'mint_address'
  ) THEN
    ALTER TABLE balances DROP COLUMN mint_address;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balances' AND column_name = 'decimals'
  ) THEN
    ALTER TABLE balances DROP COLUMN decimals;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balances' AND column_name = 'balance'
  ) THEN
    ALTER TABLE balances DROP COLUMN balance;
  END IF;
END $$;

-- 4) Enforce per-user cardinality and non-negative buckets
ALTER TABLE balances ALTER COLUMN user_id SET NOT NULL;
DROP INDEX IF EXISTS idx_balances_user_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_balances_user ON balances (user_id);

ALTER TABLE balances
  DROP CONSTRAINT IF EXISTS balances_non_negative,
  ADD CONSTRAINT balances_non_negative CHECK (
    main_balance >= 0 AND bonus_balance >= 0 AND reward_balance >= 0 AND credit_balance >= 0
  );

-- 5) Add bucket column to balance_history and update trigger function to route changes
ALTER TABLE balance_history
  ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'main';

ALTER TABLE balance_history
  DROP CONSTRAINT IF EXISTS chk_balance_history_bucket,
  ADD CONSTRAINT chk_balance_history_bucket CHECK (
    bucket IN ('main','bonus','reward','credit')
  );

-- Update trigger function to handle per-bucket updates
CREATE OR REPLACE FUNCTION apply_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket = 'main' THEN
    UPDATE balances SET main_balance = main_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  ELSIF NEW.bucket = 'bonus' THEN
    UPDATE balances SET bonus_balance = bonus_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  ELSIF NEW.bucket = 'reward' THEN
    UPDATE balances SET reward_balance = reward_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  ELSIF NEW.bucket = 'credit' THEN
    UPDATE balances SET credit_balance = credit_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  ELSE
    RAISE EXCEPTION 'Unknown bucket: %', NEW.bucket;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;