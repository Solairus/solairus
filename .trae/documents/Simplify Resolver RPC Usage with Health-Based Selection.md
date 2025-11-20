## Summary
For refunds and activations, we will use a single healthy RPC endpoint per check. Only if that endpoint is unhealthy (429/timeout/forbidden) we will switch once to the next. No multi-RPC cycling when the current endpoint is healthy.

## Changes
- Backend RPC Health Selection
  - Implement `getHealthyRpcUrl()` that probes endpoints (getLatestBlockhash) and caches health for 5 minutes.
  - Resolver uses one `Connection` from `getHealthyRpcUrl()` for:
    - Reference signature lookup by orderId
    - Signature status checks
  - Fallback: on 429/timeout/forbidden, switch once to the next endpoint and retry the single call.
  - Limit attempts to 2 per lookup (current + one fallback), no aggressive retries.

- Keep-Alive Job
  - Add a daily task that pings all configured RPC URLs once to prevent endpoint deletion due to inactivity.
  - Minimal logs; no impact on application flow.

- Frontend Rotation (Consistency)
  - Time-based rotation every 30–60 minutes via local storage index; per-error fallback switches once.
  - No WebSockets; `confirmAndRecord` remains REST-only polling.

## Refund Logic (No Over-Checks)
- For refund resolver, perform one lookup on the healthy RPC:
  - Reference lookup by orderId → if found and deltas match, mark confirmed; else proceed to refund.
  - Do not check across all endpoints when healthy; only switch once on explicit error.

## Validation
- Run the refund test script:
  - Show per-record line: resolver HTTP status, updated status, resolver_action, resolver_reason, refund_finalized.
  - Confirm no repeated retries and that refunds/confirmations complete using a single healthy RPC.

## Safety
- No behavior change for business logic; just RPC selection and retry limits.
- Endpoints remain active via daily keep-alives; rotation distributes usage over time.

If approved, I will implement the health-based RPC selection, adjust the resolver retry logic, add the keep-alive job, and verify with the refund test script.