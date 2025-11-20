## Contract Expectations (solairus_pay)
- Instruction: `claim_rewards(recipient, mint, amount, decimals, memo)`
- Authority: must be the backend authority signer stored in `Config.backend_authority` (PDA `seeds=["config"]`)
- Vault: PDA `seeds=["vault", mint]` signs transfer from `vault_ata` to `recipient_ata`
- Accounts order: `authority (signer)`, `recipient`, `mint`, `vault_authority (PDA)`, `vault_ata`, `recipient_ata`, `reference`, `config (PDA)`, `token_program`, `associated_token_program`, `system_program`
- Validations: `amount > 0`, memo length ≤ 128, `mint` equals account mint, `recipient` equals passed recipient, and `authority == config.backend_authority`

## Current Builder & Payload Check
- Backend builder constructs `claim_rewards` with correct discriminator and args
- Signs transaction partially with backend authority from `.env` via `SOLAIRUS_AUTHORITY_SECRET_BASE58`
- Fee-payer is the initiator (admin wallet), front-end signs to add fee-payer signature
- Validations enforced: recipient ATA derivation and owner/mint match; vault funding preflight
- Likely failure: on-chain `config.backend_authority` does not equal authority public key loaded from `.env`; `Unauthorized` causes simulation failure

## Diagnostics & Logging Additions
### Server (admin bucket withdraw init)
- Log: program ID, backend authority public key, resolved `config` PDA, on-chain `backend_authority` (read and compare), vault authority and ATA, preflight vault balance, recipient ATA derivation/match, amountMicro
- On builder failure: run a server-side `simulateTransaction` and include `logMessages` in JSON error payload (no secrets)
- Mark transaction metadata with rich phases: `built`, `signature_recorded`, `verifying`, `verification_failed`, and include failureReason/logs

### Frontend (bucket-service + BucketCard)
- Pre-broadcast: log bucket type normalization, mint address, derived recipient ATA, amountMicro
- Broadcast: log signature, and each confirmation poll step; after confirmation, `POST /transactions/record/signature` and poll `/transactions/:orderId` until finalized
- On failure: if RPC error includes logs, surface them in toast via admin error handler; add a dedicated console group for the withdrawal flow

## Authority & Config Alignment Steps
- Verify: decode `SOLAIRUS_AUTHORITY_SECRET_BASE58` → `pubkeyA`
- Read on-chain `config` PDA (`seeds=["config"]`) → `backend_authority` → `pubkeyB`
- If `pubkeyA != pubkeyB`, initialize config on devnet using provided script (`server/scripts/set-backend-authority.js`) or a manual `initialize_config` tx signed by a payer; document exact command to run
- Confirm the on-chain backend authority matches `.env` and restart backend

## Implementation Plan
1) Server: add rich logs and return `logMessages` on error
2) Server: read and log on-chain `backend_authority` vs env authority on init
3) Frontend: add structured logs across the bucket withdrawal lifecycle (pre, broadcast, confirm, record, poll)
4) Frontend: keep confirmation parity identical to license/agent (already implemented, extend logs)
5) Verification: run a devnet test with small amount; observe success path; force failure (wrong mint) to confirm logs and backend status reflect errors precisely

## Verification Steps
- Check server console for alignment: `programId`, `envAuthority`, `onChainAuthority`, PDAs, balances
- Successful withdrawal: signature confirmed; `/transactions/:orderId` shows `confirmed`; UI success toast with signature
- Error case: server returns `logMessages` with seed/authority/mint mismatch; UI shows detailed reason; backend marks `failed` with `failureReason`

## Safety & Scope
- No changes to program logic; only server/frontend logs and authority alignment
- No secrets printed to console; only public keys and logs
- Strictly devnet by default; no mainnet ops

Approve to implement logs and authority/config alignment; then I’ll verify with a test run and share signatures and logs.