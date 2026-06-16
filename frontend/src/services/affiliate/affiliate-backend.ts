import { ApiClient, API_CONFIG } from '@/config/service-endpoints'

export interface AffiliateSummary {
  bonus_balance_micro: string
  total_earnings_affiliate_micro: string
  total_withdrawn_micro: string
  available_to_withdraw_micro: string
  per_level_micro: Record<string, string>
}

/**
 * AffiliateBackendService
 * Purpose: Fetch affiliate earnings summary from backend DB (no smart contract calls)
 * Methods:
 * - getSummary: Returns current bonus balance, totals, and per-level breakdown
 * Notes:
 * - Requires JWT; ApiClient adds Authorization automatically
 */
export class AffiliateBackendService {
  /** Get affiliate summary for current user (identified by JWT) */
  static async getSummary(): Promise<AffiliateSummary> {
    const url = `${API_CONFIG.getBaseUrl()}/affiliate/summary`
    const res = await ApiClient.get(url)
    return res.json()
  }

  /** Get direct referrals (pubkeys) for the current user */
  static async getReferrals(): Promise<string[]> {
    const url = `${API_CONFIG.getBaseUrl()}/affiliate/referrals`
    const res = await ApiClient.get(url)
    const data = await res.json()
    return Array.isArray(data.referrals) ? data.referrals : []
  }
}