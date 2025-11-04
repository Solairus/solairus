query: Locate the license activation page component or route at /dapp/license-activation to understand the UI and invoke of backend activation.
          
Here’s my understanding of your request: you want a detailed review of how license activation is currently implemented across the stack, without making changes yet. I’ll cover backend endpoints, frontend flow, gating, data, and error handling so we can align before implementing agent activation endpoints.

**Architecture Overview**
- Hybrid validation: combines backend license state (JWT session) with optional on-chain checks.
- Payment and verification: uses a backend “payments/transactions” flow plus a lightweight on-chain USDT payment via the Solairus Pay program, then activates in backend.
- Gated access: `LicenseGuard` checks both backend `user.license_status` and on-chain `licenseInfo`; valid in either path unblocks protected routes.

**Backend Endpoints**
- `GET /license/info` (`backend/src/routes/license.ts`)
  - Inputs: JWT session (`res.locals.auth` with `sub` and `addr`).
  - Reads user license state: `users.license_status`, `users.license_expiration`.
  - Reads settings: `settings['license.fee_usdt']` (micro USDT) and `settings['license.term_days']`.
  - Outputs: `user_address`, `license_status`, `license_expiration`, `cost_usdt_micro`, `cost_usdt`, `term_days`.
  - Purpose: drive UI with current license status and cost/term (backend-only flow).

- `POST /license/activate` (`backend/src/routes/license.ts`)
  - Inputs: either `transaction_id` or `signature` (one is required).
  - Validates and resolves the transaction:
    - By `transaction_id`: loads and uses amount as fee.
    - By `signature`: finds transaction record; uses `amount` and `decimals` to compute `costUsdt`.
  - Computes expiration: `now + term_days`.
  - Updates user: sets `users.license_status='active'`, sets `license_expiration`.
  - Distributions:
    - `distributeLicense(costUsdt, txId)`: bucket/revenue share distribution.
    - `distributeAffiliateBonuses(auth.sub, feeUsdtMicro, txId)`: multi-level affiliate payouts (L1→L3).
  - Outputs: `{ ok: true, license_status: 'active', license_expiration, term_days, transaction_id }`.
  - Security: JWT required; sensible 4xx/5xx handling.

- `POST /license/activate/manual` (admin/dev-only)
  - Auth: checks backend authority pubkey and `ADMIN_PUBKEYS` env.
  - Records `transactions` row with `type='license_activation'` and `manual=true`.
  - Updates user license without triggering distributions.
  - Outputs: same shape with `manual: true`.

- Supporting Transactions APIs (`backend/src/routes/transactions.ts`)
  - `POST /transactions/reapply-license`:
    - Allows reapplying license activation for a previously confirmed `license_activation` transaction by `orderId` or `signature`.
    - Validates type and status, runs post-confirmation activation; used for silent recovery in the UI.
  - `POST /payments/license-activation`:
    - Initializes a payment order and records transaction; later attaches signature.
    - Paired with `POST /transactions/verify` to verify on-chain signature before activation.
  - `createOrResumeLicenseActivationHandler` (server-side orchestration):
    - Helps resume pending activation or apply activation immediately if already confirmed.

**Frontend Flow**
- Page: `src/pages/Dapp/LicenseActivation/index.tsx`
  - Loads license info: `LicenseBackendService.getInfo()` for cost and term.
  - Silent recovery:
    - If wallet is connected, checks `last-confirmed` transaction for `license_activation`.
    - Calls `POST /transactions/reapply-license` with `orderId` to reapply if status not active.
    - Refreshes session and navigates back if reapplied.
  - Payment + verification + activation:
    - Initializes order: `POST /payments/license-activation` to get `order_id`.
    - On-chain USDT payment via `SolairusPayService.makePayment(...)` with `memo = order_id`.
    - Records the signature: `POST /payments/license-activation` with `signature`.
    - Verifies: `POST /transactions/verify` with signature.
    - Activates license: `LicenseBackendService.activate({ signature })`.
    - Refreshes session; stores success state; redirects to return path (default `/dapp`) after short delay.
  - UI: mobile-first, shows license fee badge, order summary modal, loading states, error handling with retry.

- Service: `src/services/license/license-backend.ts`
  - `getInfo()`: GET `/license/info`.
  - `activate({ transaction_id?, signature? })`: POST `/license/activate`.

- Optional on-chain service: `src/services/license/license-service.ts`
  - Provides on-chain activation via Anchor (e.g., `activateLicense`, `completeLicenseActivation`).
  - Ensures ATAs exist, derives PDAs, avoids auto-retries, performance timings.
  - In current LicenseActivation page, the backend-first flow is used; on-chain methods are available for other contexts or future migration.

**Gating & Context**
- `LicenseGuard` (`src/components/license/LicenseGuard.tsx`)
  - Checks if guard enabled via `VITE_ENABLE_LICENSE_GUARD`.
  - Bypass for admin/dev/marketer wallets.
  - Uses both backend session (`user.license_status`) and `useLicense().licenseInfo.isValid`.
  - Redirects to `/dapp/license-activation` if invalid and not already on the page.
  - Shows loading and error UIs; expiry notifications for near-expiry.

- `useLicense` context (`src/contexts/license-context.tsx`)
  - Exposes `licenseInfo`, `refreshLicenseStatus`, `activateLicense`, `isActivating`, and convenience flags.
  - Designed to integrate with on-chain checks; backend status used by guard to allow deterministic gating in session.

**Data & Settings**
- Tables:
  - `users`: `license_status` (`none|active|expired|revoked`), `license_expiration`.
  - `transactions`: records `license_activation` payments, amounts, mint, decimals, metadata (`order_id`, flow).
  - `settings`: `license.fee_usdt` (micro USDT), `license.term_days`.

- Auth:
  - All backend license endpoints rely on JWT session; frontend `AuthService.authenticateWallet(...)` used when needed.

**Error Handling & Recovery**
- Backend:
  - Clear 4xx (unauthorized/invalid input) and 5xx messages.
  - Logs with `[license]` prefixes for traceability.

- Frontend:
  - `LicenseErrorHandler` parses and normalizes messages.
  - Silent recovery re-applies confirmed transactions to avoid forcing users to pay again.

**Practical Notes**
- License status in backend is authoritative for gating; on-chain checks complement it.
- Activation requires backend verification of the signature before updating the license.
- Admin/dev can manually activate for testing without distributions via `/license/activate/manual`.