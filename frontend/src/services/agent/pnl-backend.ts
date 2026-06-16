import type { WithdrawalLimitDisplay } from '@/services/agent/withdrawal-limit-service';
import { ApiClient, AGENT_ENDPOINTS, API_CONFIG } from '@/config/service-endpoints';

/**
 * fetchGlobalPnlSummary
 * Purpose: Retrieve backend-computed PnL summary for the authenticated user.
 * Output: WithdrawalLimitDisplay-compatible object ready for UI.
 */
export async function fetchGlobalPnlSummary(): Promise<WithdrawalLimitDisplay> {
  const base = API_CONFIG.getBaseUrl();
  const url = `${base}${AGENT_ENDPOINTS.getPnlSummary}`;
  const res = await ApiClient.get(url);
  const data = await res.json();
  // Trust backend fields; enforce minimal shape
  return {
    totalDeposits: String(data.totalDeposits ?? '0.00'),
    totalWithdrawn: String(data.totalWithdrawn ?? '0.00'),
    maxWithdrawable: String(data.maxWithdrawable ?? '0.00'),
    remainingWithdrawable: String(data.remainingWithdrawable ?? '0.00'),
    unclaimedAgentResults: String(data.unclaimedAgentResults ?? '0.00'),
    usagePercentage: Number(data.usagePercentage ?? 0),
    limitReached: Boolean(data.limitReached ?? false),
    isPrivileged: Boolean(data.isPrivileged ?? false),
    warningLevel: (data.warningLevel as WithdrawalLimitDisplay['warningLevel']) ?? 'none',
    statusMessage: String(data.statusMessage ?? ''),
  };
}
