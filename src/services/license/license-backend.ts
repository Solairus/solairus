import { ApiClient, API_CONFIG } from '@/config/service-endpoints'

export type BackendLicenseStatus = 'none' | 'active' | 'expired' | 'revoked'

export interface BackendLicenseInfo {
  user_address: string
  license_status: BackendLicenseStatus
  license_expiration: string | null
  cost_usdt_micro: number
  term_days: number
}

/**
 * LicenseBackendService
 * Purpose: Fetch license info and perform activation via backend DB (no smart contract calls)
 * Methods:
 * - getInfo: Returns current license status, expiration, and configured cost/term
 * - activate: Activates license in DB and returns updated status/expiration
 * Notes:
 * - Requires JWT; ApiClient adds Authorization automatically
 */
export class LicenseBackendService {
  /**
   * Get license info for current user
   * Inputs: none (JWT identifies user)
   * Outputs: BackendLicenseInfo from /api/license/info
   */
  static async getInfo(): Promise<BackendLicenseInfo> {
    const url = `${API_CONFIG.getBaseUrl()}/license/info`
    const res = await ApiClient.get(url)
    return res.json()
  }

  /**
   * Activate license for current user
   * Inputs: transaction reference payload (signature or transaction_id)
   * Outputs: { license_status, license_expiration, term_days }
   */
  static async activate(body?: { transaction_id?: number; signature?: string }): Promise<{ ok: boolean; license_status: BackendLicenseStatus; license_expiration: string; term_days: number }> {
    const url = `${API_CONFIG.getBaseUrl()}/license/activate`
    const res = await ApiClient.post(url, body ?? {})
    return res.json()
  }
}