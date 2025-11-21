## Scope
- Focus ONLY on bucket withdrawal init flow (admin endpoints) as in commit 16a1778ab02419197d846d7d2b736cbd8bf5fdfc.
- Do not touch other flows (payments, refunds, resolvers).

## Changes To Apply
1) Remove server-side pre-simulation and guards in admin withdrawal init:
- Delete `simulateTransaction(tx, { sigVerify: false })` block.
- Remove cluster mismatch guard (`getCurrentCluster() !== 'mainnet-beta'`).
- Remove backend authority sanity check against config PDA.

2) Keep the original preflight checks that existed in the working commit:
- Config PDA existence.
- Vault ATA funding check.

3) Preserve data preparation for signing exactly as before:
- Backend builds and partial-signs `claim_rewards` using backend signer.
- Returns `{ orderId, referencePubkey, txBase64, ttlMs }`.
- Client signs as fee payer and broadcasts.

## Files To Edit
- `server/routes/admin.ts` (both `/buckets/:bucketType/withdraw/init` and alias `/admin/buckets/:bucketType/withdraw/init`).

## Verification
- Restart backend server.
- From UI bucket management, perform a withdrawal and confirm:
  - 201 response includes `{ orderId, txBase64, ttlMs }`.
  - Client signs and fee-pays; transaction proceeds without the earlier 400.
  - No Phantom red warning appears (as per prior working behavior).

## Notes
- No commits/pushes will be performed unless you explicitly ask to. I will apply the local code changes and provide the exact diff for your review and local testing.