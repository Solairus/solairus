-- 022_add_agent_claim_type.sql
-- Purpose: Add 'agent_claim' to transactions.type enum constraint

BEGIN;

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
    'transfer_out',
    'agent_claim'
  ));

COMMIT;
