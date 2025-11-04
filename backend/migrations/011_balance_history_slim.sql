-- 011_balance_history_slim.sql
-- Purpose: Align balance_history structure to requested minimal fields and
--          update trigger to route via metadata.bucket and increment total_earnings
-- Requested fields:
--   balance_id, amount, balance, transaction_id, metadata (optional), created_at

BEGIN;

-- 1) Drop legacy columns not in the new spec
ALTER TABLE balance_history
  DROP COLUMN IF EXISTS change,
  DROP COLUMN IF EXISTS event_type,
  DROP COLUMN IF EXISTS bucket,
  DROP COLUMN IF EXISTS source_tx_id;

-- 2) Ensure required columns exist and rename bucket_balance -> balance
ALTER TABLE balance_history
  ADD COLUMN IF NOT EXISTS amount BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_id BIGINT NULL REFERENCES transactions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balance_history' AND column_name = 'bucket_balance'
  ) THEN
    ALTER TABLE balance_history RENAME COLUMN bucket_balance TO balance;
  END IF;
END $$;

-- 3) Backfill amount for rows that previously used 'change'
--    (010 migration may have set amount already; this is defensive)
UPDATE balance_history
SET amount = COALESCE(amount, 0)
WHERE amount IS NULL;

-- 4) Update trigger to use metadata.bucket and apply changes
--    Rule: every increment to balances (bonus or reward) also increments total_earnings;
--          credit_balance does NOT increment total_earnings.
CREATE OR REPLACE FUNCTION apply_balance_change()
RETURNS TRIGGER AS $$
DECLARE
  target_bucket TEXT;
  next_balance BIGINT;
BEGIN
  -- Determine target bucket from metadata; default to 'bonus' if absent
  target_bucket := COALESCE((NEW.metadata ->> 'bucket'), 'bonus');

  IF target_bucket = 'bonus' THEN
    UPDATE balances SET bonus_balance = bonus_balance + NEW.amount, updated_at = NOW() WHERE id = NEW.balance_id;
    -- Increment total_earnings for non-credit buckets
    IF NEW.amount > 0 THEN
      UPDATE balances SET total_earnings = total_earnings + NEW.amount WHERE id = NEW.balance_id;
    END IF;
    SELECT bonus_balance INTO next_balance FROM balances WHERE id = NEW.balance_id;
  ELSIF target_bucket = 'reward' THEN
    UPDATE balances SET reward_balance = reward_balance + NEW.amount, updated_at = NOW() WHERE id = NEW.balance_id;
    IF NEW.amount > 0 THEN
      UPDATE balances SET total_earnings = total_earnings + NEW.amount WHERE id = NEW.balance_id;
    END IF;
    SELECT reward_balance INTO next_balance FROM balances WHERE id = NEW.balance_id;
  ELSIF target_bucket = 'credit' THEN
    UPDATE balances SET credit_balance = credit_balance + NEW.amount, updated_at = NOW() WHERE id = NEW.balance_id;
    -- Do NOT increment total_earnings for credit bucket
    SELECT credit_balance INTO next_balance FROM balances WHERE id = NEW.balance_id;
  ELSE
    RAISE EXCEPTION 'Unknown target bucket in metadata: %', target_bucket;
  END IF;

  -- Set post-change balance snapshot on the inserted history row
  UPDATE balance_history SET balance = next_balance WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Recreate trigger to ensure updated function is applied
DROP TRIGGER IF EXISTS trg_balance_history_apply ON balance_history;
CREATE TRIGGER trg_balance_history_apply
AFTER INSERT ON balance_history
FOR EACH ROW EXECUTE FUNCTION apply_balance_change();

COMMIT;