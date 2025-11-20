## Problem
- Role (bucket) withdrawal refunds currently treat `record.amount` as unit value and convert again to micro, causing incorrect refund sizes.
- Requirement: For role_withdrawal, input is micro units; divide by 1e6 before processing and use unit decimal for bucket refund. Validate input format and add monitoring.

## Targeted Changes (Scope: role_withdrawal only)
1) Adjust refund conversion in `server/services/bucket_withdrawal_refund.ts`
- Validation: confirm `record.amount` is micro (integer) with `decimals=6` (no decimal point). If invalid, annotate metadata and bail or correct path.
- Conversion: coerce to micro bigint directly (no extra scaling), then `microBigIntToDecimalString(micro, 6)` to get unit decimal (USDT) for `applyBucketChange`.
- Monitoring: include `refund_amount_micro`, `refund_amount_usdt`, and `conversion_applied: true` in `finalizeRefund` metadata; warn on unusually large amounts.
- Documentation comments explaining the special case.

2) Keep other types unchanged
- `attemptExpiredWithdrawalRefund` (user_withdrawal) continues to operate in micro units; no conversion changes applied.

3) Tests
- Add unit tests covering:
  - Correct micro→unit conversion for role_withdrawal
  - No conversion path for user_withdrawal
  - Edge cases: zero amount, max reasonable amounts

4) Safety
- Pre-production validation: add guard that throws or flags when `decimals!==6` or non-integer micro inputs for role_withdrawal.
- Alerting: log warning and annotate metadata for unusually large refunds; ensure easy rollback by scoping changes to one module.

## Outcome
- Accurate refunds for role withdrawals, consistent units across bucket balances, with validation, monitoring, and tests, without affecting other flows.