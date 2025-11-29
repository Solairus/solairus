## Root Cause
- Refund path for expired withdrawals converts the transaction `amount` from units to micro (`amount * 10^decimals`) before crediting `balances.bonus_balance`.
- But transactions already store `amount` in micro. This double scaling turns 499000 into 499000000000.
- Location: server/services/withdrawal_refund.ts:86–89.

## Proposed Fix
1. Withdrawals refund (balances table)
- Replace the rescaling logic with raw micro handling:
  - Read `record.amount` as a bigint string/number and treat it as micro directly.
  - Example:
    - `const raw = record.amount;`
    - `const amountMicro = typeof raw === 'number' ? BigInt(Math.round(raw)) : BigInt(String(raw));`
- Keep `applyBalanceBucketChange(..., amountMicro)` since balances store micro.

2. Buckets refund (bucket_balances table)
- No change: continue converting micro → unit string when crediting buckets.
- Verified already in server/services/bucket_withdrawal_refund.ts using `microBigIntToDecimalString`.

3. Tests
- Add a test for attemptExpiredWithdrawalRefund:
  - Seed a pending withdrawal with `amount = 499000` (micro) and `decimals = 6`.
  - Run refund → assert `balances.bonus_balance` increases by exactly `499000` (not ×1e6).
- Add a test for bucket refund to confirm conversion to units is correct.

4. Safety & Logging
- Add a guard that, if `decimals === 6` and `record.amount >= 1_000_000_000_000n` (suspicious), log a warning.
- Document clearly in code comments: `balances` store micro; `bucket_balances` store unit strings.

## Files To Change
- server/services/withdrawal_refund.ts (replace rescaling block; add comment)
- server/services/__tests__/bucket_withdrawal_refund.test.ts (extend tests)
- server/services/__tests__/withdrawal_refund.test.ts (new test)

## Validation
- Run `npx tsc --noEmit` and backend tests.
- Simulate the 499000 case and verify database values.

## No Data Migration
- Only affects future refunds; existing incorrect rows can be fixed with a follow-up script if desired. 