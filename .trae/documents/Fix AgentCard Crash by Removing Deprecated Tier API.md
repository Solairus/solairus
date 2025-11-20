## Issue
AgentCard imports `getTierStyling` from `src/config/agent-config.ts`. That function references `EXTENDED_AGENT_TIER_CONFIGS` and `AgentTier`, which do not exist. This throws at render and crashes `/dapp/my-agents`.

## Fix
- Update `src/config/agent-config.ts` to use the existing `EXTENDED_AGENT_TIER_METADATA` array and string tier names.
  - Change `getTierStyling(tier: string)` to: find matching config by `name` (case-insensitive) and return `styling`; fallback to NOVA.
  - Remove dead helpers that reference `AgentTier` / `EXTENDED_AGENT_TIER_CONFIGS`.
- No API or backend changes; only UI config helpers.
- AgentCard already passes `agent.tier` (string); no component changes required.

## Files to Edit
- `src/config/agent-config.ts`:
  - Replace `getTierStyling` implementation and signature.
  - Remove `getExtendedTierConfig(tier: AgentTier)` or rewrite to string-based if still needed.
  - Ensure `isValidTier` uses `EXTENDED_AGENT_TIER_METADATA` names.

## Verification
- Build UI and load `/dapp/my-agents`.
- Agent cards render with gradients/borders; no runtime errors.
- Withdrawal button and timers still work since only styling helper changed.

## Safety
- Pure frontend refactor; no on-chain or backend ops.
- No secrets or environment changes.