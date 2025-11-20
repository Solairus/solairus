## Problem
Affiliate commission withdrawal currently uses `confirmTransaction` (WS-based), diverging from the unified REST-only confirmation we adopted for bucket and payments. This causes repeated WS failures with non-WS RPCs and increases inconsistency.

## Plan
- Refactor Affiliate withdrawal in `src/pages/Dapp/Affiliate/index.tsx` to reuse the shared helper `confirmAndRecord` and the same backend-first init flow.
- Remove `confirmTransaction` call to eliminate WebSocket usage.
- Keep the backend init `/withdrawals/init` (already used); then decode tx, sign, and call `confirmAndRecord({ connection, signedTx, orderId })` to:
  - Broadcast using `sendRawTransaction`
  - Poll `getSignatureStatuses` up to ~120s
  - Record signature to `/transactions/record/signature`
  - Poll `/transactions/:orderId` until finalized

## Implementation Steps
1) Update `handleWithdraw` in `src/pages/Dapp/Affiliate/index.tsx`:
   - After calling `/withdrawals/init` and obtaining `{ orderId, txBase64 }`, decode tx to `Transaction`.
   - Sign with `signTransaction`.
   - Replace the `sendRawTransaction` + `confirmTransaction` block with `confirmAndRecord({ connection: anchorProvider.connection, signedTx, orderId })`.
   - Remove WS-related confirmation and keep success/error toasts.
2) Ensure the UI uses the same mint resolution and recipient ATA derivation (already present).
3) Verify behavior:
   - No WS usage; confirmation and backend recording identical to bucket withdrawal.
   - Order polling still works, but is redundant since `confirmAndRecord` already polls; we can keep a minimal check or remove the extra loop.

## Safety & Scope
- Pure frontend refactor in a single file; no backend changes.
- Reuses existing utility; preserves UX and toasts.

## Result
Affiliate commission withdrawals use the same unified path as bucket withdrawals and payments, avoiding WebSocket reliance and reducing code duplication. Approve to proceed with the refactor.