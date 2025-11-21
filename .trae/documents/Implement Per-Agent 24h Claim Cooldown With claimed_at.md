## Scope Confirmation
- Implement persistent last-claim tracking and frontend countdowns.
- Enforce cooldown server-side in agent eligibility data.
- **Do not** change the claim/withdrawals flow now; reuse it later for actual claim execution.

## Database Migration
1. Create migration to add `claimed_at TIMESTAMPTZ` to `agents`.
2. Backfill: `claimed_at = COALESCE(activated_at, created_at)` for `status='active'`.
3. Index: optional on `claimed_at` for future queries.

## Backend Enhancements
1. Extend `GET /api/agents/user/:userAddress` (server/routes/agents.ts):
   - Return `claimed_at` per agent (UTC).
   - Compute and include:
     - `next_claim_at = claimed_at + interval '24 hours'`
     - `remaining_ms = max(0, next_claim_at - NOW())`
     - `can_claim = remaining_ms === 0`
2. Keep existing claim/withdrawals flow unchanged in this phase.
   - Later, agent claim execution will reuse your current withdrawals pipeline and update `claimed_at` post-confirmation.

## Frontend (My Agents UI)
1. Read new fields from `GET /api/agents/user/:userAddress`.
2. Show per-agent:
   - Last claim: `claimed_at` (formatted locale).
   - Next claim: `next_claim_at`.
   - Live countdown: tick `remaining_ms` to 0 (client-only display), flips to “Claim available”.
3. Button gating:
   - Disable claim when `!can_claim` (display message).
   - Keep existing claim action untouched (out of scope for now).

## Testing
1. Migration test (init claimed_at correctly for active agents).
2. Backend test (cooldown fields calculated correctly; UTC only).
3. Frontend unit test (countdown renders and updates; switches at 0).
4. Edge cases:
   - Timezone handling (UTC persistence; UI converts for display only).
   - Client/server clock (UI uses server-provided `remaining_ms`).
   - Leap seconds/DST (documented; treat 24h = 86400s, no DST effects in UTC).

## Deliverables
- Migration SQL file.
- Agents GET endpoint returning cooldown metadata.
- My Agents UI countdown and status (without changing claim execution flow yet).
- Tests covering migration, backend eligibility, UI countdown.

## Next Phase (Not in this scope)
- Reuse current withdrawals claim pipeline; on successful claim confirmation, update `agents.claimed_at = NOW()` and refresh UI.
