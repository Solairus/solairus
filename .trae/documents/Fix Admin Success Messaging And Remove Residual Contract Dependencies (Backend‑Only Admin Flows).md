## Goals
- Ensure no admin services/components import or use `@/lib/solairus-removed`.
- Fix success message behavior for backend-only admin actions (license activation, credit/debit, sponsor update).

## Changes
1) Remove `solairus-removed` imports from admin files:
- `src/services/admin/admin-service.ts`: drop `getProgram/derivePdas/Config` imports and any references (already backend-only; finish purge).
- `src/components/admin/UserCreditManagement.tsx`: remove `getProgram/derivePdas` import; confirm only backend AdminService is used.
- `src/components/admin/UserSponsorManagement.tsx`: remove `getProgram/derivePdas` and refactor to call `createAdminService(...).updateUserSponsor(...)` (backend route) instead of `sponsor-management-service`.
- `src/services/admin/sponsor-management-service.ts`: deprecate (unused) or refactor to backend-only; in this pass, stop using it from UI.

2) Success messaging updates
- Manual License Activation: capture return value from `executeTransaction` and, when non-signature results are returned, trigger success notification (`AdminNotifications.licenseActivation`), update `lastResult`, and refresh user lookup.
- Credit/Debit: ensure the component shows success toasts and refresh using the backend result’s `txSignature` (`BACKEND-CREDIT/DEBIT`).
- Update copy where it says “logged on the blockchain” to “audit logged in backend”.

## Outcome
- Admin features are fully backend-only, no `solairus-removed` dependency remains.
- Successful operations show toasts and refresh UI state as expected.

Proceeding to implement these targeted changes in the admin codepaths.