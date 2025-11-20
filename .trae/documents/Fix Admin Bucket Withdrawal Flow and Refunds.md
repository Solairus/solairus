## Summary
Bucket withdrawals fail at transaction simulation, likely due to a payload or account mismatch and reliance on direct on-chain calls with outdated client utilities. We will switch the withdrawal flow to the backend-first route, validate payloads and accounts before sending, add rich error logs, and implement a robust refund/recovery path for unpaid withdrawals.

## Findings
- Frontend uses direct on-chain call in `src/services/bucket/bucket-service.ts:39–74` via `program.methods.withdrawSystemBucket(...)` and imports deprecated `getProgram` from `@/lib/solairus-removed`.
- Contract requires strict account layout and role authorization; failures surface as generic simulation errors without logs.
- Backend already exposes admin bucket withdrawal init endpoints that prebuild a transaction and apply DB accounting, but UI is not using them.
- Error example indicates simulation failed with opaque logs; current handlers don’t capture and display `rpc.getLogs()`.

## Proposed Changes (4 areas)

### 1) Switch to Backend-First Bucket Withdrawal
- Replace direct Anchor call with backend init endpoint:
  - Frontend service changes:
    - Edit `src/services/bucket/bucket-service.ts`:
      - Remove `@/lib/solairus-removed` imports and `getProgram` usage.
      - Add `initAdminBucketWithdrawal(provider, bucketType, amountMicro)` that calls `POST /api/admin/buckets/:bucketType/withdraw/init`.
      - Derive `recipientAta` client-side and pass payload `{ amountMicro, mintAddress, recipientAta, memo }`.
      - Decode `txBase64`, sign with wallet, send, and confirm.
  - UI changes:
    - Edit `src/components/admin/BucketCard.tsx` to use the new service method and surface backend errors.

### 2) Validate Payload & Accounts (Prevent Bad Simulations)
- Client-side validations before init:
  - Ensure `amountMicro > 0` and not exceeding displayed bucket balance.
  - Derive and verify `recipientAta` from wallet+mint matches provided payload.
  - Confirm `mintAddress` from config/env (USDT Devnet) and cache for reuse.
- Add structured validation messages mapped in `src/utils/admin-error-handler.ts`.

### 3) Enhanced Error Logging & Diagnostics
- Augment error capture to include simulation logs:
  - In the frontend send path, catch `RpcResponseError`, call `connection.getLogs(signature or lastSimulatedBlockhash)` and attach lines to the error.
  - Propagate `context: 'Bucket withdrawal'` consistently.
- Back-end route `admin.ts` should log builder errors with encoded instruction keys and program IDs for faster triage (readable-only change: add plan to add logs).

### 4) Refunds for Unpaid Withdrawals (Recovery Job)
- Implement safe refunding when the prebuilt withdrawal init debits a bucket but the broadcast fails or expires:
  - Server changes (outline):
    - Create `server/services/refunds.ts` (shared verifier): on-chain verification of actual transfer; decide refund.
    - Update `server/routes/admin.ts` flow to mark `transactions` rows with `refund_finalized` flag and record audit trail.
    - Background worker (or scheduled job) scans `pending`/`failed` withdrawals; if not confirmed on-chain, atomically credit bucket back and set `refund_finalized=true`.
  - Verification uses:
    - Check signature status or absence.
    - Token account delta for `vaultAta` → `recipientAta`.

## Files To Touch
- Frontend:
  - `src/services/bucket/bucket-service.ts` (replace on-chain flow with backend init)
  - `src/components/admin/BucketCard.tsx` (use new service & error surfacing)
  - `src/utils/admin-error-handler.ts` (map new validation & network errors)
- Backend:
  - `server/routes/admin.ts` (ensure init endpoint surfaces clear errors; integrate refund hooks)
  - `server/services/refunds.ts` (new, shared verifier & refund logic)

## Verification Plan
- Unit test service payload validation and ATA derivation.
- Use Devnet RPC and run a withdrawal with a small amount; expect success signature.
- Force a failure (invalid mint or insufficient vault) and verify:
  - Frontend shows detailed simulation logs.
  - Backend transaction marked failed and refund job credits bucket, `refund_finalized=true`.
- Confirm no double-refunds and accurate audit logging.

## Rollback Plan
- Keep old `withdrawSystemBucket` path behind a feature flag (`USE_ONCHAIN_BUCKET_WITHDRAW=false`).
- If backend route misbehaves, toggle flag to restore old behavior temporarily.

## Assumptions
- USDT mint is known and available via config/env (Devnet).
- Admin wallet has permission to withdraw via backend route; role-based access enforced server-side.
- We can add a small server module for refunds.

Please confirm this plan. Once approved, I’ll implement the changes and run a full verification on Devnet.