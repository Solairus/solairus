## Goal
- Ensure the app never falls back to devnet. Read `VITE_SOLANA_CLUSTER`/`SOLANA_CLUSTER` and, if absent/invalid, default to `mainnet-beta` on both frontend and backend.

## Changes (Limited, Targeted)
1) Frontend cluster resolution
- `src/utils/rpc-switcher.ts`
  - Change env default from `"devnet"` to `"mainnet-beta"` in `getCurrentCluster()`.
  - If `localStorage['solana_cluster_override']` is missing/invalid, return `"mainnet-beta"`.
- `src/contexts/wallet-context.tsx`
  - Replace all `?? "devnet"` defaults with `"mainnet-beta"` (four spots: connection init, error recovery, toggle helper, getCurrentCluster).
- `src/services/wallet/wallet-manager.ts`
  - Replace `?? "devnet"` default with `"mainnet-beta"`.
- `src/config/index.ts`
  - Set `CLUSTER` default to `"mainnet-beta"`.

2) Backend cluster resolution
- `server/lib/rpc-manager.ts`
  - Set `SOLANA_CLUSTER` default to `"mainnet-beta"`.
  - When cluster is invalid, normalize to `"mainnet-beta"`.
  - Keep transaction routes forced to mainnet-beta (already using `resolveMainnetRpcUrl()`).

## Verification
- Restart frontend and backend; open `/dapp`, `/admin`.
- Confirm all RPC connections and USDT mint selection resolve to `mainnet-beta` when env is set or missing.
- Toggle buttons/overrides still work, but if override is missing/invalid, cluster remains `mainnet-beta`.

## Safety
- Small, localized changes; no APIs or route shapes altered.
- Scripts (seed, authority) remain unchanged for now; operational flows still explicitly set cluster.

## Deliverables
- Code diffs in the five files listed. No push until you request after local verification.