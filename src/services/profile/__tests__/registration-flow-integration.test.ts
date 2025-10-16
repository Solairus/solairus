/**
 * Registration Flow Integration Tests
 * 
 * Tests for integration between profile validation/recovery services
 * and the license service registration flow.
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
  EnhancedProfileServiceManager,
  createProfileAccountValidator,
  createAccountRecoveryService,
  createEnhancedProfileServiceManager,
  type ValidationResult,
  type RecoveryResult,
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

describe('Registration Flow Integration Tests', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockConnection: Connection;
  let validator: ProfileAccountValidator;
  let recoveryService: AccountRecoveryService;
  let serviceManager: EnhancedProfileServiceManager;

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
    serviceManager = createEnhancedProfileServiceManager(mockProgram, mockProvider);

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

  describe('Profile Validation and Recovery Integration', () => {
    it('should validate profile and detect missing account', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors

      // Setup: No existing account
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      // Test profile validation through service manager
      const validationResult = await serviceManager.validateProfile(mockUserPubkey);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.canRecover).toBe(true);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.error?.type).toBe('account_not_found');
      expect(validationResult.suggestedAction).toBe('recreate');
    });

    it('should validate existing valid accounts', async () => {
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

      // Test profile validation
      const validationResult = await serviceManager.validateProfile(mockUserPubkey);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.canRecover).toBe(false);
      expect(validationResult.suggestedAction).toBe('none');
      expect(validationResult.error).toBeUndefined();
    });

    it('should detect invalid accounts requiring recovery', async () => {
      // Requirement 2.1: Comprehensive error handling and logging

      // Setup: Invalid existing account (size mismatch)
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);

      // Test profile validation
      const validationResult = await serviceManager.validateProfile(mockUserPubkey);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.canRecover).toBe(true);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.error?.type).toBe('size_mismatch');
      expect(validationResult.suggestedAction).toBe('recreate');
    });

    it('should handle PDA derivation failures', async () => {
      // Requirement 1.1: Profile account creation without deserialization errors

      // Setup: PDA derivation failure
      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.derivePdas).mockReturnValue({
        config: mockProfilePda,
        vault: mockProfilePda,
        profile: null, // Failed derivation
        counter: mockProfilePda,
      });

      // Test profile validation handles PDA failure
      const validationResult = await serviceManager.validateProfile(mockUserPubkey);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.canRecover).toBe(false);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.error?.type).toBe('pda_derivation_failed');
      expect(validationResult.suggestedAction).toBe('Contact support for PDA derivation issues');
    });
  });

  describe('Profile Recovery Flow', () => {
    it('should recover profile successfully', async () => {
      // Requirement 3.1: Resilient registration process

      // Setup: Account needs recovery
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockResolvedValue('mock-recovery-tx');

      // Test profile recovery
      const recoveryResult = await serviceManager.recoverProfile(mockUserPubkey, mockSponsorPubkey);

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.transactionSignature).toBe('mock-recovery-tx');
      expect(recoveryResult.error).toBeUndefined();
    });

    it('should handle recovery failures', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Setup: Recovery fails
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockRejectedValue(new Error('Recovery failed'));

      // Test profile recovery failure
      const recoveryResult = await serviceManager.recoverProfile(mockUserPubkey, mockSponsorPubkey);

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.error).toBeDefined();
      expect(recoveryResult.error?.type).toBe('recovery_failed');
      expect(recoveryResult.transactionSignature).toBeUndefined();
    });

    it('should handle recovery with network errors', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Setup: Network error during recovery
      vi.mocked(mockConnection.getAccountInfo).mockRejectedValue(new Error('Network timeout'));

      // Test profile recovery with network error
      const recoveryResult = await serviceManager.recoverProfile(mockUserPubkey, mockSponsorPubkey);

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.error).toBeDefined();
      expect(recoveryResult.error?.type).toBe('network_error');
    });
  });

  describe('Diagnostic and Error Handling', () => {
    it('should generate comprehensive diagnostic report', async () => {
      // Requirement 2.1: Comprehensive error handling and logging

      // Setup: Valid account for diagnostics
      const mockAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(mockAccountInfo);
      vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockValidUserProfile);

      // Test diagnostic report generation
      const diagnosticReport = await serviceManager.getDiagnosticReport(mockUserPubkey);

      expect(diagnosticReport.profileDiagnostics).toBeDefined();
      expect(diagnosticReport.pdaDiagnostics).toBeDefined();
      expect(diagnosticReport.recentLogs).toBeDefined();
      expect(diagnosticReport.operationTraces).toBeDefined();
      expect(diagnosticReport.profileDiagnostics.userPubkey).toBe(mockUserPubkey.toString());
    });

    it('should format errors for user display', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Setup: Create a profile error
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const validationResult = await serviceManager.validateProfile(mockUserPubkey);
      expect(validationResult.error).toBeDefined();

      // Test error formatting
      const formattedError = serviceManager.formatErrorForUser(validationResult.error!);

      expect(formattedError.title).toBeDefined();
      expect(formattedError.message).toBeDefined();
      expect(formattedError.actions).toBeDefined();
      expect(formattedError.severity).toBeDefined();
      expect(formattedError.canRetry).toBeDefined();
      expect(formattedError.canRecover).toBeDefined();
    });

    it('should export diagnostic data', async () => {
      // Requirement 2.1: Comprehensive error handling and logging

      // Test diagnostic data export
      const diagnosticData = serviceManager.exportDiagnosticData(mockUserPubkey);

      expect(diagnosticData).toBeDefined();
      expect(typeof diagnosticData).toBe('object');
    });

    it('should clear diagnostic data', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Test diagnostic data clearing
      expect(() => serviceManager.clearDiagnosticData()).not.toThrow();
    });
  });

  describe('Integration Utility Functions', () => {
    it('should validate and recover profile when needed', async () => {
      // Requirement 3.1: Resilient registration process

      // Setup: Invalid account that can be recovered
      const mockInvalidAccountInfo: AccountInfo<Buffer> = {
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        owner: mockProgramId,
        rentEpoch: 0,
      };

      vi.mocked(mockConnection.getAccountInfo)
        .mockResolvedValueOnce(mockInvalidAccountInfo) // Initial validation
        .mockResolvedValueOnce(null) // During recovery
        .mockResolvedValueOnce({ // After recovery
          data: Buffer.alloc(152),
          executable: false,
          lamports: 1000000,
          owner: mockProgramId,
          rentEpoch: 0,
        });

      const solairusMain = await import('@/lib/solairus-main');
      vi.mocked(solairusMain.registerUser).mockResolvedValue('mock-recovery-tx');

      vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockValidUserProfile);

      // Test validate and recover utility
      const { ProfileIntegrationUtils } = await import('../profile-integration-utils');
      const result = await ProfileIntegrationUtils.validateAndRecover(
        serviceManager,
        mockUserPubkey,
        mockSponsorPubkey
      );

      expect(result.isValid).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.transactionSignature).toBe('mock-recovery-tx');
      expect(result.error).toBeUndefined();
    });

    it('should handle profile operations with automatic retry', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Setup: Operation that fails then succeeds
      let attemptCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        return Promise.resolve('success');
      });

      // Test operation handling with retry
      const { ProfileIntegrationUtils } = await import('../profile-integration-utils');
      const result = await ProfileIntegrationUtils.handleProfileOperation(
        mockOperation,
        {
          userPubkey: mockUserPubkey.toString(),
          operation: 'test_operation',
          attemptCount: 1,
          environment: 'development',
        },
        3
      );

      expect(result.result).toBe('success');
      expect(result.recovered).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should create user-friendly error messages', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Setup: Create an error
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const validationResult = await serviceManager.validateProfile(mockUserPubkey);
      expect(validationResult.error).toBeDefined();

      // Test user-friendly error creation
      const { ProfileIntegrationUtils } = await import('../profile-integration-utils');
      const userFriendlyMessage = ProfileIntegrationUtils.createUserFriendlyError(validationResult.error!);

      expect(userFriendlyMessage).toBeDefined();
      expect(typeof userFriendlyMessage).toBe('string');
      expect(userFriendlyMessage.length).toBeGreaterThan(0);
      expect(userFriendlyMessage).toContain('Profile Not Found');
    });

    it('should identify errors requiring user attention', async () => {
      // Requirement 2.1: Comprehensive error handling

      // Setup: Create different types of errors
      vi.mocked(mockConnection.getAccountInfo).mockResolvedValue(null);

      const validationResult = await serviceManager.validateProfile(mockUserPubkey);
      expect(validationResult.error).toBeDefined();

      // Test user attention requirement check
      const { ProfileIntegrationUtils } = await import('../profile-integration-utils');
      const requiresAttention = ProfileIntegrationUtils.requiresUserAttention(validationResult.error!);

      expect(typeof requiresAttention).toBe('boolean');
      // Account not found should not require immediate user attention (can be auto-recovered)
      expect(requiresAttention).toBe(false);
    });
  });
});