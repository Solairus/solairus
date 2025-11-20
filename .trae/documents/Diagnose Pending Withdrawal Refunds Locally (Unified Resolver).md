## Goals
- Confirm why existing pending withdrawals aren’t refunded
- Validate the unified resolver (`POST /api/transactions/pending/resolve`) works
- Identify concrete blockers (TTL, bucket_type missing, user row missing, RPC 429) and fix

## Checklist & Quick Diagnostics
1) List all pending rows for your wallet
- `curl -s "http://localhost:4000/api/transactions?wallet=<WALLET>&status=pending&limit=50" -H "Authorization: Bearer <token>" | jq .`
- Inspect for:
  - `type` ∈ {user_withdrawal, role_withdrawal}
  - `metadata.ttlMs` (defaults 120000 if absent)
  - `metadata.bucket_type` (required for role_withdrawal refund)
  - `signature` present/absent
  - `metadata.refund_finalized` (should be false/null)

2) Trigger resolver once and re-check
- `curl -s -X POST http://localhost:4000/api/transactions/pending/resolve -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"walletAddress":"<WALLET>"}' -o /dev/null -w "%{http_code}\n"`
- `curl -s "http://localhost:4000/api/transactions?wallet=<WALLET>&status=pending&limit=50" -H "Authorization: Bearer <token>" | jq .`
- Expect:
  - Confirmed items: `status=confirmed`, `metadata.completed=true`
  - Refunded items: `status=failed`, `metadata.refund_finalized=true`

3) Verify audit tables for refunds
- Bucket refunds: `SELECT * FROM bucket_histories ORDER BY created_at DESC LIMIT 10;`
- User refunds: `SELECT * FROM balance_history ORDER BY created_at DESC LIMIT 10;`
- Check entries match `transaction_id`, amounts and `metadata.reason='withdrawal_refund'`

## Common Root Causes to Check
- Not expired: `created_at + ttlMs` not elapsed → resolver does nothing (expected)
- Role withdrawal missing `metadata.bucket_type` → resolver returns `missing_bucket_type` and skips refund
- User row missing: `users.user_address` not found → resolver returns `user_not_found` and skips refund
- RPC 429 rate-limits prevent reference/signature lookup → resolver returns early; mitigation: process fewer records per call and batch status checks
- Cluster mismatch: ensure `SOLANA_CLUSTER=mainnet-beta` so signature/reference lookup matches deployed program

## Local Repro (Optional Seeding)
- Create a pending role withdrawal (with bucket_type):
  - `curl -s -X POST http://localhost:4000/api/transactions -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"type":"role_withdrawal","initiatorWallet":"<WALLET>","amount":1000000,"mintAddress":"<USDT_MINT>","decimals":6,"metadata":{"bucket_type":"dev","ttlMs":60000}}' | jq .`
- Create a pending user withdrawal:
  - Ensure `users.user_address=<WALLET>` exists; then:
  - `curl -s -X POST http://localhost:4000/api/transactions -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"type":"user_withdrawal","initiatorWallet":"<WALLET>","amount":1000000,"mintAddress":"<USDT_MINT>","decimals":6,"metadata":{"ttlMs":60000}}' | jq .`
- Wait TTL expiry, call resolver, and verify updates/audit rows as above

## Proposed Fixes After Diagnosis
- If `bucket_type` is missing in role withdrawals: ensure admin bucket init writes `metadata.bucket_type` when creating transaction rows
- If `user_not_found`: auto-create balances row for the wallet before refund
- If rate-limited: limit resolver to process ≤10 records per call and batch `getSignatureStatuses` requests
- If cluster or program ID mismatch: confirm `SOLAIRUS_PAY_PROGRAM_ID` and env cluster

## Frontend Trigger (Already Wired)
- WalletContext posts `/api/transactions/pending/resolve` once per wallet connect; no UI blocking, returns 200 silently. We’ll rely on backend to resolve and audits to confirm.

Approve and I will run these diagnostics (with example commands) and implement targeted fixes based on findings. 