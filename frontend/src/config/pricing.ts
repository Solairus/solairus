/**
 * Pricing Configuration
 *
 * Centralized pricing and fee configuration loaded from environment variables.
 * All amounts are in USDT.
 */

export const PRICING_CONFIG = {
  // License activation fee (micro-USDT)
  licenseFeeUsd: import.meta.env.VITE_LICENSE_FEE
    ? parseInt(import.meta.env.VITE_LICENSE_FEE as string, 10)
    : 50,

  // Minimum investment per agent (micro-USDT)
  agentMinimumUsd: import.meta.env.VITE_AGENT_MINIMUM
    ? parseInt(import.meta.env.VITE_AGENT_MINIMUM as string, 10)
    : 25,

  // Withdrawal fee (percentage, 0 = free)
  withdrawalFeePercent: 0,
} as const;

/**
 * Format price as USDT string
 */
export function formatUsdtPrice(usdAmount: number): string {
  return `$${usdAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} USDT`;
}

/**
 * Get recommended starting balance
 * (license + first agent)
 */
export function getRecommendedStartingBalance(): number {
  return PRICING_CONFIG.licenseFeeUsd + PRICING_CONFIG.agentMinimumUsd;
}
