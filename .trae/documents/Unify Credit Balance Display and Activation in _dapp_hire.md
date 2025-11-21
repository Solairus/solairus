## Key Points
- USDT activation flow stays unchanged and out of scope.
- Credit balance source changes to `/auth/wallet` (already returned on login), no extra `/auth/session` or other calls.
- Show credit pill and credit payment option only when `credit_balance_micro > 0`.

## Where the Issue Is
- `/dapp/hire` uses `DirectHireModal` in `src/pages/Dapp/Agents/Hire/index.tsx`.
- It still fetches credit via deprecated on-chain `UserService.getUserCreditBalance(...)` and only shows the pill when credit > 0.
- Even though `/auth/wallet` now returns `credit_balance_micro`, `DirectHireModal` does not consume it, so the pill/payment method remains hidden.

## Implementation Plan
### 1) Cache wallet auth response once, then consume
- Update `AuthService.authenticateWallet(...)` to persist the returned `user` payload (including `credit_balance_micro`) to local storage (e.g., `solairus.user`).
- Add `AuthService.getCachedUser()` to read the stored payload without extra network calls.
- Note: WalletContext already calls `AuthService.authenticateWallet(address)` silently; this ensures the cached payload exists immediately after connect.

### 2) Replace credit fetch in DirectHireModal
- Remove the on-chain credit balance fetch (`UserService.getUserCreditBalance`).
- On modal open (and when user types amount), read local cached user via `AuthService.getCachedUser()` and parse `credit_balance_micro`.
- Keep existing visibility rules:
  - Render credit pill only when `credit_balance_micro > 0`.
  - Show/enable credit payment method only when the pill is present and the entered amount ≤ credit balance (micro → USD).
- Formatting: micro → USD with locale thousand separators, two decimals.

### 3) Activation logic (credit only)
- When `paymentMethod === 'credit'` and sufficient balance, call backend `POST /api/agents/activate` with `{ amountMicro, paymentMethod: 'credit', tierName }`.
- No smart-contract calls for credit; USDT path remains untouched.

### 4) Testing & Verification
- Unit tests for `DirectHireModal`:
  - Mocks `AuthService.getCachedUser()` and verifies credit pill render/hide logic and enabling/disabling credit tile.
  - Confirms backend credit activation is called only when sufficient credit.
- Manual:
  - Connect wallet → `/auth/wallet` returns `credit_balance_micro`.
  - Open `/dapp/hire` → credit pill shows only when balance > 0; credit method enabled only when amount ≤ balance.

### 5) Documentation
- Note in migration docs: Frontend now consumes cached user from `/auth/wallet`; remove redundant balance endpoint usage.

## Scope Guard
- Touch only `AuthService` (add cache getter) and `DirectHireModal`.
- Do not modify USDT logic, other pages, or global contexts.

## Request for Approval
- If you approve, I will implement these minimal, isolated changes and provide test updates and screenshots confirming credit-only behavior with no extra network calls.