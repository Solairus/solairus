## Why Refactor
- We currently have parallel confirmation/recording logic in different places (e.g., bucket, license, agent). This fragments debugging and creates inconsistency.
- A shared, reusable client utility avoids duplication and ensures all flows behave identically (no WebSockets, same timeouts, same backend recording).

## What To Reuse
- Client send/poll pattern used in payments: see `src/services/wallet/solairus-pay.ts:137–185` (sendRawTransaction + getSignatureStatuses polling) and backend recording used by activations: `server/routes/transactions.ts:837–867` (record signature by orderId).
- Order polling pattern already used in bucket UI: `src/components/admin/BucketManagement.tsx:165–175` (GET `/transactions/:orderId`).

## Proposed Changes (Frontend Only)
1) Create a shared helper `src/services/transactions/confirmAndRecord.ts`:
   - `async function confirmAndRecord({ connection, signedTx, orderId, maxAttempts = 24, delayMs = 5000 })`
   - Sends raw tx (skipPreflight=false), polls `getSignatureStatuses` until confirmed/finalized (~120s), records signature via `POST /transactions/record/signature`, then polls `/transactions/:orderId` until `finalized`.
   - Returns `{ signature }` on success; throws with clear error string on failure.

2) Adopt utility across flows:
   - Update bucket UI `src/components/admin/BucketManagement.tsx:156–176` to call `confirmAndRecord(...)` instead of inline send/confirm/poll logic.
   - Update `src/services/bucket/bucket-service.ts:70–110` to call the same utility when doing client-side confirmation (keep REST-only, no WS).
   - Update payment flow in `src/services/wallet/solairus-pay.ts:137–185` to use this utility so payments, bucket withdrawals, and activations share identical behavior.

3) Standardize timeouts & retries
   - Use `maxAttempts=24` × `delayMs=5000` (~120s TTL) to match blockhash validity used by the backend builder (`server/services/withdrawals.ts:145–175`).

## Files To Touch
- Add: `src/services/transactions/confirmAndRecord.ts` (shared utility)
- Update: `src/components/admin/BucketManagement.tsx` (replace inline send/confirm/poll with utility)
- Update: `src/services/bucket/bucket-service.ts` (reuse utility)
- Update: `src/services/wallet/solairus-pay.ts` (reuse utility)

## Verification
- Run a bucket withdrawal (mainnet-beta): expect identical behavior to license/agent — signature recorded, order finalized, success toast.
- Force a small failure (e.g., wrong mint) and confirm utility surfaces same error categorization across flows.
- Confirm no WebSocket usage anywhere in client confirmation (no `confirmTransaction`).

## Safety & Scope
- Pure frontend refactor; backend already has `/transactions/record/signature` and `/transactions/:orderId` endpoints.
- No behavior changes beyond unifying logic; reduces duplication and aligns all flows.

If approved, I’ll implement the utility and replace the duplicated code in the three places, then verify with a bucket withdrawal and a payment test.