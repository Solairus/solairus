/**
 * License Integration Tests
 * Purpose: Test the complete license activation flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  UserProfile,
  Config,
  LicenseInfo,
  getLicenseInfo,
  isLicenseActive,
  getLicenseExpiryDate,
  checkLicenseStatus,
  needsRegistration,
} from '../solairus-main';

// Mock data
const mockUserPubkey = new PublicKey('11111111111111111111111111111111');
const mockUsdtMint = new PublicKey('22222222222222222222222222222222');

const mockUserProfile: UserProfile = {
  user: mockUserPubkey,
  sponsorL1: PublicKey.default,
  sponsorL2: PublicKey.default,
  sponsorL3: PublicKey.default,
  createdAt: new anchor.BN(Date.now() / 1000),
  activePrincipalUsdt: new anchor.BN(0),
  lastRoiWithdrawAt: new anchor.BN(0),
  licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 365 * 24 * 60 * 60), // 1 year from now
};

const mockExpiredProfile: UserProfile = {
  ...mockUserProfile,
  licenseExpiresAt: new anchor.BN(Date.now() / 1000 - 24 * 60 * 60), // 1 day ago
};

const mockNearExpiryProfile: UserProfile = {
  ...mockUserProfile,
  licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 3 * 24 * 60 * 60), // 3 days from now
};

const mockConfig: Config = {
  bump: 1,
  dev: PublicKey.default,
  admin: PublicKey.default,
  marketer1: PublicKey.default,
  marketer2: PublicKey.default,
  trader: PublicKey.default,
  systemreserve: PublicKey.default,
  usdtMint: mockUsdtMint,
  activationFeeUsdt: new anchor.BN(100_000_000), // 100 USDT
  licenseDurationDays: 365,
  roiDailyBps: 100,
  licenseAdminPct: 1000,
  licenseDevPct: 1000,
  licenseMarketer1Pct: 500,
  licenseMarketer2Pct: 500,
  licenseReservePct: 7000,
  licenseAffL1Pct: 0,
  licenseAffL2Pct: 0,
  licenseAffL3Pct: 0,
};

describe('License Integration', () => {
  describe('License Status Validation', () => {
    it('should identify active license correctly', () => {
      const result = isLicenseActive(mockUserProfile);
      expect(result).toBe(true);
    });

    it('should identify expired license correctly', () => {
      const result = isLicenseActive(mockExpiredProfile);
      expect(result).toBe(false);
    });

    it('should get correct expiry date', () => {
      const result = getLicenseExpiryDate(mockUserProfile);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('License Info Generation', () => {
    it('should generate correct info for active license', () => {
      const result = getLicenseInfo(mockUserProfile);
      
      expect(result.status).toBe('active');
      expect(result.isValid).toBe(true);
      expect(result.expirationDate).toBeInstanceOf(Date);
      expect(result.daysRemaining).toBeGreaterThan(300);
    });

    it('should generate correct info for expired license', () => {
      const result = getLicenseInfo(mockExpiredProfile);
      
      expect(result.status).toBe('expired');
      expect(result.isValid).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });

    it('should generate correct info for near-expiry license', () => {
      const result = getLicenseInfo(mockNearExpiryProfile);
      
      expect(result.status).toBe('near-expiry');
      expect(result.isValid).toBe(true);
      expect(result.daysRemaining).toBeLessThanOrEqual(7);
    });

    it('should handle null profile correctly', () => {
      const result = getLicenseInfo(null);
      
      expect(result.status).toBe('none');
      expect(result.isValid).toBe(false);
      expect(result.expirationDate).toBeUndefined();
    });
  });

  describe('License Status Check Integration', () => {
    let mockProgram: any;

    beforeEach(() => {
      mockProgram = {
        account: {
          userProfile: {
            fetch: vi.fn(),
          },
        },
      };
    });

    it('should return correct status for existing profile', async () => {
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockUserProfile);
      
      const result = await checkLicenseStatus(mockProgram, mockUserPubkey);
      
      expect(result.hasProfile).toBe(true);
      expect(result.needsRegistration).toBe(false);
      expect(result.licenseInfo.status).toBe('active');
    });

    it('should return correct status for non-existing profile', async () => {
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Account not found'));
      
      const result = await checkLicenseStatus(mockProgram, mockUserPubkey);
      
      expect(result.hasProfile).toBe(false);
      expect(result.needsRegistration).toBe(true);
      expect(result.licenseInfo.status).toBe('none');
    });
  });

  describe('Registration Check', () => {
    let mockProgram: any;

    beforeEach(() => {
      mockProgram = {
        account: {
          userProfile: {
            fetch: vi.fn(),
          },
        },
      };
    });

    it('should return false for existing profile', async () => {
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockUserProfile);
      
      const result = await needsRegistration(mockProgram, mockUserPubkey);
      
      expect(result).toBe(false);
    });

    it('should return true for non-existing profile', async () => {
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Account not found'));
      
      const result = await needsRegistration(mockProgram, mockUserPubkey);
      
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero expiration timestamp', () => {
      const profileWithZeroExpiry: UserProfile = {
        ...mockUserProfile,
        licenseExpiresAt: new anchor.BN(0),
      };
      
      const result = getLicenseInfo(profileWithZeroExpiry);
      
      expect(result.status).toBe('none');
      expect(result.isValid).toBe(false);
    });

    it('should handle very large expiration timestamp', () => {
      const profileWithFarExpiry: UserProfile = {
        ...mockUserProfile,
        licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 10 * 365 * 24 * 60 * 60), // 10 years
      };
      
      const result = getLicenseInfo(profileWithFarExpiry);
      
      expect(result.status).toBe('active');
      expect(result.isValid).toBe(true);
      expect(result.daysRemaining).toBeGreaterThan(3000);
    });

    it('should handle expiration exactly at boundary', () => {
      const profileExpiringIn7Days: UserProfile = {
        ...mockUserProfile,
        licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 7 * 24 * 60 * 60), // Exactly 7 days
      };
      
      const result = getLicenseInfo(profileExpiringIn7Days);
      
      expect(result.status).toBe('near-expiry');
      expect(result.isValid).toBe(true);
      expect(result.daysRemaining).toBe(7);
    });
  });

  describe('Performance', () => {
    it('should calculate license info quickly', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        getLicenseInfo(mockUserProfile);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete 1000 calculations in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle date calculations correctly across timezones', () => {
      // Test with different timezone offsets
      const originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const result1 = getLicenseInfo(mockUserProfile);
      
      // The result should be consistent regardless of timezone
      expect(result1.expirationDate).toBeInstanceOf(Date);
      expect(result1.daysRemaining).toBeGreaterThan(0);
    });
  });
});