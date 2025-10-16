/**
 * Profile Account Validator Tests
 * 
 * Tests for profile account validation utilities to ensure proper
 * validation of account existence, structure, and data integrity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKey, AccountInfo } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  ProfileAccountValidator,
  createProfileAccountValidator,
  validateProfileAccount,
  type ValidationResult,
  type AccountValidation,
} from '../profile-account-validator';
import { UserProfile } from '@/lib/solairus-main';

// Mock the solairus-main module
vi.mock('@/lib/solairus-main', async () => {
  const actual = await vi.importActual('@/lib/solairus-main');
  return {
    ...actual,
    derivePdas: vi.fn(),
    getErrorMessage: vi.fn().mockImplementation((err) => String(err)),
  };
});

// Mock data
const mockUserPubkey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
const mockProfilePda = new PublicKey('5YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
const mockProgramId = new PublicKey('6YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

const mockValidUserProfile: UserProfile = {
  user: mockUserPubkey,
  sponsor: new PublicKey('7YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
  createdAt: new anchor.BN(Date.now() / 1000),
  activePrincipalUsdt: new anchor.BN(0),
  lastRoiWithdrawAt: new anchor.BN(0),
  licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 30 * 24 * 60 * 60), // 30 days from now
  totalAffiliateEarnings: new anchor.BN(0),
  totalAffiliateWithdrawn: new anchor.BN(0),
  level1Earnings: new anchor.BN(0),
  level2Earnings: new anchor.BN(0),
  level3Earnings: new anchor.BN(0),
};

describe('ProfileAccountValidator', () => {
  let validator: ProfileAccountValidator;
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
    };
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock program
    mockProgram = {
      programId: mockProgramId,
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
    };

    // Mock provider
    mockProvider = {
      connection: {
        getAccountInfo: vi.fn(),
      },
    };

    validator = new ProfileAccountValidator(
      mockProgram as unknown as anchor.Program,
      mockProvider as unknown as anchor.AnchorProvider
    );
  });

  describe('checkAccountExists', () => {
    it('should return true for existing account', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await validator.checkAccountExists(mockProfilePda);
      expect(result).toBe(true);
      expect(mockProvider.connection.getAccountInfo).toHaveBeenCalledWith(mockProfilePda);
    });

    it('should return false for non-existing account', async () => {
      mockProvider.connection.getAccountInfo.mockResolvedValue(null);

      const result = await validator.checkAccountExists(mockProfilePda);
      expect(result).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      mockProvider.connection.getAccountInfo.mockRejectedValue(new Error('Network error'));

      const result = await validator.checkAccountExists(mockProfilePda);
      expect(result).toBe(false);
    });
  });

  describe('verifyAccountSize', () => {
    it('should return true for correct account size', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152), // Expected size for UserProfile
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await validator.verifyAccountSize(mockProfilePda);
      expect(result).toBe(true);
    });

    it('should return false for incorrect account size', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await validator.verifyAccountSize(mockProfilePda);
      expect(result).toBe(false);
    });

    it('should return false for non-existing account', async () => {
      mockProvider.connection.getAccountInfo.mockResolvedValue(null);

      const result = await validator.verifyAccountSize(mockProfilePda);
      expect(result).toBe(false);
    });
  });

  describe('validateAccountData', () => {
    it('should validate existing deserializable account', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockValidUserProfile);

      const result = await validator.validateAccountData(mockProfilePda);

      expect(result.exists).toBe(true);
      expect(result.hasCorrectSize).toBe(true);
      expect(result.canDeserialize).toBe(true);
      expect(result.structureMatches).toBe(true);
      expect(result.errorDetails).toBeUndefined();
    });

    it('should handle non-existing account', async () => {
      mockProvider.connection.getAccountInfo.mockResolvedValue(null);

      const result = await validator.validateAccountData(mockProfilePda);

      expect(result.exists).toBe(false);
      expect(result.canDeserialize).toBe(false);
      expect(result.hasCorrectSize).toBe(false);
      expect(result.structureMatches).toBe(false);
    });

    it('should handle size mismatch', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await validator.validateAccountData(mockProfilePda);

      expect(result.exists).toBe(true);
      expect(result.hasCorrectSize).toBe(false);
      expect(result.canDeserialize).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.expectedSize).toBe(152);
      expect(result.errorDetails?.actualSize).toBe(100);
    });

    it('should handle deserialization failure', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockRejectedValue(new Error('Deserialization failed'));

      const result = await validator.validateAccountData(mockProfilePda);

      expect(result.exists).toBe(true);
      expect(result.hasCorrectSize).toBe(true);
      expect(result.canDeserialize).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.deserializationError).toBe('Error: Deserialization failed');
    });
  });

  describe('validateAccountStructure', () => {
    it('should validate complete account structure successfully', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockValidUserProfile);

      const result = await validator.validateAccountStructure(mockProfilePda);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestedAction).toBe('none');
      expect(result.accountInfo).toBeDefined();
      expect(result.accountInfo?.exists).toBe(true);
      expect(result.accountInfo?.canDeserialize).toBe(true);
    });

    it('should handle non-existing account', async () => {
      mockProvider.connection.getAccountInfo.mockResolvedValue(null);

      const result = await validator.validateAccountStructure(mockProfilePda);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Profile account does not exist');
      expect(result.suggestedAction).toBe('recreate');
      expect(result.canRecover).toBe(true);
    });

    it('should handle owner mismatch', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'), // Wrong owner
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await validator.validateAccountStructure(mockProfilePda);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Account owner mismatch'))).toBe(true);
      expect(result.suggestedAction).toBe('recreate');
      expect(result.canRecover).toBe(false);
    });

    it('should handle size mismatch', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await validator.validateAccountStructure(mockProfilePda);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Account size mismatch'))).toBe(true);
      expect(result.suggestedAction).toBe('recreate');
      expect(result.canRecover).toBe(true);
    });
  });

  describe('createValidationError', () => {
    it('should create proper validation error for account not found', () => {
      const error = validator.createValidationError('account_not_found', mockProfilePda.toString());

      expect(error.type).toBe('account_not_found');
      expect(error.message).toBe('User profile account does not exist. Registration is required.');
      expect(error.isRecoverable).toBe(true);
      expect(error.retryable).toBe(false);
      expect(error.technicalDetails.accountAddress).toBe(mockProfilePda.toString());
    });

    it('should create proper validation error for deserialization failure', () => {
      const error = validator.createValidationError('deserialization_failed', mockProfilePda.toString());

      expect(error.type).toBe('deserialization_failed');
      expect(error.message).toBe('Profile account data is corrupted or incompatible. Account recovery needed.');
      expect(error.isRecoverable).toBe(true);
      expect(error.retryable).toBe(false);
    });
  });

  describe('getDiagnosticInfo', () => {
    it('should provide comprehensive diagnostic information', async () => {
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      mockProvider.connection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockValidUserProfile);

      // Mock the derivePdas function by spying on the import
      const { derivePdas } = await import('@/lib/solairus-main');
      vi.mocked(derivePdas).mockReturnValue({ 
        config: mockProfilePda, 
        vault: mockProfilePda, 
        profile: mockProfilePda, 
        counter: mockProfilePda 
      });

      const result = await validator.getDiagnosticInfo(mockUserPubkey);

      expect(result.userPubkey).toBe(mockUserPubkey.toString());
      expect(result.derivedPda).toBe(mockProfilePda.toString());
      expect(result.accountExists).toBe(true);
      expect(result.accountInfo).toBeDefined();
      expect(result.accountInfo?.owner).toBe(mockProgramId.toString());
      expect(result.accountInfo?.size).toBe(152);
      expect(result.validationResult).toBeDefined();
    });
  });
});

describe('Utility Functions', () => {
  describe('createProfileAccountValidator', () => {
    it('should create validator instance', () => {
      const mockProgram = {} as anchor.Program;
      const mockProvider = {} as anchor.AnchorProvider;

      const validator = createProfileAccountValidator(mockProgram, mockProvider);
      expect(validator).toBeInstanceOf(ProfileAccountValidator);
    });
  });

  describe('validateProfileAccount', () => {
    it('should validate profile account with minimal setup', async () => {
      const mockProgram = {
        programId: mockProgramId,
        account: {
          userProfile: {
            fetch: vi.fn(),
          },
        },
      } as unknown as anchor.Program;

      const mockProvider = {
        connection: {
          getAccountInfo: vi.fn().mockResolvedValue(null),
        },
      } as unknown as anchor.AnchorProvider;

      // Mock derivePdas to return null (simulating PDA derivation failure)
      const { derivePdas } = await import('@/lib/solairus-main');
      vi.mocked(derivePdas).mockReturnValue({ 
        config: mockProfilePda, 
        vault: mockProfilePda, 
        profile: null, 
        counter: mockProfilePda 
      });

      const result = await validateProfileAccount(mockProgram, mockProvider, mockUserPubkey);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to derive profile PDA');
      expect(result.suggestedAction).toBe('none');
    });
  });
});