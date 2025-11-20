## Summary
Bucket withdrawals still fail with opaque simulation errors and return immediately. License and agent flows wait for on-chain confirmation, record signatures, and poll status before surfacing success/failure. We’ll make the bucket flow identical: pre-simulate for logs, broadcast, poll confirmations, record signature, and poll the backend order until finalized. 

## Findings
- Current bucket client sends a transaction and only calls `confirmTransaction` once, without robust polling or signature recording.
- Activation flows (license/agent) use multi-step confirmation and backend verification to avoid false negatives and produce richer errors.
- Simulation errors recommend calling `getLogs()`; our error handler can parse logs but the client doesn’t fetch them proactively.

## Proposed Changes
1) Client Flow Parity with Activations
- Pre-simulate transaction: capture `logs` and structured `err`; if non-null, show exact reason.
- Broadcast with `sendRawTransaction` and retry policy; wait by polling `getSignatureStatuses` up to N attempts.
- Record signature to backend via `POST /api/transactions/record/signature` with `orderId`; then poll `/api/transactions/:orderId` every 2s until `finalized`.
- Rotate RPC endpoint on typical network faults using existing RPC switcher.

2) Correct Signing Path
- Use wallet adapter `signTransaction` for `VersionedTransaction`; do not rely on `provider.wallet.payer`.
- Handle both legacy `Transaction` and `VersionedTransaction` decoding.

3) Payload & Account Validation
- Validate `amountMicro > 0` and not exceeding bucket balance shown.
- Resolve USDT mint (devnet/mainnet) consistently; derive recipient ATA client-side and verify it matches payload.
- If simulation fails, surface precise seed/authority/mint mismatches from logs.

4) Backend Status & Refunds
- After signature recording, leverage existing backend verification and refund logic:
  - If no signature is posted and TTL expires, backend auto-refunds both user and role withdrawals.
  - Ensure order metadata marks lifecycle (`phase`, `completed`, `refund_finalized`).

## Files To Update
- `src/services/bucket/bucket-service.ts`: add pre-simulation, wallet signing, robust polling, signature recording, backend polling; RPC rotation.
- `src/components/admin/BucketCard.tsx`: adapt UI to the new async flow (status steps identical to activations).
- `src/utils/admin-error-handler.ts`: optionally surface parsed `logs` in UI to help triage.

## Verification Plan
- Devnet test with small withdrawal:
  - Expect: pre-simulation OK → signature → confirmations ≥1 → backend verifies and updates record to `confirmed`.
- Forced failure (wrong mint or insufficient vault): pre-simulation shows exact error; no signature recorded; after TTL, backend auto-refund; UI polling shows `failed` + `refunded=true`.

## Rollback Plan
- Keep a feature flag to fall back to the old direct `confirmTransaction` path if backend is unavailable.

## Assumptions
- USDT mints are correctly set in env (`VITE_USDT_MINT_DEVNET` / mainnet), and backend bucket init route is accessible.
- Wallet adapter exposes `signTransaction`.

If you approve, I’ll implement the parity changes and run a full end-to-end verification with detailed logs.