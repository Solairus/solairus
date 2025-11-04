-- 010_balance_history_revised.sql
-- Purpose: Revise balance_history to mirror bucket_histories pattern
-- Changes:
--  - Add amount (microunits, BIGINT) mirroring change
--  - Add bucket_balance (post-change microunits, BIGINT)
--  - Update trigger to set amount and bucket_balance on insert

BEGIN;

-- 1) Add columns to balance_history
ALTER TABLE balance_history
  ADD COLUMN IF NOT EXISTS amount BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bucket_balance BIGINT NOT NULL DEFAULT 0;

-- 2) Backfill amount from change for existing rows (best-effort)
UPDATE balance_history SET amount = change WHERE amount = 0;

-- 3) Update trigger function to populate bucket_balance and amount
CREATE OR REPLACE FUNCTION apply_balance_change()
RETURNS TRIGGER AS $$
DECLARE
  next_balance BIGINT;
BEGIN
  -- Route updates to correct bucket and compute post-change bucket balance
  IF NEW.bucket = 'bonus' THEN
    UPDATE balances SET bonus_balance = bonus_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
    SELECT bonus_balance INTO next_balance FROM balances WHERE id = NEW.balance_id;
  ELSIF NEW.bucket = 'reward' THEN
    UPDATE balances SET reward_balance = reward_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
    IF NEW.change > 0 THEN
      UPDATE balances SET total_earnings = total_earnings + NEW.change WHERE id = NEW.balance_id;
    END IF;
    SELECT reward_balance INTO next_balance FROM balances WHERE id = NEW.balance_id;
  ELSIF NEW.bucket = 'credit' THEN
    UPDATE balances SET credit_balance = credit_balance + NEW.change, updated_at = NOW() WHERE id = NEW.balance_id;
    SELECT credit_balance INTO next_balance FROM balances WHERE id = NEW.balance_id;
  ELSE
    RAISE EXCEPTION 'Unknown bucket: %', NEW.bucket;
  END IF;

  -- Mirror change into amount, and set post-change bucket_balance
  UPDATE balance_history SET amount = NEW.change, bucket_balance = next_balance WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Ensure trigger exists (recreate for safety)
DROP TRIGGER IF EXISTS trg_balance_history_apply ON balance_history;
CREATE TRIGGER trg_balance_history_apply
AFTER INSERT ON balance_history
FOR EACH ROW EXECUTE FUNCTION apply_balance_change();

COMMIT;