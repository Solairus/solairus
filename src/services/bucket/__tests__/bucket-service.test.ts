import { describe, it, expect } from 'vitest';
import { formatUsdtAmount, parseUsdtAmount, getBucketEnumValue, ContractBucket } from '../bucket-service';
import * as anchor from '@coral-xyz/anchor';

describe('Bucket Service', () => {
  describe('formatUsdtAmount', () => {
    it('should format USDT amounts correctly', () => {
      // 1 USDT = 1,000,000 smallest units
      expect(formatUsdtAmount(new anchor.BN(1000000))).toBe('1');
      expect(formatUsdtAmount(new anchor.BN(1500000))).toBe('1.5');
      expect(formatUsdtAmount(new anchor.BN(1234567))).toBe('1.234567');
      expect(formatUsdtAmount(new anchor.BN(0))).toBe('0');
      expect(formatUsdtAmount(new anchor.BN(500000))).toBe('0.5');
    });

    it('should handle large amounts', () => {
      expect(formatUsdtAmount(new anchor.BN(1000000000000))).toBe('1000000');
    });

    it('should trim trailing zeros', () => {
      expect(formatUsdtAmount(new anchor.BN(1000000))).toBe('1');
      expect(formatUsdtAmount(new anchor.BN(1100000))).toBe('1.1');
      expect(formatUsdtAmount(new anchor.BN(1010000))).toBe('1.01');
    });
  });

  describe('parseUsdtAmount', () => {
    it('should parse USDT amounts correctly', () => {
      expect(parseUsdtAmount('1').toString()).toBe('1000000');
      expect(parseUsdtAmount('1.5').toString()).toBe('1500000');
      expect(parseUsdtAmount('1.234567').toString()).toBe('1234567');
      expect(parseUsdtAmount('0').toString()).toBe('0');
      expect(parseUsdtAmount('0.5').toString()).toBe('500000');
    });

    it('should handle edge cases', () => {
      expect(parseUsdtAmount('').toString()).toBe('0');
      expect(parseUsdtAmount('1.').toString()).toBe('1000000');
      expect(parseUsdtAmount('.5').toString()).toBe('500000');
    });

    it('should truncate to 6 decimal places', () => {
      expect(parseUsdtAmount('1.1234567890').toString()).toBe('1123456');
    });
  });

  describe('getBucketEnumValue', () => {
    it('should map bucket types to contract enum values', () => {
      expect(getBucketEnumValue('admin')).toBe(ContractBucket.Admin);
      expect(getBucketEnumValue('dev')).toBe(ContractBucket.Dev);
      expect(getBucketEnumValue('marketer1')).toBe(ContractBucket.Marketer1);
      expect(getBucketEnumValue('marketer2')).toBe(ContractBucket.Marketer2);
      expect(getBucketEnumValue('trader')).toBe(ContractBucket.Trader);
      expect(getBucketEnumValue('systemreserve')).toBe(ContractBucket.SystemReserve);
    });

    it('should throw error for invalid bucket type', () => {
      expect(() => getBucketEnumValue('invalid' as any)).toThrow('Invalid bucket type: invalid');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain precision in round-trip conversions', () => {
      const testAmounts = ['1', '1.5', '0.123456', '1000.999999', '0.000001'];
      
      testAmounts.forEach(amount => {
        const parsed = parseUsdtAmount(amount);
        const formatted = formatUsdtAmount(parsed);
        expect(formatted).toBe(amount);
      });
    });
  });
});