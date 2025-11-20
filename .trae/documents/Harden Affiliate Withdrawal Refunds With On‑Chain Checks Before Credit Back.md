## Goal
Prevent erroneous refunds by verifying on‑chain existence of the withdrawal (by order_id/reference) before crediting back. Refunds become single, final actions with immutable order_id state.

## Implementation (Backend)
1) Update `server/services/withdrawal_refund.ts`
- Add guard: if `metadata.refund_finalized === true` → skip processing.
- Resolve `PROGRAM_ID` and deterministic `referencePubkey` (use metadata.reference if present; else derive from order_id and program_id).
- Use `getConnection` (existing RPC manager) to search for signatures on the `referencePubkey` and recover a matching signature.
- Verify parsed transaction:
  - Recipient ATA owner matches `initiator_wallet`.
  - Mint equals `record.mint_address`.
  - Token delta equals `record.amount` (use pre/post token balances or instruction data).
- Decision:
  - Signature valid: attach signature, set status `confirmed` (or `completed` if finalized), write metadata `{ recoveredVia: 'reference', verificationProof }`. Do not refund.
  - No signature: perform a single refund via `applyBalanceBucketChange` and mark transaction `failed` with `{ refund: true, refund_finalized: true, proof }`. After refund, the order_id is immutable/closed.

2) Idempotency & Logging
- Persist `refund_finalized: true` in `transactions.metadata` on refund.
- Log structured audit entries with order_id, reference, signature found/not found, and action taken (`recovered`/`refunded`).

3) Tests
- Signed‑but‑missing case → verifier recovers, no refund.
- Unsigned expired case → refund once, closed with `refund_finalized`; repeated attempts are skipped.

## Notes
- No balance pre‑check for refund eligibility; focus solely on on‑chain evidence.
- Reuse cluster configuration via `getConnection`.

Confirm and I will implement the service changes and tests accordingly.