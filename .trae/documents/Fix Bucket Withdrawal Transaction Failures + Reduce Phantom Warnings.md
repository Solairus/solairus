## Context & Constraints
- PDAs are initialized, vault ATA is funded, USDT mint is correct; the issue appeared after recent changes.
- Backend authority signs; client only pays fees (fee payer), which is the intended model.
- We must avoid assumptions and verify cluster, preflight path, and authority.

## Root‑Cause Hypotheses To Validate
1) Cluster mismatch: frontend resolves mainnet, but server `getConnection()` may be using devnet for withdrawal init.
2) Config authority mismatch: `config.backend_authority` doesn’t equal current backend signer.
3) Preflight failing without logs: we return a tx that fails simulation, triggering Phantom’s warnings.
4) ATA create sequence or account order mismatch: instruction ordering may have regressed.

## Fix Plan (Server‑Side; Minimal, Focused)
1) Cluster Guard (mainnet‑beta)
- In admin bucket withdrawal init and shared build path:
  - Assert `getCurrentCluster()` is `mainnet-beta`; if not, use a mainnet connection via `resolveMainnetRpcUrl()`.
  - Log effective RPC URL for traceability.

2) Pre‑Simulation With Logs (sigVerify: false)
- After `buildClaimRewardsTx` and partial‑sign with backend authority:
  - Run `connection.simulateTransaction(tx, { sigVerify: false })`.
  - If `err` exists, return 400 with `{ error: 'simulation_failed', logs, message }` and avoid sending a failing tx to the client.
- This provides clear diagnostics and prevents Phantom warnings due to failed preflights.

3) Config Authority Sanity Check
- Before building:
  - Read `config` PDA; parse `backend_authority`.
  - Compare to the current backend signer public key derived from `SOLAIRUS_AUTHORITY_SECRET_BASE58`.
  - If mismatch, return 400 with a precise error.

4) Instruction Ordering & ATA Validation
- Re‑validate recipient ATA:
  - Confirm derived ATA equals provided; if missing, include create‑ATA instruction with correct key order.
  - Ensure `claim_rewards` keys are in program IDL order and consistent.

5) Frontend Error Handling (No Behavior Change)
- Display server simulation logs (if present) instead of generic temporary network error.
- Keep `signTransaction` path (fee payer adds signature) to minimize Phantom warnings.

6) Verification
- Admin bucket withdrawal:
  - Run pre‑simulation; confirm success without errors.
  - Broadcast signed tx; record signature; verify status.
- Edge cases:
  - Insufficient vault funding, wrong mint, invalid ATA → server returns descriptive error with logs.

## Phantom Warning Mitigation
- Pre‑simulation eliminates most warnings.
- Stick to single non‑fee‑payer signer (backend authority) + fee payer signature.
- Ensure transactions are small; memo length reasonable.

## Deliverables
- Server updates in admin bucket withdrawal init to enforce cluster and pre‑simulate.
- Config authority check before building.
- Enhanced error payload for frontend to surface actionable logs.

## Rollback
- Scoped to admin withdrawal init/build path; can revert easily if needed.

Please confirm to proceed; I’ll implement the server‑side pre‑sim, cluster guard, and authority check, then we’ll validate the end‑to‑end flow and reduce Phantom warnings. 