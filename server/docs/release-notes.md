# Release Notes

## Auth Wallet Response Enhancement
- Added `credit_balance_micro` to `POST /api/auth/wallet` and `GET /api/auth/session` responses.
- No changes to request parameters.
- Error handling ensures default "0" when balances cannot be read.

## Frontend Integration
- Agent Activation modal now consumes `credit_balance_micro` from session/auth rather than calling `/agents/balances/credit`.
- UI always displays the Credit pill; zero balances show `$0.00`.