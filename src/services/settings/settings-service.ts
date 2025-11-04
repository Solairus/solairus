import { ApiClient, API_CONFIG } from '@/config/service-endpoints'

export interface SettingRow {
  key: string
  value: unknown
  type: string
}

export type SettingsMap = Record<string, unknown>

/**
 * SettingsService retrieves admin-managed settings from the backend
 */
export class SettingsService {
  /** Fetch raw settings array */
  static async fetchSettings(): Promise<SettingRow[]> {
    const base = API_CONFIG.getBaseUrl()
    const res = await ApiClient.get(`${base}/settings`)
    return res.json()
  }

  /** Fetch settings mapped by key */
  static async getSettingsMap(): Promise<SettingsMap> {
    const rows = await SettingsService.fetchSettings()
    const map: SettingsMap = {}
    for (const row of rows) {
      map[row.key] = row.value
    }
    return map
  }

  /** Get license fee in micro-USDT (6 decimals) */
  static async getLicenseFeeUsdtMicro(): Promise<number> {
    const map = await SettingsService.getSettingsMap()
    const val = map['license.fee_usdt']
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const parsed = Number(val)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  /** Get license term in days */
  static async getLicenseTermDays(): Promise<number> {
    const map = await SettingsService.getSettingsMap()
    const val = map['license.term_days']
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const parsed = Number(val)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }
}