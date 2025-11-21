## Goal
- Fix withdrawal verification so memo matching uses RewardsClaimed instead of PaymentMade, without changing function signatures or payloads.

## Key Points From Code
- Signature verification: `verifyAndProcessTransaction(connection, record, { requireOrderIdMatch })` uses `fetchPaymentEventForSignature(...)` for memo check, which always parses PaymentMade.
- Pending resolver currently sets `requireOrderIdMatch` only for activations (`record.type === 'license_activation' || 'agent_activation'`), skipping memo check for withdrawals.

## Implementation (No Signature Changes)
1) Enhance `fetchPaymentEventForSignature(connection, signature, programId)` in `server/routes/transactions.ts`:
- Add a lightweight DB lookup inside the function:
  - `SELECT type, order_id FROM transactions WHERE signature = $1 LIMIT 1`
  - If found, set `isActivation = type in ('license_activation','agent_activation')`. Else default: try both events.
- Parse logs once with Anchor `EventParser`:
  - If `isActivation`, filter for `PaymentMade` → read `memo` (utf8) and return `{ signature, slot, event }`.
  - Else (withdrawals), filter for `RewardsClaimed` → read `memo` and return `{ signature, slot, event }`.
- Logging: "Fetching withdrawal event for signature" vs "Fetching payment event..." for clarity.

2) Use it wherever memo check runs (no API changes):
- Keep all existing calls (e.g., in `verifyAndProcessTransaction`); the function remains the same name/args and becomes type-aware internally.

3) Align pending resolver to always apply memo check:
- In `router.post('/transactions/pending/resolve', ...)` change:
  - `requireOrderIdMatch: record.type === 'license_activation' || record.type === 'agent_activation'`
  - → `requireOrderIdMatch: true` (since the event fetcher is now type-aware and will select RewardsClaimed for withdrawals).

## Verification
- Scenario A: role_withdrawal
  - Record signature → logs show RewardsClaimed memo fetched, memo matches `order_id`, status becomes `confirmed`.
- Scenario B: license_activation
  - Record signature → logs show PaymentMade memo fetched, memo matches, status confirmed.
- Pending resolution
  - With signature present, both activation and withdrawal records get memo check via type-aware function.

## Tests
- Unit/integration:
  - Stub parse logs for PaymentMade and RewardsClaimed; assert memo match triggers confirmed for respective types.
  - Ensure amount not checked for withdrawals.

## Safety
- No route or function signature changes.
- Minimal DB read inside helper; graceful fallback if signature not found in DB (try both events).
- No commits/pushes until you request; I’ll apply changes locally and provide the diff for review.

## Expected Result
- Your terminal logs switch from "Payment event found: false, memo: undefined" to "Withdrawal event found: true, memo: '<orderId>'", and records are marked confirmed for successful withdrawals.