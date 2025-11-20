## Approach Confirmation
- Your approach is solid: create a backup branch from the current working state, then compare the activation flow at the known good commit and the suspected regression branch, isolate diffs only for the activation flow, return to main, and fix without losing current work.

## Step 1 — Safeguard Current State
- Create a backup branch from the current working tree, commit any uncommitted changes, and tag the snapshot for easy reference.
- Commands:
  - `git status`
  - `git add -A && git commit -m "backup: snapshot before activation-flow investigation"`
  - `git branch backup/activation-flow-snapshot`
  - `git tag backup-activation-flow-snapshot`

## Step 2 — Check Known-Good Commit
- Checkout the known-good commit `af27fb354ed00e82bce19dbd4328176956a7e7ef` in a temp branch to avoid detached HEAD.
- Commands:
  - `git checkout -b investigation/good-af27fb3 af27fb354ed00e82bce19dbd4328176956a7e7ef`
- Validate the exact flow end-to-end (license first, then agent):
  - `yarn install && yarn dev`
  - Test license activation on `/dapp` → confirm payment → backend init → orderId → on-chain `makePayment` → signature recording → poll → success.
  - Note versions and environment usage; verify no hard dependency on `VITE_SOLAIRUS_PAY_PROGRAM_ID` beyond IDL.

## Step 3 — Compare With Suspected Regression Branch
- Checkout the suspected regression branch `990378f1edfb0de4553a44c8b391447e29d0de93` (use a temp branch again):
  - `git checkout -b investigation/regression-990378f 990378f1edfb0de4553a44c8b391447e29d0de93`
- Diff only flow-relevant files and patterns:
  - Validators and program setup
    - `src/utils/solairus-program-validation.ts`
    - `src/services/wallet/solairus-pay.ts`
    - `src/idl/solairus_pay.json`
    - `src/vite-env.d.ts`
  - Page flows
    - `src/pages/Dapp/LicenseActivation/index.tsx`
    - `src/pages/Dapp/Agents/Hire/index.tsx`
  - Backend endpoints (for mapping only; avoid functional changes)
    - `server/routes/transactions.ts`
  - Env exposure
    - `.env`, `.env.production`, `vite.config.ts`
- Commands:
  - `git diff investigation/good-af27fb3..investigation/regression-990378f -- src/utils/solairus-program-validation.ts src/services/wallet/solairus-pay.ts src/pages/Dapp/LicenseActivation/index.tsx src/pages/Dapp/Agents/Hire/index.tsx src/idl/solairus_pay.json src/vite-env.d.ts server/routes/transactions.ts vite.config.ts .env .env.production`
- Focus on changes introducing:
  - New call to `ensureSolairusProgramsInitialized()` in constructor
  - Stricter env-only requirement for pay program ID (no IDL fallback)
  - Reordering to instantiate `SolairusPayService` before backend init
  - Any renames of endpoints (`/transactions/init` → `/payments/activate`) and signature recording path
  - Removal of main program references is fine; ensure pay program path is intact

## Step 4 — Validate Runtime Behavior Differences
- Run the regression branch locally and reproduce the error:
  - `yarn install && yarn dev`
  - Trigger license activation; confirm the throw: “Solairus program initialization failed: VITE_SOLAIRUS_PAY_PROGRAM_ID is required…”
- Confirm whether `.env.production` lacked `VITE_SOLAIRUS_PAY_PROGRAM_ID` at that commit and that IDL-address was not used as fallback.

## Step 5 — Return To Main And Fix (Minimal, Non-Disruptive)
- Checkout main: `git checkout main`
- Apply targeted fixes:
  - In `src/utils/solairus-program-validation.ts`, add IDL address fallback when `VITE_SOLAIRUS_PAY_PROGRAM_ID` is absent; remove main ID handling
  - Ensure `.env.production` contains `VITE_SOLAIRUS_PAY_PROGRAM_ID` to align build-time exposure
  - Update `src/vite-env.d.ts` to declare `VITE_SOLAIRUS_PAY_PROGRAM_ID`
- Re-run license and agent activations to verify the restored flow without touching backend logic.

## Deliverables
- A concise diff summary of the exact changes between good and regression for the activation flow files
- The minimal code patch on main restoring resilient program initialization while keeping your current working modifications intact
- Smoke test results for license and agent pages showing end-to-end success

## Notes
- No assumptions: this plan uses explicit git comparisons and runtime validation to pinpoint the regression source.
- We won’t roll back other independent changes; only the activation flow pieces will be corrected once identified.