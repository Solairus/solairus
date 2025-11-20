## Scan Results (Imports of solairus-removed)
- Tests: `src/lib/__tests__/license-integration.test.ts`, `src/lib/__tests__/license-activation-loop-compatibility.test.ts`
- Utilities: `src/utils/license-cache.ts`
- Config: `src/config/agent-config.ts`
- Contexts: `src/contexts/license-context.tsx`
- Agent services: `src/services/agent/agent-activation-service.ts`, `src/services/agent/contract-timing-service.ts`, `src/services/agent/withdrawal-limit-service.ts`, `src/services/agent/agent-roi-service.ts`
- Affiliate services: `src/services/affiliate/earnings-history-service.ts`
- License services: `src/services/license/license-service.ts`, `src/services/license/license-debug-utils.ts`, `src/services/license/license-status-validator.ts`, `src/services/license/__tests__/license-status-validator.test.ts`
- User services: `src/services/user/user-service.ts`
- Profile services: `src/services/profile/profile-dev-tools.ts`, `src/services/profile/profile-monitoring.ts`
- Config service: `src/services/config/config-service.ts`
- Bucket service: `src/services/bucket/bucket-service.ts`
- Admin sponsor management: `src/services/admin/sponsor-management-service.ts`
- Components: `src/components/agent/AgentActivationModal.tsx`, `src/components/agent/AgentDashboardDemo.tsx`, `src/components/agent/TierSelection.tsx`, `src/components/agent/__tests__/TierSelection.test.tsx`, `src/components/agent/__tests__/WithdrawalTimer.test.tsx`, `src/components/ReferralNetworkCard.tsx`, `src/components/license/LicenseExpiryNotification.tsx`, `src/components/license/LicenseStatusCard.tsx`

## Replacement Strategy (Backend-only)
- User/license/sponsor data:
  - Use `GET /api/users/:address` (already returns `sponsor_address`, `license_status`, `license_expiration`).
- Agent tier config:
  - Use backend `GET /api/admin/agent-tiers` (admin) or public config endpoint (if available) instead of `AgentTier` constants.
- Earnings/affiliate summaries:
  - Use backend `GET /api/affiliate/summary` endpoints (existing) rather than program reads.
- Contract timing/withdrawal limits:
  - Remove client-side program-derived timing; use backend settings under `/api/settings` or constants.
- Bucket service:
  - Remove on-chain program imports; use backend bucket balances and withdrawal endpoints.

## Actions
1) Delete `src/lib/solairus-removed` file(s) and all imports.
2) For each import site:
  - Replace program calls with backend API calls as outlined above.
  - For components that display statuses (LicenseStatusCard, LicenseExpiryNotification), read from backend.
  - For config and tiers, read from backend endpoints.
3) Update tests to mock backend responses instead of program calls.
4) Confirm the dapp loads without any `solairus-removed` references.

## Notes
- Payments/withdrawals remain via SolairusPay, but user-facing data is backend-only.
- We will not alter .env; only code references.

If you confirm, I will remove the file and refactor the listed modules to eliminate all `solairus-removed` imports, wiring them to backend endpoints.