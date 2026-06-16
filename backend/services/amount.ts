/**
 * Amount utils: convert between decimal strings and micro bigint with fixed decimals.
 */

export function toMicroBigInt(amount: string | number, decimals = 6): bigint {
  const d = Number.isInteger(decimals) ? decimals : 6
  if (typeof amount === 'number') {
    const negative = amount < 0
    const abs = Math.abs(amount)
    const scaled = Math.floor(abs * Math.pow(10, d))
    const bi = BigInt(scaled)
    return negative ? -bi : bi
  }
  const s = String(amount).trim()
  if (!s) return 0n
  const negative = s.startsWith('-')
  const clean = negative ? s.slice(1) : s
  const parts = clean.split('.')
  const intPart = parts[0].replace(/\D/g, '') || '0'
  let fracPart = (parts[1] || '').replace(/\D/g, '')
  if (fracPart.length > d) {
    fracPart = fracPart.slice(0, d)
  }
  while (fracPart.length < d) fracPart += '0'
  const scale = BigInt(10) ** BigInt(d)
  const bi = BigInt(intPart || '0') * scale + BigInt(fracPart || '0')
  return negative ? -bi : bi
}

export function microBigIntToDecimalString(micro: bigint, decimals = 6): string {
  const d = Number.isInteger(decimals) ? decimals : 6
  const negative = micro < 0n
  const abs = negative ? -micro : micro
  const s = abs.toString()
  if (d === 0) return (negative ? '-' : '') + s
  const pad = d - s.length
  if (pad >= 0) {
    const frac = '0'.repeat(pad) + s
    const out = `0.${frac}`
    return negative ? `-${out}` : out
  }
  const splitAt = s.length - d
  const intPart = s.slice(0, splitAt)
  const fracPart = s.slice(splitAt)
  const out = `${intPart}.${fracPart}`
  return negative ? `-${out}` : out
}