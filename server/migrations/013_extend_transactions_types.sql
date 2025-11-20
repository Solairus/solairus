-- 013_extend_transactions_types.sql
-- Purpose: Extend transactions.type enum to support admin credit/debit and transfers.
-- Also extend transactions.status to include 'completed'.

BEGIN;

-- Extend type check constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'license_activation',
    'agent_activation',
    'user_withdrawal',
    'role_withdrawal',
    'admin_credit',
    'admin_debit',
    'transfer_in',
    'transfer_out'
  ));

-- Extend status check constraint to include 'completed'
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending','confirmed','completed','failed'));

COMMIT;