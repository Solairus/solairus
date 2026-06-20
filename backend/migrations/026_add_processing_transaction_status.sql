-- 026_add_processing_transaction_status.sql
-- Purpose: Add 'processing' to the transactions.status check constraint.
--          The two-phase withdrawal pattern inserts rows with status='processing'
--          before the on-chain send completes, then updates to 'confirmed' or 'failed'.
--          This status was already used by withdrawals.ts but never added to the constraint.

BEGIN;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending','processing','confirmed','completed','failed'));

COMMIT;
