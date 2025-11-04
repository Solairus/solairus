-- 014_bucket_histories_enforce_txid.sql
-- Purpose: Enforce transaction_id presence and uniqueness per bucket_ref to ensure one history per update

BEGIN;

-- Backfill NULL transaction_ids with a synthetic system transaction, then enforce NOT NULL
DO $$
DECLARE backfill_tx BIGINT;
BEGIN
  INSERT INTO transactions (
    type, status, signature, initiator_wallet, recipient_wallet, program_id,
    amount, mint_address, decimals, metadata
  ) VALUES (
    'agent_activation', 'confirmed', NULL, 'system', 'system', NULL,
    0, 'unknown-mint', 6, jsonb_build_object('note','backfill for bucket_histories NULL transaction_id')
  ) RETURNING id INTO backfill_tx;

  UPDATE bucket_histories SET transaction_id = backfill_tx WHERE transaction_id IS NULL;
END $$;

-- Require transaction_id on bucket_histories (a single transaction can affect multiple buckets)
ALTER TABLE bucket_histories
  ALTER COLUMN transaction_id SET NOT NULL;

COMMIT;