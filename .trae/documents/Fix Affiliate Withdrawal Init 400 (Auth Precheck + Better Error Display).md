## Diagnosis
- Backend `/withdrawals/init` requires JWT (sets `res.locals.auth`), validates schema, builds the claim_rewards tx, checks config and vault funding, then debits `bonus_balance`.
- The 400 appears as a generic “HTTP 400” in the UI because the API client only surfaces `message`, while the server responds `{ error: '...' }`.
- A recent web response shows `{"error":"Missing Bearer token"}`, indicating the Authorization header is absent; in that case `/withdrawals/init` returns 401 or 400 with `error`.

## Fix (Frontend Only)
1) Auth precheck in Affiliate withdrawal
- Before calling `/withdrawals/init`, ensure JWT is present; if missing, call wallet auth and refresh session.
- Pattern mirrors LicenseActivation: check `localStorage['solairus.jwt']`, then `AuthService.authenticateWallet(account)`.

2) Improve error display for API client
- Update `RESPONSE_INTERCEPTORS.handleErrors` to prefer `errorData.error` when `errorData.message` is absent so users see the backend reason (e.g., “Unauthorized”, “Vault underfunded”).
- No API surface change; only error mapping.

3) Sanity checks (no changes)
- Confirm recipient ATA derivation path in Affiliate uses `getAssociatedTokenAddressSync` (it does).
- Confirm env cluster resolves to mainnet-beta (already updated); mint selection relies on that.

## Verification
- With a connected wallet, purge `localStorage['solairus.jwt']` and attempt withdrawal:
  - Auth precheck should obtain a token, `/withdrawals/init` returns 201 with `{ orderId, txBase64 }`.
- If server still returns 400, the UI now displays `{ error: '...' }` from the server (e.g., “Insufficient bonus_balance to withdraw”).

## Safety
- No server changes; only frontend precheck and error handling.
- Does not change function signatures or flows; keeps the identical process to bucket withdrawals with the bonus_balance difference.

## Deliverables
- Code edits in `src/pages/Dapp/Affiliate/index.tsx` (auth precheck) and `src/config/service-endpoints.ts` (error mapping).
- Local testing instructions; no commit/push until you request.