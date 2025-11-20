## Summary
We will add a simple Node.js script that reads pending withdrawals from the database and invokes the unified resolver directly (compiled service). Then we’ll run it locally to diagnose and update pending states.

## Implementation
- Add `server/scripts/checkandupdatepending.js` that:
  - Loads env (`dotenv/config`)
  - Requires compiled `dist/server/services/pending_withdrawals_resolver.js` and `dist/server/db.js`
  - Queries distinct `initiator_wallet` for pending withdrawals
  - For each wallet, calls `resolvePendingWithdrawalsForWallet(wallet)`
  - Prints a short summary of before/after counts
- Run build to ensure service is compiled, then run the script: `node server/scripts/checkandupdatepending.js`

## Safety
- Script uses existing DB and resolver code; read-only except resolver’s intended updates.
- No secrets printed; uses env configuration.

Approve and I’ll add the script, build, and run it with logs.