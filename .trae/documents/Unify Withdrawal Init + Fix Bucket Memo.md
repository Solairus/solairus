## Goal
- Make bucket withdrawals behave identically to affiliate withdrawals and pass `orderId` as on-chain memo. Avoid code duplication and keep current working parts intact.

## Minimal Fix (Immediate)
- In `server/routes/admin.ts`, set `memo: orderId` when calling `buildClaimRewardsTx(...)` for both admin bucket init handlers:
  - At lines ~375–383 and ~507–515, replace `memo: parsed.data.memo` with `memo: orderId`.
- Leave schema accepting `memo` as optional for backward compatibility, but ignore it. Verification remains type-aware and compares `RewardsClaimed.memo === order_id`.

## Consistency
- Ensure both affiliate `/withdrawals/init` and admin bucket init use the same pattern: build tx with `memo=orderId`, record with `order_id` and `reference` metadata, then client signs as fee payer.
- No changes to refund logic or post-confirmation processors.

## Optional Cleanup (Future)
- Extract a small shared helper (no signature change) to reduce duplication:
  - `initWithdrawalAndDebit({ kind: 'bonus' | 'bucket', ... })` used by both routes. For now, keep edits minimal.

## Verification
- Restart backend.
- Perform a bucket withdrawal; server logs should show memo matching `order_id` and status confirmed, just like affiliate.
- Confirm pending resolver and signature recording work end-to-end.

## Safety
- Only memo assignment updated; no flow or schema changes. Keeps the currently working affiliate logic untouched.