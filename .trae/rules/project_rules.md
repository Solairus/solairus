### ⚙️ TREA — Project-Specific Rules (SOLAIRUS: Solana DeFi DApp + UI)

These rules apply **exclusively** to the SOLAIRUS project (Solana DeFi Yield DApp with AI-powered rewards).  
They extend the global rules and are **strictly enforced** to maintain scope, quality, and operational discipline.

---

#### 🧱 Project Context
1. **Project Overview**
   - **Objective:** Build a DeFi yield protocol on **Solana** that pays **1–5% daily USDT rewards**, capped at 200%.
   - **Ecosystem Components:**
     - **Smart Contract:** Solana program using **Anchor (Rust)**.
     - **Frontend:** React / Next.js with **TailwindCSS**, **Glassmorphism UI**, and **Wallet Adapter** integration.
     - **Backend Logic:** Anchor client scripts in **TypeScript** for initialization, funding, deposits, and claims.
   - **Blockchain:** Solana **Devnet** (for testing), **Mainnet** (for production).

2. **Installed Tools (Do NOT reinstall)**
   - ✅ `solana` CLI  
   - ✅ `anchor` (via `avm`)  
   - ✅ `rustup` (stable toolchain)  
   - ✅ `node`, `yarn`  
   - ✅ `spl-token`  
   🔸 *Always verify with `--version` before use. If missing, notify me first.*

---

#### 🛑 Scope & Discipline
3. **Absolute Scope Rule**
   - ❗ **Never step outside the scope** of the current task.
   - Only work on:
     - Files explicitly mentioned in the task
     - Logic directly required by the described feature
   - Do **not** modify unrelated modules, styles, or logic.
   - If a change seems necessary in another file → **ask first**.

4. **Task Confirmation**
   - Before starting:
     - Restate the task in your own words
     - List files and components to be touched
     - Wait for confirmation if anything is unclear

5. **Assumptions Forbidden**
   - Never assume missing logic, dependencies, or structure.
   - Always **inspect existing code** or **ask for clarification** before acting.

6. **Folder Structure**
   - Our workspace has multiple folders each dedicated for a different part of the project:
     - /Users/nouvic/Desktop/Projects/solairus/solairus-contract referred to as `solairus-contract` — Smart contract code (Anchor, Rust)
     - /Users/nouvic/Desktop/Projects/solairus referred to as `solairus-ui` — Frontend code (React, Next.js, TailwindCSS)
     
     please ensure that you are working in the correct folder for the task.
     If you are unsure, ask for clarification.

---

#### 🔐 Solana-Specific Rules
6. **Network Usage**
   - Default to **Devnet** for all testing and deployment.
   - Confirm **RPC URL** with `solana config get` before running commands.
   - Never deploy to **Mainnet** without explicit instruction.

7. **Program Management**
   - When creating a new program:
     - Use `anchor init <project>`
     - Always set `declare_id!()` to the **program address** after first build
     - Update `Anchor.toml` accordingly
   - Never change program ID without approval.

8. **Keypairs & Wallets**
   - Use the default keypair: `~/.config/solana/id.json`
   - Never overwrite without using `--force` and **explicit authorization**
   - Keep private keys confidential — never print or commit

9. **Deployment Workflow**
   - Always run `anchor build` before `anchor deploy`
   - After deployment:
     - Confirm program address
     - Verify deployment on **Solana Explorer**
   - Do **not** redeploy unless instructed (to avoid overwriting program states)

10. **Token Management**
    - Use `spl-token` to create and mint tokens
    - Always record:
      - **Mint addresses**
      - **Vault accounts**
      - **Authority keys**
    - Never mint or burn without explicit task instruction

11. **Anchor Testing**
    - Use `anchor test` after each logic update
    - Include `console.log` or `msg!()` for clarity in outputs
    - Ensure tests run **cleanly** before reporting success

12. **Smart Contract Guidelines**
    - Follow **Rust best practices**:
      - Modularize code into clear instructions
      - Validate inputs before processing
      - Use `require!` or `assert!` macros for safety
    - Never hardcode addresses — use context accounts
    - Add **comments** above each instruction & account struct

13. **Error Handling**
    - Use clear error enums (e.g., `#[error_code]`)
    - Document error meanings in comments

---

#### 🧠 Frontend & Integration Rules
14. **Wallet Integration**
    - Use `@solana/wallet-adapter` for wallet connection
    - Support **Phantom** and **Solflare**
    - Display connected wallet address clearly
    - Handle wallet disconnection gracefully

15. **Smart Contract Calls**
    - Use **Anchor Client (TypeScript)** for on-chain interactions
    - Always verify:
      - Connection: `new anchor.web3.Connection(clusterApiUrl("devnet"))`
      - Provider: correct wallet and program ID
    - Never call unverified instructions

16. **UI Design**
    - Dark, futuristic, glassmorphic theme
    - Consistent spacing, typography, and gradient style
    - Components must be reusable and modular (Card, Button, Modal)
    - Always comment component logic

17. **Simulation Layer (Visuals Only)**
    - Trading animations (BTC/ETH/SOL/BNB pairs) are **simulated** only
    - Must not connect to real trading APIs
    - Mark as “simulation” in code comments

---

#### 💾 Git & Workflow
18. **Commit / Push Control**
    - ❌ Never commit or push without explicit instruction: “commit and push” or “push”
    - When authorized:
      - `git add -A`
      - Confirm directory (`pwd`)
      - Use descriptive commit message

19. **Branching**
    - Stay on assigned branch
    - Never merge or rebase without instruction

---

#### 📄 Documentation
20. **Mandatory Code Comments**
    - Every function/module must include:
      - Purpose
      - Inputs / outputs
      - Core logic explanation
    - Comment major constants (program IDs, mints, etc.)

21. **Readme / Docs**
    - Keep `README.md` updated with:
      - Deployment steps
      - Mint addresses
      - Key commands

---

#### 🧪 Validation
22. **Pre-Submission Checks**
    - ✅ `anchor build`
    - ✅ `anchor test`
    - ✅ `solana balance`
    - ✅ `yarn dev` (UI boots without errors)
    - ✅ Console logs clean

23. **No Breaking Changes**
    - Validate after every code edit
    - Ensure all existing functionality works as before

---

#### 💬 Communication
24. **Ask Before Acting**
    - If any step is unclear or impacts multiple files → ask before acting
    - No silent decisions or hidden assumptions

25. **Report Clearly**
    - After each task:
      - List modified files
      - Describe what changed
      - Include test results or screenshots

---

# 🚀 Solairus DApp — Technical Setup Summary & Project Rules

## ✅ Current Status
We have successfully:
- Installed and configured **Rust**, **Anchor**, and **Solana (Agave)**.
- Built and **deployed a test program** to **localnet** using Anchor.
- Verified that `solana-test-validator` runs correctly.
- Confirmed program deployment and account visibility.
- Generated all build artifacts (`.so`, `.json`, IDL).
- Everything is now ready for **frontend UI integration**.

---

## 🧱 Environment Configuration

| Tool | Version |
|------|----------|
| **OS** | macOS (M1 / ARM64) |
| **Rust** | `1.75.0-aarch64-apple-darwin` |
| **Cargo** | Installed via rustup |
| **Anchor CLI** | `0.31.1` |
| **Solana CLI (Agave)** | `3.1.0` |
| **Node.js** | `v24.x` |
| **Yarn** | Used as package manager |
| **NPM** | 11.x (secondary) |
| **Angular CLI** | 20.x (optional global) |

---

## 🗂️ Project Directory

```bash
/Users/nouvic/Desktop/Projects/solairus/solairus-dapp
├── Anchor.toml
├── programs/
│   └── solairus-dapp/
│       ├── Cargo.toml
│       └── src/lib.rs
├── target/
│   └── deploy/
│       ├── solairus_dapp.so
│       └── solairus_dapp-keypair.json
└── tests/

```

#### 🔟 Core Engineering & Product Principles (Additions)

1. **DevOps culture & approach**
   - Treat automation as default: CI/CD (build, test, lint, type-check), preview deployments, reproducible environments, observability, rollback plans.

2. **Granular code & separation of concerns**
   - Each module/component does exactly one job.
   - Keep files short and focused; extract helpers/hooks/utils early.

3. **Modular & reusable architecture**
   - Prefer composable primitives and shared libraries over duplication.
   - Eliminate redundant code and avoid unnecessary abstractions/overhead.

4. **Simplicity first**
   - Choose the simplest viable solution that meets requirements.
   - Avoid cleverness or premature generalization.

5. **Consistency**
   - Uniform patterns for naming, folder structure, error handling, logging, styling, and tests across the stack.

6. **(Reserved)**

7. **Single source of truths**
   - Centralize config and state; never fork logic across layers.
   - Derive all views from the canonical state to prevent drift.

8. **Intuitive UI**
   - Clear information hierarchy, obvious flows, forgiving errors.
   - Predictable interactions and accessible defaults.

9. **Mobile App-like UI (not just responsive)**
   - 95% of users are on mobile: typography, spacing, hit targets, cards, badges, buttons must feel native to mobile usage.
   - Touch-friendly interactions, safe-area awareness, minimal chrome.

10. **/dapp renders as a Mobile View on all viewports (important)**
    - The **/dapp** page always renders inside a **portrait, mobile-sized container** (e.g., ~390–430 px width), full height, centered on larger screens.
    - Include a **bottom tab bar**, **mobile action buttons/FAB**, and an app-shell (header → content → bottom nav).
    - **Do not** stretch to desktop widths; desktop simply shows the mobile container centered (surroundings are background only).
    - This is **not** a decorative phone frame — it’s a real app-shell constrained to mobile dimensions for every viewport.
    

#### 🎯 Mission
TREA must:
- 🧭 Stay **strictly within task scope**
- 🚫 Never assume — always verify
- 🔐 Follow **Solana & Anchor** best practices
- 🧾 Document every function and logic block
- 🧱 Maintain clean build, consistent style, and non-breaking behavior
- 🧠 Leverage existing tools — never reinstall unless approved
- 🧪 Test thoroughly before completion