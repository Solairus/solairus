/**
 * Profile Integration Tests
 * 
 * Comprehensive integration tests for profile validation and recovery
 * with registration flow scenarios.
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
  createProfileAccountValidator,
  createAccountRecoveryService,
  type ValidationResult,
  type RecoveryResult,
  type AccountFailureClassification,
} from '../index';
import { UserProfile } from '@/lib/solairus-main';

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

describe('Profile Integration Tests', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockConnection: Connection;
  let validator: ProfileAccountValidator;
  let recoveryService: AccountRecoveryService;
  
  const mockUserPubkey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockSponsorPubkey = new PublicKey('5YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockProfilePda = new PublicKey('6YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockProgramId = new PublicKey('7YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

  const mockValidUserProfile: UserProfile = {
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
  };

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

  describe('Registration Flow with Account Recovery', () => {
    it('should handle new user registration successfully', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: No existing account
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);
      
      // Mock successful registration
      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockResolvedValue('mock-registration-tx');

      // Test validation before registration
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Profile account does not exist');
      expect(validationResult.suggestedAction).toBe('recreate');
      expect(validationResult.canRecover).toBe(true);

      // Test account recovery (which will create new account)
      const recoveryResult = await recoveryService.recreateAccount(mockUserPubkey, mockSponsorPubkey);
      
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.action).toBe('recreated');
      expect(recoveryResult.transactionSignature).toBe('mock-registration-tx');
      expect(solairusMain.registerUser).toHaveBeenCalledWith(
        mockProgram,
        mockUserPubkey,
        mockSponsorPubkey,
        mockSponsorPubkey,
        mockSponsorPubkey
      );
    });

    it('should handle existing valid account correctly', async () => {
      // Requirement 3.1: Handle account state inconsistencies
      
      // Setup: Valid existing account
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockValidUserProfile);

      // Test validation
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.suggestedAction).toBe('none');
      expect(validationResult.accountInfo?.exists).toBe(true);
      expect(validationResult.accountInfo?.canDeserialize).toBe(true);

      // Test that recovery is not needed
      const recoveryRecommendations = await recoveryService.getRecoveryRecommendations(mockUserPubkey);
      
      expect(recoveryRecommendations.canRecover).toBe(true);
      expect(recoveryRecommendations.riskLevel).toBe('low');
    });

    it('should recover from size mismatch errors', async () => {
      // Requirement 2.1: Comprehensive error handling and logging
      
      // Setup: Account with wrong size
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test validation detects size mismatch
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('size mismatch'))).toBe(true);
      expect(validationResult.suggestedAction).toBe('recreate');
      expect(validationResult.canRecover).toBe(true);

      // Test failure classification
      const classification = await recoveryService.classifyAccountFailure(mockProfilePda, validationResult);
      
      expect(classification.type).toBe('size_mismatch');
      expect(classification.severity).toBe('high');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.suggestedStrategy).toBe('close_and_recreate');

      // Test recovery attempt
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

    it('should handle deserialization failures with recovery', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Account exists but deserialization fails
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152), // Correct size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
        new Error('AccountDidNotDeserialize')
      );

      // Test validation detects deserialization failure
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('deserialized'))).toBe(true);
      expect(validationResult.canRecover).toBe(true);

      // Test failure classification
      const classification = await recoveryService.classifyAccountFailure(mockProfilePda, validationResult);
      
      expect(classification.type).toBe('data_corruption');
      expect(classification.severity).toBe('high');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.suggestedStrategy).toBe('close_and_recreate');

      // Test recovery
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

    it('should handle owner mismatch as non-recoverable', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Account with wrong owner
      const wrongOwner = new PublicKey('11111111111111111111111111111112');
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: wrongOwner,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test validation detects owner mismatch
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('owner mismatch'))).toBe(true);
      expect(validationResult.canRecover).toBe(false);

      // Test failure classification
      const classification = await recoveryService.classifyAccountFailure(mockProfilePda, validationResult);
      
      expect(classification.type).toBe('owner_mismatch');
      expect(classification.severity).toBe('critical');
      expect(classification.isRecoverable).toBe(false);
      expect(classification.suggestedStrategy).toBe('manual_intervention');

      // Test safety check
      const safetyCheck = await recoveryService.isRecoverySafe(mockUserPubkey);
      
      expect(safetyCheck.isSafe).toBe(false);
      expect(safetyCheck.reason).toContain('incorrect owner');
    });

    it('should handle multiple recovery attempts with exponential backoff', async () => {
      // Requirement 3.1: Resilient registration process
      
      // Setup: Account that fails recovery initially
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);
      
      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('RPC error'))
        .mockResolvedValueOnce('mock-success-tx');

      // Test recovery with retries
      const recoveryResult = await recoveryService.attemptAccountRecovery(
        mockUserPubkey,
        mockSponsorPubkey,
        3
      );
      
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.action).toBe('recreated');
      expect(recoveryResult.transactionSignature).toBe('mock-success-tx');
      expect(solairusMain.registerUser).toHaveBeenCalledTimes(3);
    });

    it('should provide comprehensive diagnostic information', async () => {
      // Requirement 2.1: Comprehensive error handling and logging
      
      // Setup: Account with various issues
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test diagnostic information
      const diagnosticInfo = await validator.getDiagnosticInfo(mockUserPubkey);
      
      expect(diagnosticInfo.userPubkey).toBe(mockUserPubkey.toString());
      expect(diagnosticInfo.derivedPda).toBe(mockProfilePda.toString());
      expect(diagnosticInfo.accountExists).toBe(true);
      expect(diagnosticInfo.accountInfo).toBeDefined();
      expect(diagnosticInfo.accountInfo?.size).toBe(100);
      expect(diagnosticInfo.validationResult).toBeDefined();
      expect(diagnosticInfo.validationResult.isValid).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Network error during validation
      vi.mocked(mockConnection.getAccountInfo).mockRejectedValue(
        new Error('Network connection failed')
      );

      // Test validation handles network errors
      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('Validation failed'))).toBe(true);
      expect(validationResult.canRecover).toBe(true);
      expect(validationResult.suggestedAction).toBe('retry');

      // Test recovery recommendations handle network errors
      const recommendations = await recoveryService.getRecoveryRecommendations(mockUserPubkey);
      
      expect(recommendations.canRecover).toBe(true);
      expect(recommendations.recommendedAction).toBe('Retry the operation');
      expect(recommendations.riskLevel).toBe('medium');
    });

    it('should validate PDA derivation correctly', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Test successful PDA derivation
      const pdaValidation = await validator.validatePdaDerivation(mockUserPubkey);
      
      expect(pdaValidation.isValid).toBe(true);
      expect(pdaValidation.derivedPda).toEqual(mockProfilePda);
      expect(pdaValidation.error).toBeUndefined();

      // Test failed PDA derivation
      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.derivePdas).mockReturnValueOnce({
        config: mockProfilePda,
        vault: mockProfilePda,
        profile: null, // Failed derivation
        counter: mockProfilePda,
      });

      const failedPdaValidation = await validator.validatePdaDerivation(mockUserPubkey);
      
      expect(failedPdaValidation.isValid).toBe(false);
      expect(failedPdaValidation.error).toBe('Failed to derive profile PDA');
    });

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
      vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockValidUserProfile);

      // Test concurrent validation requests
      const validationPromises = Array.from({ length: 5 }, () =>
        validator.validateAccountStructure(mockProfilePda)
      );

      const results = await Promise.all(validationPromises);
      
      // All validations should succeed
      results.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      // Connection should be called for each validation
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should create appropriate validation errors', async () => {
      // Requirement 2.1: Comprehensive error handling and logging
      
      const accountNotFoundError = validator.createValidationError(
        'account_not_found',
        mockProfilePda.toString()
      );
      
      expect(accountNotFoundError.type).toBe('account_not_found');
      expect(accountNotFoundError.message).toBe('User profile account does not exist. Registration is required.');
      expect(accountNotFoundError.isRecoverable).toBe(true);
      expect(accountNotFoundError.retryable).toBe(false);
      expect(accountNotFoundError.technicalDetails.accountAddress).toBe(mockProfilePda.toString());
      expect(accountNotFoundError.technicalDetails.suggestedFix).toBe('Complete user registration to create profile account');

      const deserializationError = validator.createValidationError(
        'deserialization_failed',
        mockProfilePda.toString(),
        { expectedStructure: 'UserProfile', actualData: 'corrupted' }
      );
      
      expect(deserializationError.type).toBe('deserialization_failed');
      expect(deserializationError.technicalDetails.expectedStructure).toBe('UserProfile');
      expect(deserializationError.technicalDetails.actualData).toBe('corrupted');
    });

    it('should handle recovery context properly', async () => {
      // Requirement 3.1: Resilient registration process
      
      // Setup: Failed validation
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const validationResult: ValidationResult = {
        isValid: false,
        errors: ['Account not found'],
        warnings: [],
        canRecover: true,
        suggestedAction: 'recreate',
      };

      const classification = await recoveryService.classifyAccountFailure(mockProfilePda, validationResult);
      
      const recoveryContext = recoveryService.createRecoveryContext(
        mockUserPubkey,
        mockSponsorPubkey,
        validationResult,
        classification
      );
      
      expect(recoveryContext.userPubkey).toEqual(mockUserPubkey);
      expect(recoveryContext.sponsor).toEqual(mockSponsorPubkey);
      expect(recoveryContext.profilePda).toEqual(mockProfilePda);
      expect(recoveryContext.failureClassification).toEqual(classification);
      expect(recoveryContext.validationResult).toEqual(validationResult);
      expect(recoveryContext.attemptCount).toBe(0);
    });

    it('should handle timeout scenarios during recovery', async () => {
      // Requirement 2.1: Comprehensive error handling
      
      // Setup: Slow network responses
      vi.mocked(mockConnection.getAccountInfo).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(null), 100))
      );

      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('mock-tx'), 100))
      );

      // Test recovery with reasonable timeout
      const startTime = Date.now();
      const recoveryResult = await recoveryService.attemptAccountRecovery(
        mockUserPubkey,
        mockSponsorPubkey,
        1
      );
      const endTime = Date.now();
      
      expect(recoveryResult.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete reasonably quickly
    });
  });

  describe('Integration with License Service Flow', () => {
    it('should integrate with registration flow validation', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Simulate license service pre-registration validation
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      // Test pre-registration validation
      const accountExists = await validator.checkAccountExists(mockProfilePda);
      expect(accountExists).toBe(false);

      const validationResult = await validator.validateAccountStructure(mockProfilePda);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.suggestedAction).toBe('recreate');

      // Test recovery recommendations
      const recommendations = await recoveryService.getRecoveryRecommendations(mockUserPubkey);
      expect(recommendations.canRecover).toBe(true);
      expect(recommendations.recommendedAction).toBe('Create new profile account');

      // Test safety check
      const safetyCheck = await recoveryService.isRecoverySafe(mockUserPubkey);
      expect(safetyCheck.isSafe).toBe(true);
      expect(safetyCheck.reason).toBe('Recovery appears safe to attempt');
    });

    it('should handle post-registration validation scenarios', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors
      
      // Setup: Account created but needs validation
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockValidUserProfile);

      // Test post-registration validation
      const accountValidation = await validator.validateAccountData(mockProfilePda);
      
      expect(accountValidation.exists).toBe(true);
      expect(accountValidation.canDeserialize).toBe(true);
      expect(accountValidation.hasCorrectSize).toBe(true);
      expect(accountValidation.structureMatches).toBe(true);
      expect(accountValidation.errorDetails).toBeUndefined();

      // Test complete structure validation
      const structureValidation = await validator.validateAccountStructure(mockProfilePda);
      
      expect(structureValidation.isValid).toBe(true);
      expect(structureValidation.errors).toHaveLength(0);
      expect(structureValidation.warnings).toHaveLength(0);
      expect(structureValidation.suggestedAction).toBe('none');
    });
  });
});