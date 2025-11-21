## Cause
- Verification is type-aware but still requires memo to match orderId. In affiliate `/withdrawals/init`, we didn’t set memo, so the on-chain event’s memo is empty and verification fails, flipping confirmed signatures to failed.

## Fix
- In `server/routes/withdrawals.ts`, set `memo: orderId` when calling `buildClaimRewardsTx(...)` so RewardsClaimed contains the correct memo.
- Keep schema unchanged; client doesn’t need to send memo.
- Optional: later mirror this for admin bucket init if not already passing orderId as memo.

## Verification
- Restart backend, withdraw from /dapp/affiliate.
- Logs: “Fetching withdrawal event … memo: <orderId>” and the record remains confirmed (no downgrade to failed).

## Safety
- Minimal change; no API/flow change. Only memo is set server-side to the orderId.

## Deliverable
- Update `server/routes/withdrawals.ts` to pass `memo: orderId`.