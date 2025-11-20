## Goal
Eliminate `src/lib/sponsor-tree.ts` and all referral hierarchy logic. Use a simple, backend-aware sponsor resolution (existing on-chain/DB L1 sponsor or default fallback). No L2/L3 computation.

## Impacted Files
- `src/lib/sponsor-tree.ts` (delete)
- `src/services/license/license-service.ts` (remove imports; resolve L1 sponsor via backend/DB or env default)
- `src/services/agent/agent-activation-service.ts` (remove buildSponsorHierarchy usage; pass simple L1 sponsor)
- Tests: `src/services/license/__tests__/post-registration-validation.test.ts` (remove sponsor-tree mocks)

## New Resolution Logic
- Preferred: backend `/api/users/:address` already returns `sponsor_address`; use that when available.
- Fallback: `VITE_DEFAULT_SPONSOR_ADDRESS` when user has no sponsor or endpoint returns none.
- Do not derive L2/L3; only use L1 sponsor.

## Steps
1) Delete `src/lib/sponsor-tree.ts`.
2) Update license service:
   - Remove `getSponsorL1`/`SponsorHierarchy` imports.
   - Add helper `resolveSponsorL1(userAddress)`:
     - GET `/api/users/:address`, return `sponsor_address || import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS`.
3) Update agent activation service:
   - Remove `buildSponsorHierarchy` usage; rely on `resolveSponsorL1` or existing user context.
4) Update related tests to remove sponsor-tree mocks and assert sponsor resolution uses backend or default only.

## Non-Goals
- No changes to on-chain program calls.
- No UI changes beyond removing referral hierarchy dependencies.

If you approve, I will implement the removal and replacements, keeping the behavior simple and consistent with backend data. 