## Issue
- Server route `admin.ts` uses `Transaction.from(...)` during pre-simulation but does not import `Transaction`, causing a runtime error: “Transaction is not defined” and a 400 response.

## Fix
- Add `import { Transaction } from '@solana/web3.js'` to `server/routes/admin.ts`.
- No behavior changes otherwise; pre-simulation will return structured `{ error: 'simulation_failed', logs, message }` when it fails.

## Verification
- Restart backend.
- Trigger bucket withdrawal; if simulation fails, frontend receives detailed logs instead of generic error; if success, tx proceeds.

## Impact
- Unblocks the pre-simulation path and reduces Phantom warnings by preventing failed preflight submissions.