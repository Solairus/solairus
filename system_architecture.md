# System Architecture — Contract-Free HD-Wallet Payments

Design pattern adopted in the smart-contract removal migration (see `implementation_plan_hd_wallet.md`,
reusable skill `crypto-payment-solana`). Recorded per Antigravity Mode C.

## Pattern: per-order HD addresses + treasury sweep + internal balance (hybrid)

```
PAYMENT IN (per-order)                         PAYMENT IN (deposit/top-up)
  POST /orders/init {license|agent}              POST /orders/init {deposit}
   → allocate per-tx hd_index (reuse freed)       → same machinery, expected=open
   → derive m/44'/501'/<index>'/0' address        → credit credit_balance on settle
   → expected = exact price
  order-monitor (order-gated; 0 RPC idle)
   → read USDT at address ATA (not owner)
   → atomic pending→processing lock
   → sweepToTreasury (dual-signer: treasury fee-payer + order authority; NO per-addr gas)
   → fulfillOrder (idempotent via tx_signature UNIQUE): license active / agent row / credit balance

SPEND (internal)                               PAYMENT OUT
  POST /license/activate {balance}               POST /withdrawals/init {amountMicro | activationId}
  POST /agents/activate  {credit}                 → recipient = users.user_address (stored login wallet)
   → debit credit_balance                         → reserve (tx=processing) → sendUsdt(treasury→user)
                                                   → confirmed | pre-broadcast revert | post-broadcast leave-processing
```

## Key components (backend)
- `lib/hd-wallet.ts` — `deriveOrderKeypair` (ed25519, hardened), `getOrderAddress`, `getTreasuryKeypair/Address`. Treasury reuses `SOLAIRUS_AUTHORITY_SECRET_BASE58`.
- `lib/usdt-transfer.ts` — `getUsdtBalanceMicro` (ATA read, 0 if missing), `sweepToTreasury` (dual-signer), `sendUsdt` (payout), `isValidSolAddress` (on-curve).
- `services/orders.ts` — advisory-locked per-tx index allocation with abandoned-index reuse; create/get/cancel.
- `services/fulfillment.ts` — idempotent settle (license/agent/deposit) + post-commit distributions.
- `services/order-monitor.ts` — order-gated poll loop; `verifyAndSettleOrder` reused by `/orders/:ref/verify`.
- `routes/orders.ts` — init (collision = HTTP 200 info) / get / verify / cancel.

## Invariants
- Per-transaction index, never per-user; index 0 reserved for treasury.
- Detect on the ATA, never `getSignaturesForAddress(owner)`.
- Sweep target == payout source == treasury (self-funding).
- Idempotency: `payment_orders.tx_signature` UNIQUE + row-lock status guard; atomic `pending→processing`.
- Withdrawal destination is always the stored login wallet; amount-only endpoint; never blind re-credit after broadcast.
- Deposits credit `credit_balance` (excluded from `total_earnings`); earnings stay in bonus/reward.
- Custodial: HD mnemonic + treasury key in backend env.

## Migration state (as of this checkpoint)
- DONE + tsc-green: orders/monitor/sweep/fulfillment, withdrawals, license activate (balance), authority repoint.
- PENDING: gut `transactions.ts` (onchain_verifier/refund_manager) + `admin.ts` bucket-withdrawal endpoints;
  delete old modules (idl, authority.ts, solana.ts, services/withdrawals.ts, refund_manager.ts, onchain_verifier.ts);
  frontend overhaul (drop Anchor/solairus-pay/confirmAndRecord; Pay/Deposit pages; amount-only withdraw).
