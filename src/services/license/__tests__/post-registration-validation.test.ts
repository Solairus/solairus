import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { LicenseService } from '../license-service';

// Mock the dependencies
vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(() => ({
    programId: new PublicKey('11111111111111111111111111111112'),
    account: {
      userProfile: {
        fetch: vi.fn(),
      },
    },
    methods: {
      registerUser: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(),
        })),
      })),
    },
  })),
  derivePdas: vi.fn(() => ({
    profile: new PublicKey('11111111111111111111111111111112'),
    config: new PublicKey('11111111111111111111111111111113'),
  })),
  getErrorMessage: vi.fn((error) => error?.message || 'Unknown error'),
  UserProfile: {},
}));

vi.mock('@/services/profile/profile-account-validator', () => ({
  createProfileAccountValidator: vi.fn(() => ({
    checkAccountExists: vi.fn(),
    validateAccountStructure: vi.fn(),
    validateAccountData: vi.fn(),
  })),
}));

vi.mock('@/services/profile/account-recovery-service', () => ({
  createAccountRecoveryService: vi.fn(() => ({
    attemptAccountRecovery: vi.fn(),
  })),
}));

vi.mock('@/lib/sponsor-tree', () => ({
  getSponsorL1: vi.fn(() => Promise.resolve(new PublicKey('11111111111111111111111111111114'))),
}));

describe('LicenseService Post-Registration Validation', () => {
  let licenseService: LicenseService;
  let mockProvider: anchor.AnchorProvider;
  let mockUserPubkey: PublicKey;

  beforeEach(() => {
    // Create mock provider with properly typed mocks
    mockProvider = {
      connection: {
        getAccountInfo: vi.fn(),
        getSignatureStatus: vi.fn(),
      },
    } as any;

    mockUserPubkey = new PublicKey('11111111111111111111111111111115');
    licenseService = new LicenseService(mockProvider);
  });

  describe('performPostRegistrationValidation', () => {
    it('should validate successful registration', async () => {
      // Mock successful validation scenario
      const mockProfileValidator = (licenseService as any).profileValidator;
      mockProfileValidator.checkAccountExists.mockResolvedValue(true);
      mockProfileValidator.validateAccountStructure.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      // Mock successful deserialization
      const mockProgram = (licenseService as any).program;
      mockProgram.account.userProfile.fetch.mockResolvedValue({
        user: mockUserPubkey,
        sponsor: new PublicKey('11111111111111111111111111111114'),
        createdAt: new anchor.BN(Math.floor(Date.now() / 1000)),
        activePrincipalUsdt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(0),
        totalAffiliateEarnings: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
      });

      // Mock transaction confirmation
      vi.mocked(mockProvider.connection.getSignatureStatus).mockResolvedValue({
        value: { confirmationStatus: 'confirmed' },
      } as any);

      // Call the private method through reflection
      const result = await (licenseService as any).performPostRegistrationValidation(
        mockUserPubkey,
        'test-signature'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing account after registration', async () => {
      // Mock account not found scenario
      const mockProfileValidator = (licenseService as any).profileValidator;
      mockProfileValidator.checkAccountExists.mockResolvedValue(false);

      // Mock transaction confirmation
      vi.mocked(mockProvider.connection.getSignatureStatus).mockResolvedValue({
        value: { confirmationStatus: 'confirmed' },
      } as any);

      const result = await (licenseService as any).performPostRegistrationValidation(
        mockUserPubkey,
        'test-signature'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Profile account was not created despite successful transaction');
    });

    it('should detect deserialization failures', async () => {
      // Mock account exists but deserialization fails
      const mockProfileValidator = (licenseService as any).profileValidator;
      mockProfileValidator.checkAccountExists.mockResolvedValue(true);
      mockProfileValidator.validateAccountStructure.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      // Mock deserialization failure
      const mockProgram = (licenseService as any).program;
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Deserialization failed'));

      // Mock transaction confirmation
      vi.mocked(mockProvider.connection.getSignatureStatus).mockResolvedValue({
        value: { confirmationStatus: 'confirmed' },
      } as any);

      const result = await (licenseService as any).performPostRegistrationValidation(
        mockUserPubkey,
        'test-signature'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Account deserialization failed'))).toBe(true);
    });
  });

  describe('validateProfileData', () => {
    it('should validate correct profile data', () => {
      const mockProfile = {
        user: mockUserPubkey,
        sponsor: new PublicKey('11111111111111111111111111111114'),
        createdAt: new anchor.BN(Math.floor(Date.now() / 1000)),
        activePrincipalUsdt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(0),
        totalAffiliateEarnings: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
      };

      const result = (licenseService as any).validateProfileData(mockProfile, mockUserPubkey);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect user field mismatch', () => {
      const wrongUser = new PublicKey('11111111111111111111111111111116');
      const mockProfile = {
        user: wrongUser,
        sponsor: new PublicKey('11111111111111111111111111111114'),
        createdAt: new anchor.BN(Math.floor(Date.now() / 1000)),
        activePrincipalUsdt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(0),
        totalAffiliateEarnings: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
      };

      const result = (licenseService as any).validateProfileData(mockProfile, mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Profile user field mismatch'))).toBe(true);
    });

    it('should detect default sponsor', () => {
      const mockProfile = {
        user: mockUserPubkey,
        sponsor: PublicKey.default,
        createdAt: new anchor.BN(Math.floor(Date.now() / 1000)),
        activePrincipalUsdt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(0),
        totalAffiliateEarnings: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
      };

      const result = (licenseService as any).validateProfileData(mockProfile, mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Profile sponsor field is default PublicKey'))).toBe(true);
    });

    it('should detect missing createdAt', () => {
      const mockProfile = {
        user: mockUserPubkey,
        sponsor: new PublicKey('11111111111111111111111111111114'),
        createdAt: new anchor.BN(0),
        activePrincipalUsdt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(0),
        totalAffiliateEarnings: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
      };

      const result = (licenseService as any).validateProfileData(mockProfile, mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Profile createdAt field is not set'))).toBe(true);
    });
  });
});