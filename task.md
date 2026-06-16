# Task: HD Wallet Payment Migration (execution)

## Phase 1 — Additive backend foundations (non-breaking) ✅ DONE (tsc clean)
- [x] `migrations/024_payment_orders.sql`
- [x] `lib/hd-wallet.ts` (deriveOrderKeypair, getOrderAddress, getTreasuryKeypair, getTreasuryAddress)
- [x] `lib/usdt-transfer.ts` (sendUsdt, sweepToTreasury, getUsdtBalanceMicro, isValidSolAddress)
- [x] `services/orders.ts` (allocate_hd_index w/ advisory lock + reuse, create/get/cancel)
- [x] `services/fulfillment.ts` (idempotent license/agent/deposit fulfillment)
- [x] `services/order-monitor.ts` (order-gated detect + sweep + fulfill, verifyAndSettleOrder)
- [x] `routes/orders.ts` (init/get/verify/cancel)
- [x] wire `routes/orders.ts` + `startOrderMonitor()` in `index.ts`
- [x] deps: +bip39 +ed25519-hd-key; cleared 5/6 pre-existing req.params errors

## Phase 2 — Breaking route rewrites  (backend build GREEN: 0 tsc errors)
- [x] `routes/withdrawals.ts` → usdt-transfer, amount-only, recipient = users.user_address (treasury payout, broadcast-aware revert)
- [x] `routes/license.ts` → balance path (debit credit_balance); order-paid settles via fulfillment.ts
- [x] `routes/agents.ts` → balance path ALREADY existed (credit); order path handled by fulfillment.ts
- [x] repoint `getBackendAuthorityPublicKey → getTreasuryAddress()` in index.ts, auth.ts, license.ts
- [ ] `routes/transactions.ts` → drop onchain_verifier + refund_manager (62KB; still references old modules)
- [ ] `routes/admin.ts` → rewrite 2 bucket-withdrawal endpoints to usdt-transfer; drop onchain_verifier deriveReference

## Phase 3 — Deletions + deps
- [ ] delete idl/, lib/authority.ts, lib/solana.ts, services/withdrawals.ts, refund_manager.ts, onchain_verifier.ts (+ test)
- [ ] backend/package.json deps (remove anchor, add bip39 + ed25519-hd-key)

## Phase 4 — Frontend  (frontend tsc baseline 0; held at 0 after each change)
- [x] `services/license/license-backend.ts` → activate { paymentMethod:'balance' }
- [x] `services/agent/agent-roi-service.ts` → consume {signature}, drop sign/confirmAndRecord
- [x] `services/payment/orders-service.ts` (NEW) → client for /orders + Solana Pay URI
- [x] qrcode.react dep added
- [x] `components/payment/PaymentOrderPanel.tsx` (NEW) — shared per-order pay UI: address+QR+countdown+poll+collision(Continue/Cancel&New)
- [x] **(1) License activation** — page rewired through PaymentOrderPanel (de-Anchored; legacy makePayment/recovery removed)
- [x] **(2) Deposit** — Deposit page at /dapp/deposit + dashboard "Deposit" action → PaymentOrderPanel type="deposit"
- [x] TTL: ORDER_TTL_MS default 60 min (license/agent), DEPOSIT_TTL_MS 24 h
- [ ] **(3) Agent deployment** — Hire page → PaymentOrderPanel type="agent" (order) + keep credit/balance path
- [ ] **(4) Withdrawal** — amount-only form (separate session per user)
- [ ] wallet-context.tsx de-Anchor + remove @coral-xyz/anchor (still 52 importers — final mechanical sweep)
- [ ] delete solairus-pay.ts, confirmAndRecord.ts; frontend package.json + vite.config.ts

## Phase 5 — Verify
- [x] backend `tsc --noEmit` → 0 errors (with new system wired; old modules still present)
- [ ] backend tsc after Phase 3 deletions (will break transactions.ts/admin.ts until cleaned)
- [ ] frontend build
- [ ] devnet sweep smoke test (manual) — needs HD_WALLET_MNEMONIC + USDT_MINT_ADDRESS + funded treasury

## Notes / remaining scope
- transactions.ts (62KB) still uses onchain_verifier (findPaymentSignatureByOrderId, verifyTransactionMatchesOnChain)
  + refund_manager (attemptExpiredWithdrawalRefund/Bucket). These power OLD on-chain payment recording/
  verification endpoints now obsolete under the order model. Gutting needs per-endpoint review vs frontend callers.
- Deletions (Phase 3) are BLOCKED until transactions.ts + admin.ts stop importing the old modules.
- Frontend (Phase 4) is a large surface (anchor/confirmAndRecord/solairus-pay long tail).
