import { describe, it, expect } from 'vitest'
import { microBigIntToDecimalString } from '../amount'

describe('role_withdrawal refund unit conversion', () => {
  it('converts micro to unit decimal correctly (basic)', () => {
    const micro = BigInt(1_234_567)
    const usdt = microBigIntToDecimalString(micro, 6)
    expect(usdt).toBe('1.234567')
  })

  it('handles zero values', () => {
    const micro = BigInt(0)
    const usdt = microBigIntToDecimalString(micro, 6)
    expect(usdt).toBe('0.000000')
  })

  it('handles large values without precision loss', () => {
    const micro = BigInt('1000000000000') // 1,000,000 USDT
    const usdt = microBigIntToDecimalString(micro, 6)
    expect(usdt).toBe('1000000.000000')
  })
})