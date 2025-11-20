## Summary
We will remove the separate pending-withdrawals resolver endpoint and consolidate “pending resolution” under the existing Transactions router, reusing the same pluggable verification modules utilized for license and agent activations. The frontend will call one unified endpoint on wallet connect, and the backend will silently resolve all pending transactions for that wallet (activations and withdrawals), returning 200 with no payload.

## Changes
- Backend (transactions router):
  - Add `POST /api/transactions/pending/resolve` that:
    1. Queries pending transactions for the wallet (`status='pending'`, `type IN ('license_activation','agent_activation','user_withdrawal','role_withdrawal')`).
    2. For each record:
       - If signature exists: reuse `verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: type is activation })` to confirm & finalize via shared logic.
       - If signature missing:
         - For activations: use existing `findTransactionSignature(orderId, payer, programId)` and then call `verifyAndProcessTransaction` if found.
         - For withdrawals: recover via reference PDA (`deriveReference(orderId)`/metadata reference), verify delta (`verifyTokenDelta`) and finalize; else refund using existing helpers (`attemptExpiredWithdrawalRefund` or `attemptExpiredBucketWithdrawalRefund`) with `refund_finalized` guard.
    3. Return 200 success with no body.
  - Rate-limit and batch:
    - Process at most 5–10 records per call; use a single `Connection` per call.
    - Prefer batch `getSignatureStatuses([..])` groups when signatures exist to reduce RPC churn.
    - For activation event searches, use the existing `resolveMainnetRpcUrl()` path to avoid manager churn and WS usage.

- Frontend:
  - In `wallet-context.tsx`, switch the silent call to `POST /api/transactions/pending/resolve` after session auth; debounce to one-shot per page load.

## What We Remove
- Remove or deprecate `/api/withdrawals/pending/resolve` endpoint to avoid redundancy and inconsistency.

## Files To Touch
- `server/routes/transactions.ts`: add unified pending resolver route; reuse existing helpers (`verifyAndProcessTransaction`, `findTransactionSignature`, `deriveReference`, `verifyTokenDelta`, `finalizeRecovery`, `finalizeRefund`).
- `src/contexts/wallet-context.tsx`: update silent resolver POST URL to `/api/transactions/pending/resolve`.

## Verification
- Create sample pending activation with no signature → on wallet connect, backend finds signature via PaymentMade event, confirms, marks completed.
- Create pending withdrawal (role or user) without signature → on wallet connect, backend fails recovery and refunds exactly once (audit rows written), marks failed + `refund_finalized`.
- Check backend logs: minimal RPC calls, 200 response; no WS usage or excessive retries.

## Safety
- Idempotent via `refund_finalized=true` and row-level handling; no double refunds.
- Uses existing shared modules for verification to minimize new code paths and improve maintainability.

If you approve, I’ll consolidate the resolver into `transactions.ts`, update the frontend call, remove the extra route, and validate with a test wallet connection.