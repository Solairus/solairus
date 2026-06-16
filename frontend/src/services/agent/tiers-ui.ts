export type TierName = 'NOVA' | 'VEGA' | 'ORION' | 'PRIME' | string

export interface TierStyling {
  gradient: string
  border: string
  accent: string
}

const STYLES: Record<string, TierStyling> = {
  NOVA: {
    gradient: 'from-cyan-500/20 via-cyan-400/15 to-cyan-600/10',
    border: 'border-cyan-500/40',
    accent: 'text-cyan-400',
  },
  VEGA: {
    gradient: 'from-emerald-500/20 via-emerald-400/15 to-emerald-600/10',
    border: 'border-emerald-500/40',
    accent: 'text-emerald-400',
  },
  ORION: {
    gradient: 'from-indigo-500/20 via-indigo-400/15 to-indigo-600/10',
    border: 'border-indigo-500/40',
    accent: 'text-indigo-400',
  },
  PRIME: {
    gradient: 'from-amber-500/20 via-amber-400/15 to-amber-600/10',
    border: 'border-amber-500/40',
    accent: 'text-amber-400',
  },
}

export function getTierStyling(tierName: TierName): TierStyling {
  const key = String(tierName).toUpperCase()
  return STYLES[key] ?? STYLES.NOVA
}