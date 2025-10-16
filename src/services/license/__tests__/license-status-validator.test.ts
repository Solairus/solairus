/**
 * License Status Validator Tests
 * Purpose: Test license status validation and debug utilities
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PublicKey, AccountInfo } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { LicenseStatusValidator, LicenseValidationResult, CacheValidationResult } from '../license-status-validator';
import { LicenseDebugUtils } from '../license-debug-utils';
import { UserProfile, LicenseInfo } from '@/lib/solairus-main';

// Mock data
const mockUserPubkey = new PublicKey('11111111111111111111111111111111');
const mockProgramId = new PublicKey('22222222222222222222222222222222');

const mockActiveProfile: UserProfile = {
  user: mockUserPubkey,
  sponsor: PublicKey.default,
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

const mockExpiredProfile: UserProfile = {
  ...mockActiveProfile,
  licenseExpiresAt: new anchor.BN(Date.now() / 1000 - 24 * 60 * 60), // 1 day ago
};

describe('LicenseStatusValidator', () => {
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
  let mockConnection: {
    getAccountInfo: ReturnType<typeof vi.fn>;
    rpcEndpoint: string;
  };

  beforeEach(() => {
    // Mock connection
    mockConnection = {
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

    validator = new LicenseStatusValidator(mockProgram, mockProvider);

    // Clear localStorage mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('validateOnChain', () => {
    it('should validate existing active profile', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.from('mock-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockActiveProfile);

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(true);
      expect(result.profileData).toEqual(mockActiveProfile);
      expect(result.licenseInfo.status).toBe('active');
      expect(result.licenseInfo.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-existing profile', async () => {
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Account not found'));

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(false);
      expect(result.profileData).toBeNull();
      expect(result.licenseInfo.status).toBe('none');
      expect(result.licenseInfo.isValid).toBe(false);
    });

    it('should handle expired profile', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.from('mock-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockExpiredProfile);

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(true);
      expect(result.licenseInfo.status).toBe('expired');
      expect(result.licenseInfo.isValid).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockConnection.getAccountInfo.mockRejectedValue(new Error('Network error'));

      const result = await validator.validateOnChain(mockUserPubkey);

      expect(result.hasProfile).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Network error');
    });
  });

  describe('validateCache', () => {
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

    it('should detect corrupted cache data', () => {
      const corruptedCacheData = {
        licenseInfo: {
          // Missing required fields
          status: 'active',
          // isValid missing
        },
        timestamp: Date.now(),
        expiresAt: Date.now() + 1000,
      };

      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(corruptedCacheData));

      const result = validator.validateCache(mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('invalid structure'))).toBe(true);
    });

    it('should detect expired cache', () => {
      const expiredCacheData = {
        licenseInfo: {
          status: 'active',
          isValid: true,
        },
        timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
        expiresAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago (expired)
      };

      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(expiredCacheData));

      const result = validator.validateCache(mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.shouldRefresh).toBe(true);
    });
  });

  describe('getValidatedLicenseStatus', () => {
    it('should prioritize fresh on-chain data', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.from('mock-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockActiveProfile);

      const result = await validator.getValidatedLicenseStatus(mockUserPubkey);

      expect(result.source).toBe('onchain');
      expect(result.validationMethod).toBe('full');
      expect(result.status).toBe('active');
      expect(result.debugInfo?.profileExists).toBe(true);
      expect(result.debugInfo?.cacheHit).toBe(false);
    });

    it('should return none status on errors (not loading)', async () => {
      mockConnection.getAccountInfo.mockRejectedValue(new Error('Network error'));
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Network error'));

      const result = await validator.getValidatedLicenseStatus(mockUserPubkey);

      expect(result.status).toBe('none');
      expect(result.isValid).toBe(false);
      expect(result.source).toBe('default');
      expect(result.validationMethod).toBe('error-fallback');
    });

    it('should use cache fallback when explicitly allowed', async () => {
      // Mock on-chain failure
      mockConnection.getAccountInfo.mockRejectedValue(new Error('Network error'));

      // Mock valid cache
      const validCacheData = {
        licenseInfo: {
          status: 'active',
          isValid: true,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        expiresAt: Date.now() + 25 * 60 * 1000, // 25 minutes from now
      };
      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(validCacheData));

      const result = await validator.getValidatedLicenseStatus(mockUserPubkey, true);

      expect(result.source).toBe('cache');
      expect(result.validationMethod).toBe('cached');
      expect(result.status).toBe('active');
    });
  });

  describe('forceRefresh', () => {
    it('should clear cache and fetch fresh data', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.from('mock-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockActiveProfile);

      // Set up cache first
      localStorage.setItem = vi.fn();
      localStorage.removeItem = vi.fn();

      const result = await validator.forceRefresh(mockUserPubkey);

      expect(localStorage.removeItem).toHaveBeenCalled();
      expect(result.source).toBe('onchain');
      expect(result.debugInfo?.cacheHit).toBe(false);
    });
  });
});

describe('LicenseDebugUtils', () => {
  let debugUtils: LicenseDebugUtils;
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
  let mockConnection: {
    getAccountInfo: ReturnType<typeof vi.fn>;
    rpcEndpoint: string;
  };

  beforeEach(() => {
    mockConnection = {
      getAccountInfo: vi.fn(),
      rpcEndpoint: 'https://api.devnet.solana.com',
    };

    mockProvider = {
      connection: mockConnection,
    };

    mockProgram = {
      programId: mockProgramId,
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
    };

    debugUtils = new LicenseDebugUtils(mockProgram, mockProvider);
    vi.clearAllMocks();
  });

  describe('inspectOnChainData', () => {
    it('should inspect existing profile data', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.from('test-data'),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 300,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockActiveProfile);

      const result = await debugUtils.inspectOnChainData(mockUserPubkey);

      expect(result.profileExists).toBe(true);
      expect(result.decodedData).toEqual(mockActiveProfile);
      expect(result.rawDataHex).toBe('746573742d64617461'); // 'test-data' in hex
      expect(result.accountLamports).toBe(1000000);
      expect(result.decodingErrors).toHaveLength(0);
    });

    it('should handle non-existing profile', async () => {
      mockConnection.getAccountInfo.mockResolvedValue(null);

      const result = await debugUtils.inspectOnChainData(mockUserPubkey);

      expect(result.profileExists).toBe(false);
      expect(result.decodedData).toBeNull();
      expect(result.rawDataHex).toBe('');
    });
  });

  describe('inspectCache', () => {
    it('should analyze cache entries', () => {
      // Mock localStorage with test data
      const cacheEntries = {
        'solairus_license_user1': JSON.stringify({
          licenseInfo: { status: 'active', isValid: true },
          timestamp: Date.now() - 10 * 60 * 1000,
          expiresAt: Date.now() + 20 * 60 * 1000,
        }),
        'solairus_license_user2': JSON.stringify({
          licenseInfo: { status: 'expired', isValid: false },
          timestamp: Date.now() - 60 * 60 * 1000,
          expiresAt: Date.now() - 10 * 60 * 1000, // expired
        }),
        'other_key': 'other_value',
      };

      Object.defineProperty(Storage.prototype, 'length', {
        get: () => Object.keys(cacheEntries).length,
      });
      
      Storage.prototype.key = vi.fn((index: number) => Object.keys(cacheEntries)[index]);
      Storage.prototype.getItem = vi.fn((key: string) => cacheEntries[key] || null);

      const result = debugUtils.inspectCache();

      expect(result.totalEntries).toBe(2);
      expect(result.expiredEntries).toBe(1);
      expect(result.corruptedEntries).toBe(0);
      expect(result.licenseEntries).toHaveLength(2);
    });
  });

  describe('clearAllLicenseData', () => {
    it('should clear all license cache entries', () => {
      const mockKeys = ['solairus_license_user1', 'solairus_license_user2', 'other_key'];
      
      Object.defineProperty(Storage.prototype, 'length', {
        get: () => mockKeys.length,
      });
      
      Storage.prototype.key = vi.fn((index: number) => mockKeys[index]);
      Storage.prototype.removeItem = vi.fn();

      const result = debugUtils.clearAllLicenseData();

      expect(result.cleared).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(localStorage.removeItem).toHaveBeenCalledTimes(2);
    });
  });
});