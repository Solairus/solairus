## Changes To Be Committed
- server/services/withdrawal_refund.ts: use transaction amount in micro as-is; remove extra 10^decimals scaling; add clarifying comments.
- server/services/bucket_withdrawal_refund.ts: confirm micro→unit conversion (no functional change), minor monitoring comments.
- server/services/balance.ts: referenced for unit expectations (no code changes).
- server/services/__tests__/withdrawal_refund.test.ts: add sanity test for refund path using micro.
- server/services/__tests__/bucket_withdrawal_refund.test.ts: add sanity test ensuring bucket refund converts micro→unit.
- server/lib/rpc-manager.ts, server/routes/rpc.ts: preflight RPC selector and light health probe (getVersion) already implemented.
- src/utils/rpc-switcher.ts: frontend preflight selector and 402 handling.

## Commit Message
"fix(refund): credit balances with micro as-is; keep buckets in unit; add tests
feat(rpc): preflight select working RPC (backend+frontend), use getVersion for health"

## Push Steps
1. Run `git status` to verify modifications.
2. Stage all changes: `git add -A`.
3. Commit with message above.
4. Push to `origin/main`: `git push`.

## Verification
- Type check: `npx tsc --noEmit`.
- Optional test run (if CI configured): backend tests should pass.

## Rollback Plan
- `git revert <commit_sha>` or `git reset --hard HEAD~1` if needed.

Confirm to proceed with commit and push now. 