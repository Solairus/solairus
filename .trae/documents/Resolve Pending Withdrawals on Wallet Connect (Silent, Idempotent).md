## Understanding
- On wallet connection, trigger a single backend call to resolve pending withdrawals for that user.
- Backend silently verifies each pending item on-chain by `orderId`/reference; if found confirmed, mark completed; if not found, refund safely (no double refunds), update status to failed/cancelled, and write audit records.
- No recursive calls; just one-shot on page load. Backend responds 200 only.

## Frontend Changes
- `src/contexts/wallet-context.tsx` (or AuthContext right after session establish):
  - On `wallet.connected` and session ready, fire `POST /api/withdrawals/pending/resolve` with `{ walletAddress }`.
  - Debounce to once per page load; ignore response body; proceed with app.

## Backend Changes
- Route: `POST /api/withdrawals/pending/resolve`
  - Input: `{ walletAddress: string }`
  - Behavior:
    1. Query `transactions` for rows with `user_wallet = walletAddress` and `status = 'pending'` where `type IN ('user_withdrawal','role_withdrawal')`.
    2. For each row (idempotent processing):
       - If `signature` exists → `getSignatureStatuses(signature)`; if confirmed/finalized, set `status='confirmed'`, `metadata.completed=true`.
       - If `signature` missing or not confirmed and `ttlMs` expired → run verifier to check on-chain transfer (vault→recipient). If not found/failed, perform refund safely via bucket update helper and write audit rows; set `status='failed'` or `'cancelled'` per type; set `metadata.refunded=true`; set `refund_finalized=true`.
       - If already `refund_finalized=true` → skip to prevent double refunds.
    3. Always return HTTP 200 without payload.
- Service: `server/services/pending-withdrawals-resolver.ts`
  - Reuse existing `refunds.ts` (shared verifier) and `withdrawal_refund` helpers.
  - Use DB transactions for atomic status+balance updates.
  - Use row-level lock (`SELECT ... FOR UPDATE`) to avoid double-processing across requests.
- Helper: bucket/user balance updater (existing bucketupdate) to:
  - Credit back appropriate account
  - Insert into `bucket_history` or `balance_history`
  - Append audit metadata (orderId, reason, timestamps)

## Idempotency & Safety
- Guard with `refund_finalized` boolean and `processed_at` timestamp.
- Row-level locking during processing; skip already processed rows.
- Input validation for `walletAddress`; rate-limit per IP if needed.

## Files To Touch
- Frontend: `src/contexts/wallet-context.tsx` (add one-shot POST after session and wallet connect)
- Backend: `server/routes/withdrawals.ts` or new `server/routes/pending.ts` (add resolve endpoint)
- Backend: `server/services/pending-withdrawals-resolver.ts` (new) and integrate with `server/services/refunds.ts` + bucket updater

## Verification
- Create a pending withdrawal (no signature) and load the app:
  - Backend runs resolver, performs refund, sets `status='failed'` or `'cancelled'`, `refund_finalized=true`, audit rows written.
- With an already broadcast signature:
  - Resolver marks `confirmed` and `completed`.
- Repeat loads: no double refunds; idempotent skipping.
- Frontend receives 200; no UI delay.

## Notes
- Cluster comes from backend `.env` (`SOLANA_CLUSTER`), now set to `mainnet-beta`.
- No secrets are logged; only public keys and orderId in audits.
- Strictly silent operation: response code 200 with no body.