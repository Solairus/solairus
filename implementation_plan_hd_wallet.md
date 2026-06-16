# Implementation Plan: Replace Smart Contract with HD Wallet (Hybrid Model)
> Mode C — HALT for approval before execution.
> Revised after review. Model: **Hybrid** — per-order addresses for direct purchases + optional deposit/top-up to internal balance. Both swept to treasury. Aligned to the `crypto-payment` skill, adapted for Solana.

---

## Goal

Remove all Anchor smart-contract interactions. Replace with:

1. **Per-order HD addresses** — each license/agent purchase mints a unique address (per-transaction index, **not** per-user) expecting an exact amount, detected, **swept to treasury**, then fulfilled. (Skill Core Design Decision.)
2. **Optional deposit/top-up** — a unique address that credits an internal `credit_balance`; license/agents can then be paid from balance with no on-chain step.
3. **Treasury / hot wallet** (backend-only signing) — sweep destination AND withdrawal source, so deposits/purchases self-fund payouts.
4. **Order-gated monitor** — only polls addresses with pending orders; zero RPC when idle.
5. **No user wallet required** to pay or withdraw — wallet kept only for sign-message login/identity (`users.user_address`).

### Solana advantage over the EVM skill (no per-address gas funding)

On EVM, each derived address needs native gas before it can sweep. On Solana, the backend holds **both** the order-address keypair and the treasury keypair, so the sweep transaction uses:
- `feePayer = treasury` (treasury holds SOL),
- SPL transfer `orderAddressATA → treasuryATA`, authority = order address,
- signers `[treasury, orderAddress]` (both backend-held).

This eliminates the "Index 0 gas funding" step entirely. The sender already paid ATA rent when funding the order address. **Do not port the EVM gas-funding logic.**

---

## Architecture

```
DIRECT PURCHASE (license / agent)
  POST /api/orders/init {type, tier?}           → allocate hd_index, derive address, expected amount
    ↳ collision check: existing pending order → HTTP 200 {info:'active_order_exists'} (NOT 4xx)
  Frontend shows address + QR + exact amount; polls GET /api/orders/:id
  Monitor sees pending order → checks the address's USDT ATA balance
    ↳ balance >= expected (lower tolerance only) → atomic pending→processing
    ↳ SWEEP synchronously (treasury fee-payer, dual-sign) → checkpoint in metadata
    ↳ FULFILL idempotently: license active / agent created + bucket + affiliate distribution
    ↳ order=completed, transaction=confirmed; polling stops
  Expired (no funds by TTL) → status=expired, hd_index reusable

DEPOSIT / TOP-UP
  POST /api/orders/init {type:'deposit'}         → same machinery, expected amount open
  Payment detected → SWEEP → credit credit_balance (NOT bonus/total_earnings)
  Later: activate license/agent with paymentMethod:'balance' → debit credit_balance, no chain

WITHDRAWAL
  POST /api/withdrawals/init {amountMicro}            ← NO destination field
    ↳ recipient = users.user_address (the connected/login wallet, read fresh from DB)
    ↳ validate amount, balance, 24h cooldown, caps → debit → transaction(processing)
    ↳ sendUsdt from treasury → recipient ATA → on confirmed: transaction=completed
    ↳ broadcast definitively failed → re-credit + failed; timeout → leave processing (admin reconcile)

LOGIN  → connect wallet → JWT, store users.user_address (identity AND payout destination)
```

---

## Environment Variables

```env
# Master mnemonic for HD order-address derivation (12/24 words). BACK UP before any address is issued.
HD_WALLET_MNEMONIC=word1 word2 ... word12

# Treasury / hot wallet — sweep target + withdrawal source + sweep fee payer.
# Reuse existing key, holds SOL (fees) + USDT (payout pool).
# SOLAIRUS_AUTHORITY_SECRET_BASE58=...

USDT_MINT_ADDRESS=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB   # drive from config, not hardcoded in QR
SOLANA_CLUSTER=mainnet-beta                                       # must match USDT_MINT_ADDRESS

ORDER_POLL_INTERVAL_MS=15000
ORDER_TTL_MS=1800000          # 30 min default — see Risk note; deposits may want longer (e.g. 24h)
SWEEP_MIN_TOLERANCE_BPS=50    # accept balance >= expected * (1 - 0.5%)
```

Remove after migration: `SOLAIRUS_PAY_PROGRAM_ID`, `VITE_SOLAIRUS_PAY_PROGRAM_ID`.

---

## Packages

**Backend add:** `bip39`, `ed25519-hd-key`  ·  **Backend remove:** `@coral-xyz/anchor`
**Frontend add:** `qrcode.react`  ·  **Frontend remove:** `@coral-xyz/anchor` only
**Keep:** `@solana/web3.js`, `@solana/spl-token` (RPC + SPL transfers), **`@reown/appkit` + `@reown/appkit-adapter-solana`** (decided: the Solana adapter is the wallet-connection layer that yields the login address — login is address-only today, no sign-message — so it stays; we only strip Anchor and the tx co-signing wiring).

---

## DB Schema

Reuse existing `balances` + `balance_history` (the "wallet service for historical balance"). Add one orders table that doubles as the address map (per skill: the order record IS the address mapping).

**`024_payment_orders.sql`**
```sql
CREATE TABLE payment_orders (
  id              BIGSERIAL PRIMARY KEY,
  order_ref       TEXT NOT NULL UNIQUE,                 -- human-readable
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hd_index        BIGINT NOT NULL,                      -- per-order; index 0 reserved (treasury)
  address         TEXT NOT NULL,
  type            TEXT NOT NULL,                        -- license | agent | deposit
  tier_id         BIGINT,                               -- for agent orders
  expected_micro  BIGINT,                               -- NULL/0 for open-ended deposit
  status          TEXT NOT NULL DEFAULT 'pending',      -- pending|processing|completed|cancelled|expired
  tx_signature    TEXT UNIQUE,                          -- settlement sig (replay guard)
  transaction_id  BIGINT,                               -- ledger link
  metadata        JSONB NOT NULL DEFAULT '{}',          -- captured balance, sweep checkpoints
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON payment_orders(status, expires_at);     -- monitor scan
CREATE INDEX ON payment_orders(user_id, status);        -- collision check
CREATE UNIQUE INDEX ON payment_orders(hd_index) WHERE status IN ('pending','processing','completed');
```

**hd_index reuse (skill Rule #9):** `allocate_hd_index()` = pick the lowest `hd_index` from a `cancelled`/`expired` order with zero confirmed on-chain balance; else `MAX(hd_index)+1`; never 0. Do it under `SELECT … FOR UPDATE` to avoid races.

No separate `deposits` table — a deposit is a `payment_orders` row of `type='deposit'`. The `transactions` ledger remains the source of truth for balance changes.

---

## Files

### BACKEND
| Action | File | Reason |
|---|---|---|
| `[DELETE]` | `backend/idl/` | Anchor IDL |
| `[DELETE]` | `backend/lib/authority.ts` | superseded by `hd-wallet.ts` (treasury loader) |
| `[DELETE]` | `backend/lib/solana.ts` | PDA/config reader — **first move `getBackendAuthorityPublicKey` callers** (see license.ts) |
| `[DELETE]` | `backend/services/withdrawals.ts` | Anchor claim_rewards builder → `usdt-transfer.ts` |
| `[DELETE]` | `backend/services/refund_manager.ts` | partial-tx refunds — n/a without Anchor (**verify no other importers**) |
| `[DELETE]` | `backend/services/onchain_verifier.ts` | replaced by order-gated monitor |
| `[NEW]` | `backend/lib/hd-wallet.ts` | order-address derivation + treasury loader |
| `[NEW]` | `backend/lib/usdt-transfer.ts` | SPL transfer (sweep + payout), dual-sign helper |
| `[NEW]` | `backend/services/order-monitor.ts` | order-gated detection + synchronous sweep + fulfill |
| `[NEW]` | `backend/services/fulfillment.ts` | idempotent license/agent/deposit fulfillment |
| `[NEW]` | `backend/routes/orders.ts` | init / get / verify / cancel |
| `[NEW]` | `backend/migrations/024_payment_orders.sql` | orders + address map |
| `[MODIFY]` | `backend/index.ts` | start `order-monitor` on boot |
| `[MODIFY]` | `backend/routes/license.ts` | accept `paymentMethod:'balance'` (debit credit_balance) **and** order-settled path; replace `getBackendAuthorityPublicKey` admin check with `getTreasuryAddress()`/`ADMIN_PUBKEYS` |
| `[MODIFY]` | `backend/routes/agents.ts` | activation via order **or** balance; remove Anchor tx building |
| `[MODIFY]` | `backend/routes/withdrawals.ts` | call `usdt-transfer.ts`; remove referencePubkey/txBase64/co-sign/polling |
| `[MODIFY]` | `backend/routes/transactions.ts` | drop imports of `onchain_verifier` + `refund_manager`; remove on-chain signature recording/polling paths |
| `[MODIFY]` | `backend/routes/admin.ts` | drop imports of `services/withdrawals` + `onchain_verifier`; bucket withdrawal via `usdt-transfer.ts`; treasury balance display |
| `[MODIFY]` | `backend/routes/auth.ts` | replace `getBackendAuthorityPublicKey()` (self-referral dev fallback) with `getTreasuryAddress()` |
| `[MODIFY]` | `backend/index.ts` | replace any `getBackendAuthorityPublicKey()`/`getAuthorityKeypair()` boot calls with `getTreasuryAddress()`/`getTreasuryKeypair()` |
| `[DELETE]` | `backend/services/__tests__/onchain_verifier.test.ts` | test for deleted module |
| `[MODIFY]` | `backend/package.json` | swap deps |

**Deletion ordering (strangler — confirmed importers):** `refund_manager`←`transactions.ts`; `onchain_verifier`←`admin.ts`,`transactions.ts`,`refund_manager.ts`+test; `services/withdrawals`←`admin.ts`,`withdrawals.ts`; `agent_withdrawal_refund`←`withdrawals.ts` (keep — reuse its re-credit logic for the failed-withdrawal path, verify); `getBackendAuthorityPublicKey`←`index.ts`,`auth.ts`,`license.ts`. Rewrite the route importers **first**, repoint the authority calls, **then** delete the leaf modules + tests.

### FRONTEND
| Action | File | Reason |
|---|---|---|
| `[DELETE]` | `frontend/src/services/wallet/solairus-pay.ts` | Anchor makePayment/withdrawReward |
| `[DELETE]` | `frontend/src/services/transactions/confirmAndRecord.ts` | on-chain polling |
| `[DELETE]` | `frontend/src/shims/solana-mobile-protocol.ts` (if present) | mobile adapter shim |
| `[MODIFY]` | `frontend/src/contexts/wallet-context.tsx` | drop `anchorProvider` state + `@coral-xyz/anchor` import + `signTransaction`/`signAllTransactions` co-signing; **keep** AppKit/Reown connection, `account`, `publicKey`, connect/disconnect (login stays address-only) |
| `[MODIFY]` | `frontend/src/services/agent/agent-activation-service.ts` | `POST /api/orders/init` (order) or `/api/agents/activate` (balance) |
| `[MODIFY]` | `frontend/src/services/agent/agent-roi-service.ts` | `POST /api/withdrawals/init`, returns `{signature}` |
| `[MODIFY]` | `frontend/src/services/license/license-backend.ts` | order/balance activation, drop contract path |
| `[NEW]` | `frontend/src/pages/Dapp/Pay/index.tsx` | shared order screen: address + QR + amount + countdown + auto-verify poll + collision dialog |
| `[NEW]` | `frontend/src/pages/Dapp/Deposit/index.tsx` | top-up entry (reuses Pay screen) |
| `[MODIFY]` | `frontend/src/pages/Dapp/LicenseActivation/index.tsx` | route through Pay screen or balance |
| `[MODIFY]` | `frontend/src/pages/Dapp/Agents/Hire/index.tsx` | route through Pay screen or balance |
| `[MODIFY]` | `frontend/src/components/WalletGate.tsx` | wallet optional for pay/withdraw |
| `[MODIFY]` | `frontend/vite.config.ts` | remove Solana mobile shim aliases (if present) |
| `[MODIFY]` | `frontend/package.json` | remove `@coral-xyz/anchor` only; keep Reown |

> **Frontend scope note:** a grep shows Anchor / `confirmAndRecord` / `solairus-pay` references reach well beyond the rows above (many components + tests). The core entry points are listed; budget a grep-driven sweep to clear the long tail (`agent-activation-service`, `agent-roi-service`, `license-activation`, `solairus-program-validation`, `token-ata`, admin components, and their tests).

---

## Key Module Sketches

### `backend/lib/hd-wallet.ts`
```typescript
// Order address per HD index (per-transaction). Path: m/44'/501'/<index>'/0'
export function deriveOrderKeypair(index: number): Keypair { /* bip39 + ed25519-hd-key, Keypair.fromSeed(key) */ }
export function getOrderAddress(index: number): string
// Treasury / hot wallet — reuse SOLAIRUS_AUTHORITY_SECRET_BASE58
export function getTreasuryKeypair(): Keypair
export function getTreasuryAddress(): string
```

### `backend/lib/usdt-transfer.ts`
```typescript
// Payout: treasury → recipient (fee payer = treasury, single signer)
export async function sendUsdt(p:{toAddress:string; amountMicro:number}): Promise<{signature:string}>
// Sweep: orderAddress → treasury (fee payer = treasury, signers [treasury, orderKeypair])
export async function sweepToTreasury(p:{orderIndex:number; amountMicro:number}): Promise<{signature:string}>
```
Both: working connection via `rpc-manager`, `getOrCreateAssociatedTokenAccount`, `createTransferInstruction`, `confirmTransaction('confirmed')`.

### `backend/services/order-monitor.ts`
```
runCycle():
  orders = SELECT pending orders WHERE expires_at > NOW()    -- order-gated; none → return (no RPC)
  for each: checkAndSettle(order)
  UPDATE pending → expired WHERE expires_at <= NOW()

checkAndSettle(order):
  bal = USDT balance at ATA(order.address, mint)             -- watch the ATA, NOT getSignaturesForAddress(owner)
  expected = order.expected_micro (skip if deposit & bal==0)
  if bal < expected*(1 - tol): return                         -- not yet funded
  locked = UPDATE payment_orders SET status='processing' WHERE id=? AND status='pending'  -- atomic lock
  if !locked: return
  try {
    sig = sweepToTreasury({orderIndex: order.hd_index, amountMicro: bal})   -- ONE transfer, checkpoint
    fulfill(order, bal, sig)                                  -- idempotent, see fulfillment.ts
  } catch (e) { log; leave 'processing' for admin retry }     -- never auto-revert a possible on-chain send
```

### `backend/services/fulfillment.ts` (idempotent, single DB transaction)
```
fulfill(order, capturedMicro, sweepSig):
  replay guard: if order.tx_signature set → return
  BEGIN
    INSERT transactions(...) RETURNING id          -- or reuse order.transaction_id
    switch(order.type):
      license: UPDATE users license_status/expiration; distributeLicense(); distributeAffiliateBonuses()
      agent:   INSERT agents(active, tier, amount); affiliate distribution
      deposit: applyBalanceBucketChange(credit_balance, 'credit', capturedMicro)   -- NOT bonus_balance
    UPDATE payment_orders SET status='completed', tx_signature=sweepSig, transaction_id=...
  COMMIT
```
Idempotency: `payment_orders.tx_signature` UNIQUE + status guard; distribution helpers already keyed by `transaction_id`.

### Withdrawal (corrected, no double-spend)
```
recipient = SELECT user_address FROM users WHERE id = auth.sub   -- payout = stored connected wallet, NOT a form field
guard: recipient is a valid on-curve Solana address (defensive; should always pass)
BEGIN: debit balance; INSERT transactions(status='processing') COMMIT
sendUsdt({toAddress: recipient, amountMicro})
  ok      → UPDATE transactions completed, signature
  failed BEFORE broadcast (validation/build) → re-credit + status='failed'
  timeout AFTER broadcast                     → leave 'processing'; admin reconciles vs chain (never blind re-credit)
```
Rationale: the user can only ever withdraw to the wallet they authenticated with. No user-entered destination → no address-swap/typo loss, no phishing redirect. (If a "withdraw elsewhere" feature is ever needed, gate it behind a separate re-auth/confirmation — not the default path.)

---

## Endpoints

```
POST   /api/orders/init    {type:'license'|'agent'|'deposit', tier?}  → {order_ref,address,expected_micro?,expires_at,mint,cluster}
                                                                          | 200 {info:'active_order_exists', order}
GET    /api/orders/:ref                                                → {status, address, expected_micro?, captured_micro?, tx_signature?}
POST   /api/orders/:ref/verify                                        → force one detection pass (same logic as monitor)
POST   /api/orders/:ref/cancel                                        → status='cancelled' (address reusable; late funds orphaned)
POST   /api/withdrawals/init {amountMicro}   (recipient = stored users.user_address) → {signature, amountMicro, toAddress}
POST   /api/license/activate {paymentMethod:'balance'} (alt to order) → debit credit_balance
POST   /api/agents/activate  {paymentMethod:'balance', tier}         → debit credit_balance
```
Frontend auto-verifies (poll `GET /:ref` every 3–5 s); no button click required.

---

## Execution Order
1. Migration `024_payment_orders.sql`
2. `lib/hd-wallet.ts`, `lib/usdt-transfer.ts` (additive, unit-test derivation + a devnet sweep)
3. `services/fulfillment.ts`, `services/order-monitor.ts` (additive)
4. `routes/orders.ts` + wire monitor in `index.ts` (additive)
5. Rewrite `routes/withdrawals.ts`; add balance paths to `routes/license.ts`, `routes/agents.ts`
6. Move `getBackendAuthorityPublicKey` admin check → `getTreasuryAddress()`/`ADMIN_PUBKEYS`; clean `transactions.ts`, `admin.ts`
7. Delete `idl/`, `authority.ts`, `solana.ts`, `services/withdrawals.ts`, `refund_manager.ts`, `onchain_verifier.ts` (**grep importers first**)
8. `backend/package.json` deps
9. Frontend: `wallet-context.tsx`, service layer, Pay/Deposit pages, License/Hire wiring, `vite.config.ts`, `package.json`
10. `yarn install` both; `docker compose up --build`; verify on **devnet** end-to-end before mainnet

---

## Risks
| Risk | Mitigation |
|---|---|
| HD mnemonic lost | Back up before issuing any address; documented runbook |
| Treasury low on SOL (sweep + payout fees) | Expose `getTreasuryAddress()` + SOL/USDT balance in admin + `/api/_authority` |
| SPL detection misses deposits | Watch the **ATA**, not the owner system account; poll parsed token balance |
| Double-credit on restart | `payment_orders.tx_signature` UNIQUE + status guard; idempotent distribution |
| Withdrawal double-spend | Never blind re-credit after broadcast; reconcile timeouts vs chain |
| Order expires mid-payment | TTL 30 min for purchases; **longer (e.g. 24 h) for deposits**; expired addresses reused only when on-chain balance is 0 |
| Concurrent verify | Atomic `pending→processing` lock + idempotent fulfill (skill two-layer defense) |
| Custodial trust shift | Seed + payout key both backend-side — fully custodial now; accept explicitly, secure env/secrets |
| Reused index with stray funds | `allocate_hd_index` only reuses indexes with **zero** confirmed balance |

---

## Resolved decisions (were open items)
- **Reown adapter — KEEP.** Login is address-only (`/auth/wallet` verifies no signature); the Solana adapter is the connection layer that yields the address. Strip Anchor + tx co-signing only.
- **Deletions — ordered strangler.** Importers confirmed (see Deletion ordering above). Rewrite route importers + repoint `getBackendAuthorityPublicKey → getTreasuryAddress()` first, then delete leaves + tests.
- **License activation — HARD-SWITCH.** Today the license only flips to `active` after the caller passes a `transaction_id`/`signature` from the old on-chain payment. That path goes away. New behavior: license flips automatically when its `type='license'` order is detected/settled (in `fulfillment.ts`), **or** instantly when paid with `paymentMethod:'balance'`. No on-chain proof handoff.
- **Deposit bucket — `credit_balance` (confirmed by user).** Excluded from `total_earnings` per `balance.ts:39`.

---

**Awaiting approval. Reply "approved" to begin execution, or adjust any item above.**
