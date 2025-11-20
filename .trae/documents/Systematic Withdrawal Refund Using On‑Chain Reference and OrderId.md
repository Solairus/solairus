## Goal
- Provide a single function `findPaymentSignatureByOrderId` used for both license/agent payments and withdrawals.
- Internally, it parses Anchor events and matches `memo === orderId`:
  - Payments: `PaymentMade`
  - Withdrawals: `RewardsClaimed`
- No amount checks for withdrawals; presence of the event with orderId is success.

## Implementation
- Create `server/services/onchain_verifier.ts` exporting:
  - `async function findPaymentSignatureByOrderId(connection, programId, walletPubkey, orderId, options?)`
    - Fetch recent signatures for `walletPubkey` (payer for payments, recipient for withdrawals)
    - Parse each transaction’s logs using `EventParser` with `solairus_pay` IDL
    - If `event.name === 'PaymentMade' && memo === orderId` → return `{ signature, slot, event }`
    - If `event.name === 'RewardsClaimed' && memo === orderId` → return `{ signature, slot, event }`
    - Options:
      - `types?: ('payment'|'withdrawal')[]` default `['payment','withdrawal']`
      - `maxSignatures?: number` default 100
    - Returns `null` if not found
- Centralize `programId` resolution from `process.env.SOLAIRUS_PAY_PROGRAM_ID` or IDL address.

## Usage
- Payments: call with `walletPubkey = payerPublicKey` and default `types`.
- Withdrawals: call with `walletPubkey = recipientPublicKey` and `types = ['withdrawal']` to skip payment parsing if desired.
- Optional: if a signature is already known, callers can skip scanning; this function focuses on orderId → signature discovery.

## Integration (No route changes yet)
- Replace the route-local `findSignatureByPaymentEvent` with the unified service function where needed.
- Keep resolver logic simple: call the unified function for either flow; for withdrawals, treat “found” as success without amount checks.

## Validation
- Unit tests:
  - Returns signature for `PaymentMade` with matching memo
  - Returns signature for `RewardsClaimed` with matching memo
  - Respects `types` filtering and `maxSignatures`
- Smoke tests across both flows to confirm consistent behavior.

## Outcome
- Single, scalable verification function for both flows; fewer codes, easier maintenance; aligns with your rule: withdrawals succeed if `RewardsClaimed(memo=orderId)` exists.