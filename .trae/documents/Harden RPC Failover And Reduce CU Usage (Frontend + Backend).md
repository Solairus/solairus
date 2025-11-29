## Understanding

* Keep mainnet-beta forced.

* Do NOT run an operation and then retry; instead, preflight-select the first working RPC and execute once.

* Check endpoints sequentially (not all at once). If an endpoint returns 402/429/timeout, immediately try the next; use the first that passes a light probe.

## Backend Changes

1. Add `getWorkingConnection()` in `server/lib/rpc-manager.ts`:

   * Iterate endpoints in order; for each do `getVersion()` with an 800–1200ms timeout (Promise.race).

   * Treat 402/429/“payment required”/“out of cu”/timeout/network as failure; move to next.

   * Cache the selected endpoint for 60s (TTL) to avoid probing on every call.

   * Expose `getConnection()` to delegate to `getWorkingConnection()`; deprecate `retryOperation()` for normal paths.
2. Update internal index and add per-endpoint cooldown (e.g., 2–5 minutes) after 402/429 so we don’t immediately re-choose a throttled endpoint.
3. Replace health ping usage with `getVersion()` (low CU) in `/rpc/health` and `pingAllRpcEndpoints()`.

## Frontend Changes

1. Update `src/utils/rpc-switcher.ts`:

   * Implement `getWorkingConnection(cluster)` mirroring backend behavior (sequential `getVersion()` probe, 800–1200ms timeout, 402/429 handling, 60s cache TTL, per-endpoint cooldown).

   * Make `getHealthyRpcConnection()` call the new `getWorkingConnection()`.

   * Keep `switchRpcEndpoint()` simple: move to next endpoint and run the same probe before returning.
2. Use `getHealthyRpcConnection()` everywhere connections are created (wallet-context, tx helpers). Remove ad‑hoc retry logic; rely on preflight selection.

## Error Handling

* Classify 402/“payment required”/“out of cu”, 429, 401/403, timeouts, 5xx, DNS/network as probe failures.

* Log minimal info; no user-facing toast unless all endpoints fail.

## Configuration

* No cluster changes; ensure multiple mainnet endpoints are present in env (`SOLANA_RPC_URL_MAINNET[_2..5]`, `VITE_SOLANA_RPC_URL_MAINNET[_2..5]`).

* Keep current ordering; first working endpoint wins.

## Validation

* Simulate a failing first RPC (return 402) and verify the app instantly selects the next one without showing errors.

* Confirm reduced CU consumption (no `getLatestBlockhash` in probes; only `getVersion`).

* Verify health widget shows statuses without hammering endpoints.

## Deliverables

* Backend: new preflight selector with TTL + cooldown, lightweight health probes; updated health route.

* Frontend: matching preflight selector; wallet-context and tx paths use it.

* No retry loops; single execution on a preflight‑selected working RPC.

