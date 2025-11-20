## Diagnosis
- Current backend uses a single `Connection` from `server/lib/rpc-manager.ts` and doesn’t rotate endpoints per request.
- Logs confirm repeated "Using Mainnet RPC 1", even when 429 rate-limit messages appear.
- This causes reference/signature lookups to fail intermittently, blocking resolver refunds.

## Plan
1) Add rotation in RPC manager
- Extend `rpc-manager` with `getConnectionFor(index)` and `nextConnection()` that cycles through the configured endpoints (1..5).
- Implement `withRpcRetry(fn)` wrapper that:
  - Runs `fn(connection)`
  - On 429, timeout, ECONNRESET, or "Too Many Requests": switch to next endpoint and retry up to N endpoints.
  - Adds small backoff (e.g., 250–500ms) between switches.

2) Use rotation in resolver and signature helpers
- In `transactions/pending/resolve` route:
  - Use `withRpcRetry` for:
    - `getSignatureStatuses([...])` (batch) and loops
    - `findSignatureByReference(reference)` calls
  - Cap per-call processing to ≤10 pending records to reduce load.
- In `server/services/withdrawals.ts` and `withdrawal_verifier.ts`:
  - Wrap reference and signature lookups with `withRpcRetry` for robustness.

3) Observability
- Log endpoint index and RPC URL when rotation occurs (single debug line per switch).
- Keep resolver silent for the frontend (HTTP 200), but annotate `metadata.resolver_reason` on each record when a refund attempt fails due to RPC errors (e.g., `rpc_rate_limited`, `rpc_timeout`).

4) Safety & Limits
- Max endpoints to try: number of configured URLs (up to 5). Stop early on success.
- No WebSockets; keep REST-only RPC calls.

## Frontend
- No changes required; WalletContext already triggers `/api/transactions/pending/resolve` once per connect.

## Verification
- Trigger resolver with a wallet having multiple expired pendings.
- Expect rotation log lines and successful reference/confirmation or refund application, reducing `pending_after` count.
- Confirm audit rows are written and `refund_finalized=true` set.

If approved, I’ll implement rotation in the backend manager, wrap resolver lookups with retries, limit batch size, and annotate per-record outcomes for precise diagnostics.