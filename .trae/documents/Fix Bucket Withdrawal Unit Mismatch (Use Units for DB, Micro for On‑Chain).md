## Issue
- `bucket_balances` stores NUMERIC(20,6) in USDT units, but the admin withdrawal route compares that to `amountMicro` (micro‑USDT), causing false "Insufficient bucket balance" errors.

## Fix
1) In `server/routes/admin.ts` bucket withdrawal init:
- Convert `amountMicro` → `amountUnits = amountMicro / 1_000_000`.
- Compare `currentBalance (units)` ≥ `amountUnits`.
- Update `bucket_balances` using `amountUnits` and write `bucket_histories.amount` & `bucket_histories.bucket_balance` in units.
- Continue storing `transactions.amount` in micro (BIGINT) for on‑chain consistency.

2) Keep On‑Chain Construction
- `buildClaimRewardsTx` continues using micro‑USDT for program instruction.
- `order_id`, `reference`, and verification logic remain unchanged.

## Verification
- With dev bucket balance 53.94 units, withdrawing 1 USDT succeeds.
- `bucket_balances.dev` decrements by 1.00; `bucket_histories` records `amount=-1.00`, `bucket_balance=52.94`.
- Transaction retains `amount=1_000_000` micro.

## Safety
- Numeric arithmetic done with DB NUMERIC; consistent rounding.
- Transactional updates under row lock; audit entries preserved.

## Deliverables
- Route update in `server/routes/admin.ts` to perform unit‑based debit and history writes.
- No UI changes required.

Proceeding to implement after your confirmation.