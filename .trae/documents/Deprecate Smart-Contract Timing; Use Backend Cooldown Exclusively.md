## Problem
- Countdown still depends on `contract-timing-service` which may apply debug/override values (e.g., 60s/300s) and can query RPC/contract state.
- Your agents are fetched from backend only, with server-enforced cooldown (`claimed_at + 24h`) returned as `remaining_ms`, `next_claim_at`, `can_claim`.

## Proposal
Use backend timing exclusively and remove smart-contract timing references from agent UI.

## Changes (Frontend Only)
1. WithdrawalTimer
- Remove imports/usage of `getContractTimingInfo` and `calculateNextWithdrawalTime`.
- Accept props from `agent`: `claimedAt`, `nextClaimAt`, `remainingMs`, `canClaim`.
- Compute countdown purely from `remainingMs` updated every second; when `remainingMs <= 0`, show "Ready to withdraw".
- Remove any dependency on `Connection` or `AnchorProvider`.

2. AgentDashboard mapping
- Pass through `claimed_at`, `next_claim_at`, `remaining_ms`, `can_claim` from backend rows to `AgentData`.
- Where these fields are missing, fall back to a client-safe default (e.g., `remaining_ms = 0`, `can_claim = true`) but do NOT call contract timing.
- Ensure button gating relies on `can_claim` from backend.

3. Remove contract timing usage paths
- Deprecate and stop using `src/services/agent/contract-timing-service.ts` in agent UI components (keep file for potential future on-chain contexts, but do not import it from agent UI).
- Remove `VITE_WITHDRAWAL_WINDOW_SECONDS` from WithdrawalTimer logic; retain comment in `.env.example` but it no longer affects agent UI.

## Backend (No Changes)
- Keep current `GET /agents/user/:userAddress` providing `claimed_at`, `next_claim_at`, `remaining_ms`, `can_claim`.
- Claim execution remains out of scope; later we’ll update `claimed_at` on claim confirmation.

## Testing
- Unit tests for WithdrawalTimer:
  - Render countdown using `remaining_ms` → ticks to zero, flips to "Ready".
  - No RPC calls or env overrides.
- Mapping tests:
  - Ensure `claimed_at` maps to `lastRoiWithdrawal`, `next_claim_at` to `nextWithdrawalAt`, `can_claim` to UI gating.

## Rollout & Validation
- Build and run UI; verify no references to contract timing in console.
- My Agents page shows accurate countdown based on backend values.
- Confirm no RPC calls are made by the timer; network tab shows only backend requests.

## Non-Goals
- Do not change USDT activation/withdrawal flows.
- Do not remove the contract timing service file globally; just stop importing it in agent UI.

## Deliverables
- Updated WithdrawalTimer and AgentDashboard wiring to backend timing only.
- Tests proving countdown correctness without contract dependencies.
- Clean logs without RPC queries or debug timing overrides.
