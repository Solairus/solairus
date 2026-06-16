import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SettingsService, type SettingsMap } from '@/services/settings/settings-service'

interface SettingsState {
  isLoading: boolean
  error: string | null
  settings: SettingsMap
  licenseFeeUsdtMicro: number
  licenseTermDays: number
  refresh: () => Promise<void>
}

const SettingsContext = createContext<SettingsState | undefined>(undefined)

export const SettingsContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsMap>({})
  const [licenseFeeUsdtMicro, setLicenseFeeUsdtMicro] = useState(0)
  const [licenseTermDays, setLicenseTermDays] = useState(0)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const map = await SettingsService.getSettingsMap()
      setSettings(map)
      setLicenseFeeUsdtMicro(await SettingsService.getLicenseFeeUsdtMicro())
      setLicenseTermDays(await SettingsService.getLicenseTermDays())
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load settings'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo<SettingsState>(() => ({
    isLoading,
    error,
    settings,
    licenseFeeUsdtMicro,
    licenseTermDays,
    refresh: load,
  }), [isLoading, error, settings, licenseFeeUsdtMicro, licenseTermDays, load])

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsContextProvider')
  return ctx
}