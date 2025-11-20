## Diagnosis (Verified)
- Program ID fallbacks found in backend code that can mis-derive PDAs, causing vault ATA to be unfunded or config authority to mismatch:
  - server/services/withdrawals.ts:25 → hardcoded fallback '5eRuz…W6ek'
  - server/services/withdrawal_refund.ts:57 → fallback '5eRuz…W6ek'
  - server/services/bucket_withdrawal_refund.ts:29 → fallback '5eRuz…W6ek'
  - server/routes/admin.ts:366, 474 → fallback '5eRuz…W6ek'
  - server/routes/withdrawals.ts:53 → fallback '5eRuz…W6ek'
- Scripts default another program id 'EeyQpZx…' and devnet RPC; not critical if not used in prod, but confirms divergence.
- Contract declare_id! is mainnet `CMvEEAX…`; IDL also uses `CMvEEAX…`. UI env already points to `CMvEEAX…` and mainnet-beta.

## Fix Plan (No .env edits)
1) Remove backend hardcoded program ID fallbacks
- In the files listed, replace `process.env.SOLAIRUS_PAY_PROGRAM_ID || '…fallback…'` with a strict source:
  - Preferred: `process.env.SOLAIRUS_PAY_PROGRAM_ID`
  - Fallback only to `server/idl/solairus_pay.json.address` (which is `CMvEEAX…`), never to an unrelated constant.
- Ensure all PDA derivations and instruction programId use the same resolved program ID.

2) Align connection to mainnet
- Update `server/lib/rpc-manager.ts` so `getConnection()` selects mainnet endpoints when cluster is mainnet-beta or when mainnet URLs exist; avoid devnet default when SOLANA_CLUSTER is unset by preferring MAINNET URLs if present.

3) Preflight checks in init endpoints
- `POST /withdrawals/init` (affiliate) and `POST /admin/buckets/:bucketType/withdraw/init`:
  - Derive `config` PDA under `CMvEEAX…`; fetch it and assert `backend_authority == signer pubkey` from `SOLAIRUS_AUTHORITY_SECRET_BASE58`. If mismatch/uninitialized → 400 with precise message.
  - Derive `vault_authority` PDA `["vault", USDT mint]` and `vault_ata`; fetch its token balance; if `< amountMicro` → 400 "Vault underfunded" and do NOT debit off-chain.
  - Keep recipient ATA pre-instruction create (already implemented) to satisfy contract `init_if_needed`.

4) Safe debit timing
- Defer off-chain debit until backend verifies the on-chain signature and token delta; avoids user-visible balance reduction when on-chain fails.
- If we keep pessimistic debit at init short-term, add immediate revert on simulation failure (return logs) instead of waiting for TTL.

5) Better error logs
- Wrap broadcaster error and return `SendTransactionError.getLogs()` to the UI for actionable diagnosis (e.g., token program messages).

## Verification Steps
- Read `config` PDA and confirm backend authority matches signer.
- Read `vault_ata` balance under `CMvEEAX…` + `Es9v…` mint; confirm ≥ requested amount.
- Run affiliate and bucket withdrawals: init → sign → backend verify → off-chain debit → finalization; ensure no 400/404 and that balances only change after successful on-chain.

## Deliverables
- Code updates in the listed backend files to remove fallbacks, add preflight checks, adjust debit timing, and improve logs.
- No change to your .env values.

If you approve, I will implement these changes immediately and retest the flows on mainnet with `CMvEEAX…`. 