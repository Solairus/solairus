-- 013_balance_history_no_trigger.sql
-- Purpose: Remove trigger-based balance updates and enforce one-history-per-update via transaction_id

BEGIN;

-- Remove legacy trigger and function entirely
DROP TRIGGER IF EXISTS trg_balance_history_apply ON balance_history;
DROP FUNCTION IF EXISTS apply_balance_change();

-- Enforce transaction_id requirement for history rows (one update may emit many histories)
ALTER TABLE balance_history
  ALTER COLUMN transaction_id SET NOT NULL;

COMMIT;