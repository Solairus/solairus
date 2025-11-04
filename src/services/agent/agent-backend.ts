import { ApiClient, API_CONFIG, AGENT_ENDPOINTS } from "@/config/service-endpoints";

/**
 * Backend transaction record for agent activation.
 * Purpose: Minimal shape needed to render the user's activated agents list.
 * Inputs: Fetched via GET `/transactions?wallet=...&type=agent_activation&status=confirmed`.
 * Outputs: Used by UI to display tier, amount, and activation time.
 */
export interface BackendAgentActivation {
  id: number;
  // NOTE: amount is normalized to USDT units (decimal) by the backend
  amount: number;
  created_at: string; // ISO timestamp
  status?: string;
  activated_at?: string | null;
  metadata?: {
    tier_name?: string;
    [key: string]: unknown;
  } | null;
  // Enriched PnL fields
  total_earned?: number; // USDT decimal
  reward_cap_bp?: number; // basis points (e.g., 20000 for 200%)
  yield_cap_progress_pct?: number; // 0..capPct
  yield_cap_reached?: boolean;
}

/**
 * Fetch confirmed agent activations for a given wallet from the backend database only.
 * Purpose: Avoid slow on-chain scans and return fast, paginated results.
 * @param userAddress Wallet public key base58
 * @returns Array of BackendAgentActivation rows
 */
export async function fetchUserAgentActivations(userAddress: string): Promise<BackendAgentActivation[]> {
  const base = API_CONFIG.getBaseUrl();
  const path = AGENT_ENDPOINTS.getUserAgents.replace(":userAddress", encodeURIComponent(userAddress));
  const url = `${base}${path}`;
  const res = await ApiClient.get(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  const payload = (await res.json()) as { agents: BackendAgentActivation[] } | BackendAgentActivation[];
  const rows = Array.isArray(payload) ? payload : payload?.agents ?? [];
  return Array.isArray(rows) ? rows : [];
}