/**
 * License Status Validator Tests
 * Purpose: Test core license validation functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { LicenseStatusValidator } from '../license-status-validator';
import { UserProfile } from '@/lib/solairus-main';

// Mock data
const mockUserPubkey = new PublicKey('11111111111111111111111111111112');
const mockProgramId = new PublicKey('11111111111111111111111111111113');

const mockActiveProfile: UserProfile = {
  user: mockUserPubkey,
  sponsorL1: PublicKey.default,
  sponsorL2: PublicKey.default,
  sponsorL3: PublicKey.default,
  createdAt: new anchor.BN(Date.now() / 1000),
  activePrincipalUsdt: new anchor.BN(0),
  lastRoiWithdrawAt: new anchor.BN(0),
  licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 365 * 24 * 60 * 60), // 1 year from now
  totalAffiliateEarnings: new anchor.BN(0),
  totalAffiliateWithdrawn: new anchor.BN(0),
  level1Earnings: new anchor.BN(0),
  level2Earnings: new anchor.BN(0),
  level3Earnings: new anchor.BN(0),
};

describe('LicenseStatusValidator Core', () => {
  let validator: LicenseStatusValidator;
  let mockProgram: {
    programId: PublicKey;
    account: {
      userProfile: {
        fetch: ReturnType<typeof vi.fn>;
      };
    };
  };
  let mockProvider: {
    connection: {
      getAccountInfo: ReturnType<typeof vi.fn>;
      rpcEndpoint: string;
    };
  };

  beforeEach(() => {
    // Mock connection
    const mockConnection = {
      getAccountInfo: vi.fn(),
      rpcEndpoint: 'https://api.devnet.solana.com',
    };

    // Mock provider
    mockProvider = {
      connection: mockConnection,
    };

    // Mock program
    mockProgram = {
      programId: mockProgramId,
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
    };

    validator = new LicenseStatusValidator(mockProgram as any, mockProvider as unknown);
    vi.clearAllMocks();
  });

  describe('validateOnChain', () => {
    it('should validate existing active profile', async () => {
      const mockAccountInfo = {
        data: Buffer.from('mock-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockActiveProfile);

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(true);
      expect(result.profileData).toEqual(mockActiveProfile);
      expect(result.licenseInfo.status).toBe('active');
      expect(result.licenseInfo.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-existing profile', async () => {
      mockProvider.connection.getAccountInfo.mockResolvedValue(null);
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Account not found'));

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(false);
      expect(result.profileData).toBeNull();
      expect(result.licenseInfo.status).toBe('none');
      expect(result.licenseInfo.isValid).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockProvider.connection.getAccountInfo.mockRejectedValue(new Error('Network error'));

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Network error');
    });
  });

  describe('getValidatedLicenseStatus', () => {
    it('should prioritize fresh on-chain data', async () => {
      const mockAccountInfo = {
        data: Buffer.from('mock-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockActiveProfile);

      const result = await validator.getValidatedLicenseStatus(mockUserPubkey);

      expect(result.source).toBe('onchain');
      expect(result.validationMethod).toBe('full');
      expect(result.status).toBe('active');
      expect(result.debugInfo?.profileExists).toBe(true);
      expect(result.debugInfo?.cacheHit).toBe(false);
    });

    it('should return none status on errors (not loading)', async () => {
      mockProvider.connection.getAccountInfo.mockRejectedValue(new Error('Network error'));
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Network error'));

      const result = await validator.getValidatedLicenseStatus(mockUserPubkey);

      expect(result.status).toBe('none');
      expect(result.isValid).toBe(false);
      expect(result.source).toBe('default');
      expect(result.validationMethod).toBe('error-fallback');
    });
  });

  describe('cache validation', () => {
    it('should return invalid for empty cache', () => {
      localStorage.getItem = vi.fn().mockReturnValue(null);

      const result = validator.validateCache(mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.cachedInfo).toBeNull();
      expect(result.shouldRefresh).toBe(true);
      expect(result.issues).toContain('No cached data found');
    });

    it('should validate correct cache structure', () => {
      const validCacheData = {
        licenseInfo: {
          status: 'active',
          isValid: true,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          daysRemaining: 365,
        },
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        expiresAt: Date.now() + 20 * 60 * 1000, // 20 minutes from now
      };

      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(validCacheData));

      const result = validator.validateCache(mockUserPubkey);

      expect(result.isValid).toBe(true);
      expect(result.cachedInfo).toBeDefined();
      expect(result.cachedInfo?.status).toBe('active');
    });
  });
});