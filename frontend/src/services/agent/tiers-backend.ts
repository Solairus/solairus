import { ApiClient, AGENT_ENDPOINTS } from '@/config/service-endpoints'

/**
 * Agent Tier Row from backend
 * Values:
 * - `min_amount` and `max_amount` are in micro-USDT (6 decimals)
 * - reward rates and caps are in basis points (1% = 100 bp)
 */
export interface AgentTierRow {
  tier_name: 'NOVA' | 'VEGA' | 'ORION' | 'PRIME' | string
  min_amount: number
  max_amount: number
  daily_reward_min_bp: number
  daily_reward_max_bp: number
  reward_cap_bp: number
}

/** Fetch all agent tiers from backend (public endpoint) */
export async function fetchAgentTiers(): Promise<AgentTierRow[]> {
  const url = AGENT_ENDPOINTS.buildUrl(AGENT_ENDPOINTS.getTierConfigurations)
  const res = await ApiClient.get(url)
  return res.json()
}

/** Map tiers by name for easy lookup */
export async function getAgentTiersMap(): Promise<Record<string, AgentTierRow>> {
  const rows = await fetchAgentTiers()
  const map: Record<string, AgentTierRow> = {}
  for (const row of rows) {
    map[row.tier_name] = row
  }
  return map
}

/** Helpers to format backend values for UI */
export function formatDailyRange(minBp: number, maxBp: number): string {
  const minPct = (minBp / 100).toFixed(2)
  const maxPct = (maxBp / 100).toFixed(2)
  return `${minPct}% - ${maxPct}%`
}

export function microToUsdt(micro: number): number {
  return Math.floor(micro) / 1_000_000
}