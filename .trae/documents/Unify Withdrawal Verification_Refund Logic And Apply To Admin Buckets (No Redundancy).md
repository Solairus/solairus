## Objectives
- Reuse the same secure verification-first refund flow for admin bucket withdrawals without duplicating code.
- Extract shared on-chain verification and one-time refund finalization into a common module.

## Design (Shared Library)
- Create `server/services/withdrawal_verifier.ts` with:
  - `deriveReference(orderId, programId): PublicKey`
  - `findSignatureByReference(conn, reference): Promise<string|null>`
  - `verifyTokenDelta(conn, signature, owner, mint, amountMicro, decimals): Promise<boolean>`
  - `finalizeRecovery(client, record, signature, extraMeta)` → updates transaction to `confirmed`, attaches signature.
  - `finalizeRefund(client, record, bucketOrBalanceRef, amountMicro, extraMeta)` → credits back exactly once, sets `{ refund:true, refund_finalized:true }`.
- These functions will be used by both user affiliate refunds and admin bucket refunds.

## Integrations
1) Affiliate Refund (`server/services/withdrawal_refund.ts`)
- Replace inline reference/verification/refund logic with calls to `withdrawal_verifier`.
- Keep existing behavior: single on-chain check; if not found, perform single final refund to `bonus_balance`.

2) Admin Bucket Refund (New Service)
- Add `server/services/bucket_withdrawal_refund.ts`:
  - `attemptExpiredBucketWithdrawalRefund(orderId: string)` that mirrors affiliate refund:
    - Guard on `type='role_withdrawal'`, `status='pending'`, and `refund_finalized!==true`.
    - On-chain signature recovery and verification (same shared functions).
    - If valid: finalize recovery.
    - If not found: credit back `bucket_balances.<bucketType>` and write `bucket_histories`, then finalize refund (single-shot).
- Bucket type comes from `transactions.metadata.bucket_type`.

3) Admin Routes Hook (Optional)
- If there is a background job runner, wire bucket refund attempts there; otherwise expose an internal endpoint `POST /admin/buckets/withdraw/refund/:orderId` for manual retries (admin only).
- No UI change required right now.

## Security & Idempotency
- Single final refund: set `refund_finalized: true` in `transactions.metadata`; all paths skip further processing for that order_id.
- On-chain verification first; no local balance pre-checks.
- Transactional DB writes with row locks.

## Tests
- Shared verifier tests: reference derivation, signature recovery, token delta verification.
- Affiliate refund tests: recovered vs refunded.
- Bucket refund tests: recovered vs refunded, bucket history snapshot correctness.

## Files To Update/Create
- New: `server/services/withdrawal_verifier.ts`
- Update: `server/services/withdrawal_refund.ts` to use shared functions
- New: `server/services/bucket_withdrawal_refund.ts`
- (Optional) Update: `server/routes/admin.ts` to expose an internal admin-only refund trigger endpoint or integrate with existing scheduler.

## Rollout
- Implement, add tests, and enable via existing TTL triggers. No external API contract changes.

If you confirm, I will implement the shared module, refactor affiliate refund to use it, and add bucket refund service with the same secure flow while avoiding redundancy.