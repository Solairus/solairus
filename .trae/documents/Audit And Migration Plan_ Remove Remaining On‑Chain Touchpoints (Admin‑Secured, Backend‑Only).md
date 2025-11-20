## Objectives
- Remove remaining on-chain calls in admin features and route them through existing backend endpoints.
- Keep UI signatures non-blocking by returning placeholder identifiers.

## Files To Update
- `src/services/admin/admin-service.ts`

## Changes
1) `creditUserBalance(params)`
- Replace Anchor `program.methods.creditUserBalance(...)` with backend:
  - If `isDebit` → POST `${API_CONFIG.getBaseUrl()}/users/:address/debit` with `{ amount }`
  - Else → POST `${API_CONFIG.getBaseUrl()}/users/:address/credit` with `{ amount }`
- Map response `{ success, new_balance }` to `UserCreditResult` with `txSignature: 'BACKEND-CREDIT' | 'BACKEND-DEBIT'`.

2) `activateLicenseManual(params)`
- Replace Anchor call with backend POST `${API_CONFIG.getBaseUrl()}/users/:address/license` and body `{ durationDays, extendExisting }`.
- Map response `{ success, new_expiration, transaction_id }` to `ManualLicenseActivationResult` with `txSignature: 'BACKEND-LICENSE-' + transaction_id`.

3) `updateUserSponsor(params)`
- Replace `program.methods.updateUserProfile` with backend POST `${API_CONFIG.getBaseUrl()}/users/:address/sponsor` body `{ newSponsorAddress }`.
- Return `'BACKEND-SPONSOR-UPDATED'` string.

## Non-Goals
- Bucket withdrawals and user flows (ROI, license USDT payments) remain unchanged.

## Verification
- Compile TypeScript in UI.
- Manual test via admin pages: search user, credit/debit, manual license, sponsor update.
- Observe backend logs and DB changes.

Proceeding to implement changes in `admin-service.ts`. 