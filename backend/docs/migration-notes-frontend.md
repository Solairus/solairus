# Frontend Migration Notes

## What Changed
- Use `credit_balance_micro` from `/api/auth/wallet` or `/api/auth/session`.
- Remove redundant call to `/api/agents/balances/credit`.

## Steps
1. After wallet connect, rely on existing `AuthService.authenticateWallet` to establish session.
2. Retrieve `credit_balance_micro` via `AuthService.getSession()` where needed.
3. Format credit using micro-USDT to USD conversion with two decimals for UI.

## Compatibility
- Existing consumers reading only `bonus_balance_micro` remain unaffected.
- New field is optional; treat missing as `"0"`.