## Goal
Show the sum of all unclaimed `agent_results` for the signed-in user on /dapp’s balance card. Add this value to the existing displayed total (do not override), and list it in the breakdown.

## Backend
- Route: `GET /api/users/:address/agents/unclaimed` (or `:userId` if preferred). Returns `{ unclaimed_micro: string, unclaimed_usd: string }`.
- Query: `SELECT COALESCE(SUM(ar.result_micro),0) AS unclaimed_micro FROM agent_results ar JOIN agents a ON a.id = ar.agent_id JOIN users u ON u.id = a.user_id WHERE u.user_address = $1 AND ar.claimed = false`.
- Conversion: Format `unclaimed_usd` as decimal string with 6 fraction digits (micro → USD).
- Guard: Require auth; reuse existing middleware.

## Frontend
- Component: `src/components/VaultBalanceCard.tsx`.
- State: add `unclaimedAgentsUsd` and include it in the main total calculation.
- Fetch: on mount and refresh button, call the new backend route with the current wallet address.
- Display:
  - Main total = `bonusBalance (affiliate bonus from DB)` + `unclaimedAgentsUsd` (both USD).
  - Breakdown: add a new line “Agent Results (Unclaimed)” with the formatted `unclaimedAgentsUsd`.
  - Keep existing “Target PnL” section intact.

## Edge Cases
- No wallet: show 0 for unclaimed.
- No agents/none unclaimed: 0.
- Handle network errors by falling back to 0 without toasts.

## Tests
- Backend query unit test with seeded data: verifies sum and claimed=false filter.
- Frontend: simple render test confirming total adds `unclaimedAgentsUsd` and shows a breakdown line when >0.

## Deliverables
- New backend route + service function.
- VaultBalanceCard fetch + UI adjustment.
- Minimal tests.

Confirm and I’ll implement the route, update the card, and wire the fetch/formatting.