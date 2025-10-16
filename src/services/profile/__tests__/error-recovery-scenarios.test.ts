/**
 * Error Recovery Scenarios Tests
 * 
 * Tests for comprehensive error handling and recovery scenarios
 * covering edge cases and failure modes.
 * 
 * Tests Requirements:
 * - 1.1: Profile account creation without deserialization errors
 * - 2.1: Comprehensive error handling and logging
 * - 3.1: Resilient registration process with account state inconsistencies
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PublicKey, AccountInfo, Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  ProfileAccountValidator,
  AccountRecoveryService,
  ProfileErrorFactory,
  ProfileErrorFormatter,
  ProfileErrorUtils,
  createProfileAccountValidator,
  createAccountRecoveryService,
  type ValidationResult,
  type RecoveryResult,
  type EnhancedProfileError,
} from '../index';

// Mock the solairus-main module
vi.mock('@/lib/solairus-main', async () => {
  const actual = await vi.importActual('@/lib/solairus-main');
  return {
    ...actual,
    derivePdas: vi.fn(),
    getErrorMessage: vi.fn().mockImplementation((err) => String(err)),
    registerUser: vi.fn(),
    PROGRAM_ID: new PublicKey('6YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
  };
});

describe('Error Recovery Scenarios', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockConnection: Connection;
  let validator: ProfileAccountValidator;
  let recoveryService: AccountRecoveryService;
  
  const mockUserPubkey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockSponsorPubkey = new PublicKey('5YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockProfilePda = new PublicKey('6YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockProgramId = new PublicKey('7YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock connection
    mockConnection = {
      getAccountInfo: vi.fn(),
      getSignatureStatus: vi.fn(),
    } as unknown as Connection;

    // Mock program
    mockProgram = {
      programId: mockProgramId,
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
      methods: {
        registerUser: vi.fn(() => ({
          accounts: vi.fn(() => ({
            rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
          })),
        })),
      },
    } as unknown as anchor.Program;

    // Mock provider
    mockProvider = {
      connection: mockConnection,
    } as unknown as anchor.AnchorProvider;

    // Initialize services
    validator = createProfileAccountValidator(mockProgram, mockProvider);
    recoveryService = createAccountRecoveryService(mockProgram, mockProvider, validator);

    // Mock derivePdas to return consistent PDAs
    const solairusMain = await import('@/lib/solairus-main');
    vi.mocked(solairusMain.derivePdas).mockReturnValue({
      config: mockProfilePda,
      vault: mockProfilePda,
      profile: mockProfilePda,
      counter: mockProfilePda,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Network Error Scenarios', () => {
    it('should handle connection timeouts gracefully', async () => {
      // Requirement 2.1: Comprehensive error handling and logging
      
      // Setup: Connection timeout
      vi.mocked(mockConnection.getAccountInfo).mockRejectedValue(
        new Error('Connection timeout after 30s')
      );

      // Test validation handles timeout
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('Validation failed'))).toBe(true);
      expect(validationResult.canRecover).toBe(true);
      expect(validationResult.suggestedAction).toBe('retry');

      // Test recovery handles timeout
      const recoveryResult = await recoveryService.attemptAccountRecovery(
        mockUserPubkey,
        mockSponsorPubkey,
        1
      );
      
      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.action).toBe('failed');
      expect(recoveryResult.error).toContain('PDA derivation failed');
    });

    it('should handle RPC rate limiting', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: RPC rate limit error
      vi.mocked(mockConnection.getAccountInfo).mockRejectedValue(
        new Error('429 Too Many Requests')
      );

      // Test validation handles rate limiting
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.canRecover).toBe(true);
      expect(validationResult.suggestedAction).toBe('retry');

      // Test error classification
      const profileError = ProfileErrorFactory.fromException(
        new Error('429 Too Many Requests')
      );
      
      expect(profileError.type).toBe('network_error');
      expect(profileError.isRecoverable).toBe(false);
      expect(profileError.retryable).toBe(true);
    });

    it('should handle intermittent network failures', async () => {
      // Requirement 3.1: Resilient registration process
      
      // Setup: Intermittent failures
      vi.mocked(mockConnection.getAccountInfo)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce(null);

      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('mock-success-tx');

      // Test recovery with network resilience
      const recoveryResult = await recoveryService.attemptAccountRecovery(
        mockUserPubkey,
        mockSponsorPubkey,
        3
      );
      
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.action).toBe('recreated');
      expect(recoveryResult.transactionSignature).toBe('mock-success-tx');
    });
  });

  describe('Account Corruption Scenarios', () => {
    it('should handle partially written account data', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Account with partial data
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152), // Correct size but corrupted data
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      // Fill with invalid data pattern
      mockAccountInfo.data.fill(0xFF);

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
        new Error('Invalid account data: failed to deserialize')
      );

      // Test validation detects corruption
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('deserialized'))).toBe(true);
      expect(validationResult.canRecover).toBe(true);
      expect(validationResult.suggestedAction).toBe('migrate');

      // Test classification
      const classification = await recoveryService.classifyAccountFailure(mockProfilePda, validationResult);
      
      expect(classification.type).toBe('data_corruption');
      expect(classification.severity).toBe('high');
      expect(classification.suggestedStrategy).toBe('close_and_recreate');
    });

    it('should handle account with zero-filled data', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Account with all zeros
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152, 0), // All zeros
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
        new Error('Account data is all zeros')
      );

      // Test validation
      const accountValidation = await validator.validateAccountData(mockProfilePda);
      
      expect(accountValidation.exists).toBe(true);
      expect(accountValidation.hasCorrectSize).toBe(true);
      expect(accountValidation.canDeserialize).toBe(false);
      expect(accountValidation.errorDetails?.deserializationError).toBe('Error: Account data is all zeros');
    });

    it('should handle account with random garbage data', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Account with random data
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.from(Array.from({ length: 152 }, () => Math.floor(Math.random() * 256))),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
        new Error('Borsh deserialization error')
      );

      // Test recovery handles garbage data
      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockResolvedValue('mock-recovery-tx');

      const recoveryResult = await recoveryService.attemptAccountRecovery(
        mockUserPubkey,
        mockSponsorPubkey,
        1
      );
      
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.action).toBe('recreated');
    });
  });

  describe('Program State Inconsistencies', () => {
    it('should handle program upgrade scenarios', async () => {
      // Requirement 3.1: Resilient registration process
      
      // Setup: Account structure from old program version
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(120), // Old structure size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test validation detects structure mismatch
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('size mismatch'))).toBe(true);
      expect(validationResult.suggestedAction).toBe('recreate');

      // Test migration attempt
      const migrationResult = await recoveryService.migrateAccountStructure(mockProfilePda);
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.action).toBe('failed');
      expect(migrationResult.error).toContain('Migration validation failed');
    });

    it('should handle discriminator mismatches', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Account with wrong discriminator
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      // Set wrong discriminator
      mockAccountInfo.data.writeUInt32LE(0xDEADBEEF, 0);

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
        new Error('Account discriminator mismatch')
      );

      // Test error handling
      const profileError = ProfileErrorFactory.fromException(
        new Error('Account discriminator mismatch')
      );
      
      expect(profileError.type).toBe('deserialization_failed');
      expect(profileError.message).toContain('Profile account data is corrupted');
      expect(profileError.isRecoverable).toBe(true);
    });
  });

  describe('Concurrent Access Scenarios', () => {
    it('should handle concurrent validation requests', async () => {
      // Requirement 3.1: Resilient registration process
      
      // Setup: Valid account
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue({
        user: mockUserPubkey,
        sponsor: mockSponsorPubkey,
        createdAt: new anchor.BN(Date.now() / 1000),
        activePrincipalUsdt: new anchor.BN(0),
        lastRoiWithdrawAt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 30 * 24 * 60 * 60),
        totalAffiliateEarnings: new anchor.BN(0),
        totalAffiliateWithdrawn: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
        level2Earnings: new anchor.BN(0),
        level3Earnings: new anchor.BN(0),
      });

      // Test concurrent validations
      const concurrentValidations = Array.from({ length: 10 }, () =>
        validator.validateAccountStructure(mockProfilePda)
      );

      const results = await Promise.all(concurrentValidations);
      
      // All should succeed
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });

      // Should handle concurrent calls efficiently
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent recovery attempts', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Account that needs recovery
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockResolvedValue('mock-tx');

      // Test concurrent recovery attempts
      const concurrentRecoveries = Array.from({ length: 3 }, () =>
        recoveryService.attemptAccountRecovery(mockUserPubkey, mockSponsorPubkey, 1)
      );

      const results = await Promise.all(concurrentRecoveries);
      
      // All should succeed (idempotent)
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.action).toBe('recreated');
      });
    });
  });

  describe('Edge Case Error Handling', () => {
    it('should handle null/undefined account responses', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Null response
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      // Test validation handles null gracefully
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Profile account does not exist');
      expect(validationResult.suggestedAction).toBe('recreate');

      // Test account existence check
      const exists = await validator.checkAccountExists(mockProfilePda);
      expect(exists).toBe(false);
    });

    it('should handle malformed account info', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Malformed account info
      const malformedAccountInfo = {
        data: null, // Invalid data
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      } as unknown as AccountInfo<Buffer>;

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(malformedAccountInfo);

      // Test validation handles malformed data
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.canRecover).toBe(true);
    });

    it('should handle extremely large account data', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Oversized account
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(10000), // Way too large
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test size validation
      const sizeValid = await validator.verifyAccountSize(mockProfilePda);
      expect(sizeValid).toBe(false);

      // Test validation handles oversized account
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('size mismatch'))).toBe(true);
    });

    it('should handle zero-length account data', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Empty account
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(0), // Empty
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test validation handles empty account
      const accountValidation = await validator.validateAccountData(mockProfilePda);
      
      expect(accountValidation.exists).toBe(true);
      expect(accountValidation.hasCorrectSize).toBe(false);
      expect(accountValidation.canDeserialize).toBe(false);
      expect(accountValidation.errorDetails?.expectedSize).toBe(152);
      expect(accountValidation.errorDetails?.actualSize).toBe(0);
    });
  });

  describe('Error Message and Formatting', () => {
    it('should format errors for user display correctly', async () => {
      // Requirement 2.1: Comprehensive error handling and logging
      
      const sizeMismatchError = ProfileErrorFactory.createError('size_mismatch', {
        accountAddress: mockProfilePda.toString(),
      });

      const userFormatted = ProfileErrorFormatter.formatForUser(sizeMismatchError);
      
      expect(userFormatted.title).toBe('Profile Update Required');
      expect(userFormatted.message).toBe('Your profile needs to be updated for the latest version.');
      expect(userFormatted.severity).toBe('high');
      expect(userFormatted.actions).toContain('Close existing account and recreate with correct size');
    });

    it('should format errors for technical logging correctly', async () => {
      // Requirement 2.1: Comprehensive error handling and logging
      
      const networkError = ProfileErrorFactory.createError('network_error', {
        accountAddress: mockProfilePda.toString(),
      });

      const logFormatted = ProfileErrorFormatter.formatForLogging(networkError);
      
      expect(logFormatted.level).toBe('error');
      expect(logFormatted.message).toContain('PROFILE_008');
      expect(logFormatted.details.type).toBe('network_error');
      expect(logFormatted.details.isRecoverable).toBe(false);
    });

    it('should calculate retry delays correctly', async () => {
      // Requirement 3.1: Resilient registration process
      
      const retryableError = ProfileErrorFactory.createError('network_error');
      
      const delay1 = ProfileErrorUtils.getRetryDelay(retryableError, 1);
      const delay2 = ProfileErrorUtils.getRetryDelay(retryableError, 2);
      const delay3 = ProfileErrorUtils.getRetryDelay(retryableError, 3);
      const delay10 = ProfileErrorUtils.getRetryDelay(retryableError, 10);
      
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay10).toBeLessThanOrEqual(30000); // Max delay cap
    });

    it('should identify errors requiring user attention', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      const ownerMismatchError = ProfileErrorFactory.createError('owner_mismatch');
      const networkError = ProfileErrorFactory.createError('network_error');
      const accountNotFoundError = ProfileErrorFactory.createError('account_not_found');
      
      expect(ProfileErrorUtils.requiresUserAttention(ownerMismatchError)).toBe(true);
      expect(ProfileErrorUtils.requiresUserAttention(networkError)).toBe(false);
      expect(ProfileErrorUtils.requiresUserAttention(accountNotFoundError)).toBe(false);
    });

    it('should calculate error priorities correctly', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      const criticalError = ProfileErrorFactory.createError('owner_mismatch');
      const highError = ProfileErrorFactory.createError('size_mismatch');
      const mediumError = ProfileErrorFactory.createError('network_error');
      const lowError = ProfileErrorFactory.createError('account_not_found');
      
      const criticalPriority = ProfileErrorUtils.getErrorPriority(criticalError);
      const highPriority = ProfileErrorUtils.getErrorPriority(highError);
      const mediumPriority = ProfileErrorUtils.getErrorPriority(mediumError);
      const lowPriority = ProfileErrorUtils.getErrorPriority(lowError);
      
      expect(criticalPriority).toBeGreaterThan(highPriority);
      expect(highPriority).toBeGreaterThan(mediumPriority);
      expect(mediumPriority).toBeGreaterThan(lowPriority);
    });
  });

  describe('Recovery Safety Checks', () => {
    it('should perform comprehensive safety checks', async () => {
      // Requirement 3.1: Resilient registration process
      
      // Test safe recovery scenario
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const safetyCheck = await recoveryService.isRecoverySafe(mockUserPubkey);
      
      expect(safetyCheck.isSafe).toBe(true);
      expect(safetyCheck.reason).toBe('Recovery appears safe to attempt');
      expect(safetyCheck.warnings).toHaveLength(0);

      // Test unsafe recovery scenario
      const wrongOwner = new PublicKey('11111111111111111111111111111112');
      const unsafeAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: wrongOwner,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(unsafeAccountInfo);

      const unsafeSafetyCheck = await recoveryService.isRecoverySafe(mockUserPubkey);
      
      expect(unsafeSafetyCheck.isSafe).toBe(false);
      expect(unsafeSafetyCheck.reason).toContain('incorrect owner');
    });

    it('should warn about data loss during recovery', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Account with data that might be lost
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      // Fill with some data to simulate existing content
      mockAccountInfo.data.fill(0x42);

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      const safetyCheck = await recoveryService.isRecoverySafe(mockUserPubkey);
      
      expect(safetyCheck.isSafe).toBe(true);
      expect(safetyCheck.warnings).toContain('Account contains data that may be lost during recovery');
    });
  });
});