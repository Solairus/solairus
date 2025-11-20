## Problem
- `agent-config.ts:53 Uncaught ReferenceError: AgentTier is not defined` because the file (and several components) still import `AgentTier/AGENT_TIER_CONFIGS` from the removed smart‑contract module.

## Goal
- Source agent tier configs from the backend DB (`agent_tiers`), not from smart‑contract enums. Remove all `AgentTier` enum dependencies.

## Implementation Plan
1) Refactor `src/config/agent-config.ts`
- Replace imports of `AgentTier/AGENT_TIER_CONFIGS` with a backend fetcher.
- Export:
  - `type AgentTierConfig = { id:number; tier_name:string; min_amount:number; max_amount:number; daily_reward_min_bp:number; daily_reward_max_bp:number; reward_cap_bp:number }`
  - `async function fetchAgentTiers(isAdmin:boolean=false): Promise<AgentTierConfig[]>` that calls:
    - Admin: `GET /api/admin/agent-tiers`
    - User: `GET /api/agent-tiers` (alias exists), converts DB micro → units where needed, and sorts.

2) Update components/services using `AgentTier`/`AGENT_TIER_CONFIGS`
- `src/components/agent/AgentActivationModal.tsx`, `AgentDashboardDemo.tsx`, `TierSelection.tsx`, tests:
  - Remove enum imports; call `fetchAgentTiers()` and use `tier_name` and ranges instead.
  - Guard for empty list; show message if no tiers configured.
- Services referencing enum (e.g., `agent-activation-service.ts`): replace tier enum values passed to backend with `tier_name` string or `tierId` as returned.

3) Tests
- Update unit tests to mock backend response for `fetchAgentTiers()` instead of enum values.

## Safety & Scope
- No .env changes.
- Backend endpoints already exist; we added admin aliases previously.
- Changes are localized to agent config and components that render tiers.

## Result
- Runtime no longer references `AgentTier`; tiers are loaded from DB and error disappears.

If you approve, I will implement the refactor and update the affected components/services accordingly.