-- Migration: Remove main_balance; add total_earnings; route history buckets
-- Purpose: Align balances with per-user buckets (bonus/reward/credit) and cumulative total_earnings

-- 1) Add total_earnings column
ALTER TABLE balances
  ADD COLUMN IF NOT EXISTS total_earnings BIGINT NOT NULL DEFAULT 0;

-- 2) Migrate any existing main_balance into credit_balance, then drop main_balance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balances' AND column_name = 'main_balance'
  ) THEN
    UPDATE balances SET credit_balance = COALESCE(credit_balance, 0) + COALESCE(main_balance, 0);
    ALTER TABLE balances DROP COLUMN main_balance;
  END IF;
END $$;

-- 3) Recreate non-negative constraint for buckets + total_earnings
ALTER TABLE balances DROP CONSTRAINT IF EXISTS balances_non_negative;
ALTER TABLE balances ADD CONSTRAINT balances_non_negative CHECK (
  bonus_balance >= 0 AND reward_balance >= 0 AND credit_balance >= 0 AND total_earnings >= 0
);

-- 4) Migrate any existing 'main' bucket entries to 'credit'
UPDATE balance_history SET bucket = 'credit' WHERE bucket = 'main';

-- 5) Restrict balance_history buckets to bonus/reward/credit only
ALTER TABLE balance_history DROP CONSTRAINT IF EXISTS chk_balance_history_bucket;
ALTER TABLE balance_history ADD CONSTRAINT chk_balance_history_bucket CHECK (
  bucket IN ('bonus','reward','credit')
);

-- 6) Update trigger function to route bucket updates and increment total_earnings on reward credits
CREATE OR REPLACE FUNCTION apply_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket = 'bonus' THEN
    UPDATE balances SET bonus_balance = bonus_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  ELSIF NEW.bucket = 'reward' THEN
    UPDATE balances SET reward_balance = reward_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
    IF NEW.change > 0 THEN
      UPDATE balances SET total_earnings = total_earnings + NEW.change WHERE id = NEW.balance_id;
    END IF;
  ELSIF NEW.bucket = 'credit' THEN
    UPDATE balances SET credit_balance = credit_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
  ELSE
    RAISE EXCEPTION 'Unknown bucket: %', NEW.bucket;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;