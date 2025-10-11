You are **Trae**, our Solana developer.  
Your task is to create the **BalanceVault** smart contract for the **Solairus DeFi DApp** using **Anchor (Rust)** on Solana.  
Follow the specs exactly. Do not add features or assumptions.

---

## 📘 Contract: `BalanceVault`

### Purpose
A **central balance manager** that:
- Accepts **SOL deposits** from users, converts to **USDT-equivalent** using **Pyth SOL/USD**, and tracks per-user totals.
- Allows **Admin or Dev** to **manually credit/debit** a user’s USDT-equivalent tracked balance (off-chain adjustments).
- Reads **total spent** from an external **HireAgent** contract to compute **spendable balance**.
- Tracks **internal SOL distributions** for system wallets on every user deposit.
- Allows **only five system wallets** to withdraw their tracked SOL balances.

> ✅ This contract does **not** handle user withdrawals of deposits.  
> ✅ Only the five system wallets can withdraw their internal balances (see “Withdrawals” below).

---

## 🔐 Roles

- **Dev (Deployer/Owner)**  
  - Full control to **configure** system wallets and **set/update** the HireAgent program address.  
  - Can **manually credit/debit** user balances.  
  - **Cannot** call the system-wallet withdrawal function (see “Withdrawals” rule correction).

- **Admin**  
  - Can **manually credit/debit** user balances.  
  - Can withdraw **its own** internal SOL balance.

- **Marketer1**, **Marketer2**, **Trader**, **SystemReserve**  
  - Can withdraw **their own** internal SOL balances only.

- **User**  
  - Can **deposit** SOL and view balances/read-only data.

---

## 🧩 Core Features

### 1) User Deposit in SOL → Track USDT-equivalent
- Instruction: `deposit()` (payable in lamports).
- Action:
  - Read **Pyth SOL/USD** price on-chain (passed as account; validate freshness & confidence).
  - Convert deposited **lamports → SOL → USDT** (decimals & exponent-safe).
  - Update `userTotalDepositUSDT[user] += convertedUSDT`.
  - Update **internal SOL distribution** buckets (see below) using the **exact SOL amount** from this deposit (not USDT).
  - Emit `Deposit { user, lamports, sol_amount, usdt_value }`.
- Reject zero or negative amounts; reject stale/invalid oracle data.

### 2) Internal SOL Distributions (per deposit)
Track SOL portions internally (no SOL transfers on deposit):
- **10% → Admin**
- **10% → Dev** *(tracked but see “Withdrawals” rule below)*
- **5% → Marketer1**
- **5% → Marketer2**
- **15% → Trader**
- **55% → SystemReserve**

Maintain separate **internal SOL ledgers** for each wallet.  
Manual credit/debit (below) **does not** affect these SOL ledgers.

### 3) Manual Adjustments (USDT-equivalent ledger only)
- Instruction: `manual_adjust(user, amount_usdt, action)`  
  - `action ∈ {"credit","debit"}`
- Callable by: **Admin or Dev**.
- Effect:  
  - `credit` → `userTotalDepositUSDT[user] += amount_usdt`  
  - `debit` → `userTotalDepositUSDT[user] -= amount_usdt` (with non-negative floor)
- No effect on internal SOL distributions.
- Emit `ManualAdjustment { user, amount_usdt, action, executor }`.

### 4) HireAgent Integration (Read-Only)
- Instruction: `set_hire_agent(hire_agent_program: Pubkey)` (Dev only).
- View: `getTotalSpent(user)` via **CPI read** or account deserialization from `HireAgent` program (read-only).
- **Spendable balance**:

spendable(user) = userTotalDepositUSDT[user] - getTotalSpent(user)

- Provide public read functions for frontend/other programs (see below).

### 5) System Wallet Configuration
- Instruction: `set_system_wallets({admin, marketer1, marketer2, trader, system_reserve})` (Dev only).
- When updating, **automatically migrate** any existing internal SOL balances from old wallet keys to the new ones **1:1** to avoid loss.
- Emit `SystemWalletsUpdated { by, at }`.

> **Dev remains immutable as the program authority/owner.**  
> Store Dev as the upgrade authority or derive from the signer at initialization; Dev is **not** changed by `set_system_wallets`.

### 6) Withdrawals — **IMPORTANT RULE CORRECTION**
- Instruction: `withdraw_internal_balance(amount_sol)`  
- **Only callable by exactly these five wallets** (must match the stored wallet pubkeys):
- **Admin**
- **Marketer1**
- **Marketer2**
- **Trader**
- **SystemReserve**
- Validation:
- Caller must be one of the five system wallets above.
- `amount_sol <= internal_balance[caller]`
- Effect:
- Transfer `amount_sol` (in lamports) from the program account to `caller`.
- Decrease `internal_balance[caller]` accordingly.
- Emit `InternalWithdrawal { wallet, amount_sol }`.
- **Dev cannot withdraw** via this function (even though Dev’s 10% is tracked). Keep Dev excluded by explicit check.

---

## 🧾 Public Read Functions

Expose read-only helpers for frontend/other programs:

- `get_total_deposit_usdt(user) -> u64`  
- `get_total_spent_usdt(user) -> u64` (via HireAgent read)  
- `get_spendable_usdt(user) -> u64`  
- `get_internal_balances() -> { admin, dev, marketer1, marketer2, trader, system_reserve }` (in SOL, e.g., lamports or 9-decimals)  
- `get_system_wallets() -> { admin, dev, marketer1, marketer2, trader, system_reserve }`  
- `get_hire_agent() -> Pubkey`  
- `get_pyth_price_info() -> (price, expo, conf, slot, staleness_ok)` (optional convenience)

---

## 🧠 State & Accounts (high level)

- **Config PDA** (singleton):
- `dev: Pubkey` *(immutable owner/deployer)*
- `admin: Pubkey`
- `marketer1: Pubkey`
- `marketer2: Pubkey`
- `trader: Pubkey`
- `system_reserve: Pubkey`
- `hire_agent_program: Pubkey` *(optional until set)*
- `pyth_price_account: Pubkey` *(SOL/USD feed; set at init, updatable by Dev if desired)*

- **Per-user PDA**:
- `user: Pubkey`
- `total_deposit_usdt: u64` *(USDT-equivalent, integer with chosen 6 decimals or whole cents; be consistent)*
- (No per-user SOL ledger)

- **Internal SOL Ledger (in Config or separate PDA)**:
- `internal_admin_sol: u64`
- `internal_dev_sol: u64`
- `internal_marketer1_sol: u64`
- `internal_marketer2_sol: u64`
- `internal_trader_sol: u64`
- `internal_system_reserve_sol: u64`

> Use lamports internally; expose helper to convert lamports↔SOL if needed.

---

## 🛰️ Oracle (Pyth SOL/USD)
- Pass the **Pyth price account** into `deposit()`.
- Validate:
- Price **freshness** (slot recency / publish time window)
- **Confidence** bounds (reject absurdly wide conf intervals)
- Compute USDT value safely using price `expo` and token decimals.
- On failure, revert with clear error.

---

## 🎯 Events
Emit structured events:
- `Deposit { user, lamports, sol_amount, usdt_value }`
- `ManualAdjustment { user, amount_usdt, action, executor }`
- `InternalWithdrawal { wallet, amount_sol }`
- `SystemWalletsUpdated { by, at }`
- `HireAgentUpdated { new_address, at }`

---

## 🚧 Access Control & Validation

- **Initialization**:  
- Dev initializes Config with required wallets and Pyth feed.  
- Dev is stored immutably as owner; cannot be modified by any instruction.

- **Guards**:
- `only_dev`: `set_system_wallets`, `set_hire_agent`, (optional) `set_pyth_feed`.
- `admin_or_dev`: `manual_adjust`.
- `only_system_withdrawable`: `withdraw_internal_balance` where caller ∈ {admin, marketer1, marketer2, trader, system_reserve}.
- Recheck for signer matches configured pubkeys.

- **Safety**:
- Handle arithmetic using checked math.
- Prevent negative user balances on `debit`.
- Prevent zero-amount deposits and withdrawals.
- Ensure **withdrawals** never exceed tracked internal balance (rule correction above).

---

## 🧪 Tests (Anchor Mocha/TS)
Create comprehensive tests that demonstrate:
1. **Init**: Dev sets all system wallets & Pyth feed; config stored correctly.
2. **Deposit**:  
 - Simulate Pyth price (use Pyth test helpers/mocks).  
 - User deposits SOL → user USDT tracked increases; internal SOL ledgers update with exact percentages.
3. **Manual Adjust**:  
 - Admin credits & debits user; balances reflect correctly; no effect on internal SOL ledgers.
4. **HireAgent Read**:  
 - Mock HireAgent `totalSpent(user)` to return a value; verify `get_spendable_usdt = deposits - spent`.
5. **Withdrawals (CORRECTED RULE)**:  
 - Admin/Marketer1/Marketer2/Trader/SystemReserve can withdraw up to their tracked SOL; balances decrease and lamports transfer out.  
 - **Dev cannot withdraw** (expect failure).
6. **System Wallet Rotation**:  
 - Dev updates system wallets; prior internal SOL balances seamlessly migrate to new keys; old keys can no longer withdraw; new keys can.
7. **Oracle Guards**:  
 - Stale/inaccurate Pyth data causes deposit to fail with descriptive error.
8. **Edge Cases**: zero amounts, over-withdraw, overspend on manual debit, etc.

---

## 📦 Tech & Conventions
- **Anchor 0.31.1**, **Solana 3.1.0 (Agave)**.
- Use PDAs for config and per-user state.
- Favor **`require!`** with explicit error enums.
- Keep modules small and functions single-responsibility.  
- Inline comments documenting purpose, inputs/outputs, and invariants.

---

## ✅ Deliverables
- Anchor program with:
- `deposit`
- `manual_adjust`
- `withdraw_internal_balance` (**restricted to 5 wallets; Dev excluded**)
- `set_system_wallets`
- `set_hire_agent` (and optional `set_pyth_feed`)
- Public read functions listed above
- IDL + generated types.
- Full test suite passing on **devnet/localnet** with mocked Pyth.
- Clear README explaining setup, accounts, and example calls.

> **Important final check**: Ensure the **withdrawal function is callable only by the five wallets (Admin, Marketer1, Marketer2, Trader, SystemReserve)** and **each call caps at that wallet’s tracked SOL balance**. Dev **must not** pass the withdrawal guard.