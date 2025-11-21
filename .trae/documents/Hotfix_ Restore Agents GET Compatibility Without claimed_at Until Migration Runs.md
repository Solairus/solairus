## Issue Summary
- The server route `GET /api/agents/user/:userAddress` was updated to select `a.claimed_at`. If the DB migration hasn't run yet, Postgres errors with "column does not exist", causing the frontend to fail fetching user agents.

## Hotfix Plan (Minimal, Backward-Compatible)
1. Server route change (agents.ts):
   - Remove `a.claimed_at` from the SELECT list.
   - Compute cooldown using `COALESCE(a.activated_at, a.created_at)` only.
   - Continue returning enriched fields: `next_claim_at`, `remaining_ms`, `can_claim` (derived from activation time only).
   - Do not change the endpoint path or response structure for existing fields.
2. Frontend tolerance:
   - Leave the client mapping as-is; it already handles missing `claimed_at` and `next_claim_at` (falls back to existing contract timing when absent).
3. Migration rollout (separate step):
   - After you apply `server/migrations/012_agents_claimed_at.sql`, re-enable selecting `a.claimed_at` in the query.
   - Switch cooldown computation to `COALESCE(a.claimed_at, a.activated_at, a.created_at)` and start returning `claimed_at` alongside `next_claim_at`.

## Validation
- Backend: Call `GET /api/agents/user/:addr` and confirm 200 with agent list.
- Frontend: `/dapp/my-agents` loads successfully; no error "Failed to fetch user agents".
- Timer: Cooldown works off activation time until claimed_at exists.

## Notes
- No changes to how active agents are fetched beyond restoring prior compatibility.
- Claim execution flow stays untouched (out of current scope).