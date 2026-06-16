/**
 * Admin Service Tests
 * 
 * Comprehensive tests for admin contract integration services
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  AdminService,
  TransactionService,
  AdminErrorService,
  IntegratedAdminService,
  AdminServiceFactory,
  createAdminService,
  createTransactionService,
  createIntegratedAdminService,
  AdminErrorCode,
  ErrorSeverity,
} from '../index';

// Mock the solairus-main module
vi.mock('@/lib/solairus-main', async () => {
  const actual = await vi.importActual('@/lib/solairus-main');
  return {
    ...actual,
    getProgram: vi.fn(),
    derivePdas: vi.fn(),
  };
});

describe('Admin Service Integration Tests', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockConnection: anchor.web3.Connection;
  let adminService: AdminService;
  let transactionService: TransactionService;
  let errorService: AdminErrorService;
  let integratedService: IntegratedAdminService;

  const mockUserPubkey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockSponsorPubkey = new PublicKey('5YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockAuthorityPubkey = new PublicKey('6YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockConfigPda = new PublicKey('7YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
  const mockProfilePda = new PublicKey('8YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock connection
    mockConnection = {
      getSignatureStatus: vi.fn(),
      getTransaction: vi.fn(),
      getAccountInfo: vi.fn(),
    } as unknown as anchor.web3.Connection;

    // Mock program
    mockProgram = {
      methods: {
        activateLicenseManual: vi.fn(() => ({
          accounts: vi.fn(() => ({
            rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
          })),
        })),
        creditUserBalance: vi.fn(() => ({
          accounts: vi.fn(() => ({
            rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
          })),
        })),
        updateUserProfile: vi.fn(() => ({
          accounts: vi.fn(() => ({
            rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
          })),
        })),
      },
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
        config: {
          fetch: vi.fn(),
        },
      },
    } as unknown as anchor.Program;

    // Mock provider
    mockProvider = {
      connection: mockConnection,
      publicKey: mockAuthorityPubkey,
    } as unknown as anchor.AnchorProvider;

    // Mock derivePdas
    const solairusMain = await import('@/lib/solairus-main');
    vi.mocked(solairusMain.getProgram).mockReturnValue(mockProgram);
    vi.mocked(solairusMain.derivePdas).mockReturnValue({
      config: mockConfigPda,
      vault: mockConfigPda,
      profile: mockProfilePda,
      counter: mockConfigPda,
    });

    // Initialize services
    adminService = createAdminService(mockProvider);
    transactionService = createTransactionService(mockConnection);
    errorService = new AdminErrorService();
    integratedService = createIntegratedAdminService(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AdminService', () => {
    describe('activateLicenseManual', () => {
      it('should successfully activate license for new user', async () => {
        // Setup: User profile doesn't exist (new user)
        vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
          new Error('Account not found')
        );

        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 30,
          extendExisting: false,
          authority: mockAuthorityPubkey,
        };

        const result = await adminService.activateLicenseManual(params);

        expect(result.txSignature).toBe('mock-tx-signature');
        expect(result.userPubkey).toEqual(mockUserPubkey);
        expect(result.sponsorPubkey).toEqual(mockSponsorPubkey);
        expect(result.durationDays).toBe(30);
        expect(result.wasNewUser).toBe(true);
        expect(result.extendExisting).toBe(false);
        expect(result.licenseExpiresAt).toBeInstanceOf(Date);
      });

      it('should successfully extend existing license', async () => {
        // Setup: User profile exists with active license
        const existingProfile = {
          user: mockUserPubkey,
          licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 86400), // 1 day from now
        };
        vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(existingProfile);

        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 30,
          extendExisting: true,
          authority: mockAuthorityPubkey,
        };

        const result = await adminService.activateLicenseManual(params);

        expect(result.txSignature).toBe('mock-tx-signature');
        expect(result.wasNewUser).toBe(false);
        expect(result.extendExisting).toBe(true);
        expect(result.previousExpiration).toBeInstanceOf(Date);
      });

      it('should throw error for invalid duration', async () => {
        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 0, // Invalid duration
          extendExisting: false,
          authority: mockAuthorityPubkey,
        };

        await expect(adminService.activateLicenseManual(params)).rejects.toThrow(
          'Duration days must be greater than 0'
        );
      });

      it('should handle contract errors gracefully', async () => {
        // Setup: Contract throws unauthorized error
        vi.mocked(mockProgram.methods.activateLicenseManual).mockImplementation(() => ({
          accounts: vi.fn(() => ({
            rpc: vi.fn().mockRejectedValue(new Error('Unauthorized')),
          })),
        }));

        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 30,
          extendExisting: false,
          authority: mockAuthorityPubkey,
        };

        await expect(adminService.activateLicenseManual(params)).rejects.toThrow(
          'You are not authorized to perform this action'
        );
      });
    });

    describe('creditUserBalance', () => {
      it('should successfully credit user balance for new user', async () => {
        // Setup: User profile doesn't exist (new user)
        vi.mocked(mockProgram.account.userProfile.fetch)
          .mockRejectedValueOnce(new Error('Account not found')) // First call (check if exists)
          .mockResolvedValueOnce({ // Second call (after creation)
            user: mockUserPubkey,
            creditBalance: new anchor.BN(1000),
          });

        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          amount: 1000,
          isDebit: false,
          authority: mockAuthorityPubkey,
        };

        const result = await adminService.creditUserBalance(params);

        expect(result.txSignature).toBe('mock-tx-signature');
        expect(result.userPubkey).toEqual(mockUserPubkey);
        expect(result.amount).toBe(1000);
        expect(result.isDebit).toBe(false);
        expect(result.wasNewUser).toBe(true);
        expect(result.balanceAfter).toBe(1000);
      });

      it('should successfully debit user balance for existing user', async () => {
        // Setup: User profile exists
        const existingProfile = {
          user: mockUserPubkey,
          creditBalance: new anchor.BN(2000),
        };
        vi.mocked(mockProgram.account.userProfile.fetch)
          .mockResolvedValueOnce(existingProfile) // First call (check if exists)
          .mockResolvedValueOnce({ // Second call (after update)
            ...existingProfile,
            creditBalance: new anchor.BN(1500),
          });

        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          amount: 500,
          isDebit: true,
          authority: mockAuthorityPubkey,
        };

        const result = await adminService.creditUserBalance(params);

        expect(result.txSignature).toBe('mock-tx-signature');
        expect(result.amount).toBe(500);
        expect(result.isDebit).toBe(true);
        expect(result.wasNewUser).toBe(false);
        expect(result.balanceAfter).toBe(1500);
      });

      it('should throw error for invalid amount', async () => {
        const params = {
          provider: mockProvider,
          userPubkey: mockUserPubkey,
          amount: 0, // Invalid amount
          isDebit: false,
          authority: mockAuthorityPubkey,
        };

        await expect(adminService.creditUserBalance(params)).rejects.toThrow(
          'Amount must be greater than 0'
        );
      });
    });

    describe('getUserProfile', () => {
      it('should return user profile for existing user', async () => {
        const mockProfile = {
          user: mockUserPubkey,
          sponsor: mockSponsorPubkey,
          createdAt: new anchor.BN(Date.now() / 1000),
          activePrincipalUsdt: new anchor.BN(5000),
          lastRoiWithdrawAt: new anchor.BN(0),
          licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 86400),
          totalAffiliateEarnings: new anchor.BN(1000),
          totalAffiliateWithdrawn: new anchor.BN(500),
          level1Earnings: new anchor.BN(300),
          level2Earnings: new anchor.BN(200),
          level3Earnings: new anchor.BN(100),
          creditBalance: new anchor.BN(2000),
        };

        vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockProfile);

        const result = await adminService.getUserProfile(mockUserPubkey);

        expect(result).toBeDefined();
        expect(result!.user).toEqual(mockUserPubkey);
        expect(result!.sponsor).toEqual(mockSponsorPubkey);
        expect(result!.activePrincipalUsdt).toBe(5000);
        expect(result!.creditBalance).toBe(2000);
        expect(result!.createdAt).toBeInstanceOf(Date);
        expect(result!.licenseExpiresAt).toBeInstanceOf(Date);
      });

      it('should return null for non-existent user', async () => {
        vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
          new Error('Account not found')
        );

        const result = await adminService.getUserProfile(mockUserPubkey);

        expect(result).toBeNull();
      });

      it('should return null for uninitialized profile', async () => {
        const uninitializedProfile = {
          user: PublicKey.default, // Uninitialized
          sponsor: PublicKey.default,
          createdAt: new anchor.BN(0),
          activePrincipalUsdt: new anchor.BN(0),
          lastRoiWithdrawAt: new anchor.BN(0),
          licenseExpiresAt: new anchor.BN(0),
          totalAffiliateEarnings: new anchor.BN(0),
          totalAffiliateWithdrawn: new anchor.BN(0),
          level1Earnings: new anchor.BN(0),
          level2Earnings: new anchor.BN(0),
          level3Earnings: new anchor.BN(0),
          creditBalance: new anchor.BN(0),
        };

        vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(uninitializedProfile);

        const result = await adminService.getUserProfile(mockUserPubkey);

        expect(result).toBeNull();
      });
    });

    describe('hasActiveLicense', () => {
      it('should return true for user with active license', async () => {
        const mockProfile = {
          user: mockUserPubkey,
          sponsor: mockSponsorPubkey,
          createdAt: new anchor.BN(Date.now() / 1000),
          activePrincipalUsdt: new anchor.BN(0),
          lastRoiWithdrawAt: new anchor.BN(0),
          licenseExpiresAt: new anchor.BN(Date.now() / 1000 + 86400), // 1 day from now
          totalAffiliateEarnings: new anchor.BN(0),
          totalAffiliateWithdrawn: new anchor.BN(0),
          level1Earnings: new anchor.BN(0),
          level2Earnings: new anchor.BN(0),
          level3Earnings: new anchor.BN(0),
          creditBalance: new anchor.BN(0),
        };

        vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockProfile);

        const result = await adminService.hasActiveLicense(mockUserPubkey);

        expect(result).toBe(true);
      });

      it('should return false for user with expired license', async () => {
        const mockProfile = {
          user: mockUserPubkey,
          sponsor: mockSponsorPubkey,
          createdAt: new anchor.BN(Date.now() / 1000),
          activePrincipalUsdt: new anchor.BN(0),
          lastRoiWithdrawAt: new anchor.BN(0),
          licenseExpiresAt: new anchor.BN(Date.now() / 1000 - 86400), // 1 day ago
          totalAffiliateEarnings: new anchor.BN(0),
          totalAffiliateWithdrawn: new anchor.BN(0),
          level1Earnings: new anchor.BN(0),
          level2Earnings: new anchor.BN(0),
          level3Earnings: new anchor.BN(0),
          creditBalance: new anchor.BN(0),
        };

        vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockProfile);

        const result = await adminService.hasActiveLicense(mockUserPubkey);

        expect(result).toBe(false);
      });

      it('should return false for non-existent user', async () => {
        vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
          new Error('Account not found')
        );

        const result = await adminService.hasActiveLicense(mockUserPubkey);

        expect(result).toBe(false);
      });
    });
  });

  describe('TransactionService', () => {
    describe('executeWithRetry', () => {
      it('should succeed on first attempt', async () => {
        const operation = vi.fn().mockResolvedValue('success');

        const result = await transactionService.executeWithRetry(operation);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and eventually succeed', async () => {
        const operation = vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce('success');

        const result = await transactionService.executeWithRetry(operation, {
          maxAttempts: 3,
          baseDelay: 10, // Short delay for testing
        });

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(3);
      });

      it('should fail after max attempts', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Persistent error'));

        await expect(
          transactionService.executeWithRetry(operation, {
            maxAttempts: 2,
            baseDelay: 10,
          })
        ).rejects.toThrow('Persistent error');

        expect(operation).toHaveBeenCalledTimes(2);
      });

      it('should not retry non-retryable errors', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Unauthorized'));

        await expect(
          transactionService.executeWithRetry(operation, {
            maxAttempts: 3,
            baseDelay: 10,
          })
        ).rejects.toThrow('Unauthorized');

        expect(operation).toHaveBeenCalledTimes(1);
      });
    });

    describe('confirmTransaction', () => {
      it('should confirm successful transaction', async () => {
        vi.mocked(mockConnection.getSignatureStatus).mockResolvedValue({
          context: { slot: 123 },
          value: {
            confirmations: 1,
            err: null,
            slot: 123,
            confirmationStatus: 'confirmed',
          },
        });

        const result = await transactionService.confirmTransaction('mock-signature', {
          maxRetries: 1,
          retryDelay: 10,
        });

        expect(result.status).toBe('confirmed');
        expect(result.signature).toBe('mock-signature');
        expect(result.confirmations).toBe(1);
      });

      it('should handle failed transaction', async () => {
        vi.mocked(mockConnection.getSignatureStatus).mockResolvedValue({
          context: { slot: 123 },
          value: {
            confirmations: null,
            err: { InstructionError: [0, 'Custom error'] },
            slot: 123,
            confirmationStatus: null,
          },
        });

        const result = await transactionService.confirmTransaction('mock-signature', {
          maxRetries: 1,
          retryDelay: 10,
        });

        expect(result.status).toBe('failed');
        expect(result.error).toContain('Transaction failed');
      });

      it('should timeout after max retries', async () => {
        vi.mocked(mockConnection.getSignatureStatus).mockResolvedValue({
          context: { slot: 123 },
          value: null, // Transaction not found
        });

        const result = await transactionService.confirmTransaction('mock-signature', {
          maxRetries: 2,
          retryDelay: 10,
          timeout: 100,
        });

        expect(result.status).toBe('timeout');
      });
    });
  });

  describe('AdminErrorService', () => {
    describe('classifyError', () => {
      it('should classify unauthorized errors correctly', () => {
        const error = new Error('Unauthorized access');
        const code = errorService.classifyError(error);
        expect(code).toBe(AdminErrorCode.UNAUTHORIZED);
      });

      it('should classify invalid amount errors correctly', () => {
        const error = new Error('Invalid amount provided');
        const code = errorService.classifyError(error);
        expect(code).toBe(AdminErrorCode.INVALID_AMOUNT);
      });

      it('should classify network errors correctly', () => {
        const error = new Error('Network connection failed');
        const code = errorService.classifyError(error);
        expect(code).toBe(AdminErrorCode.NETWORK_ERROR);
      });

      it('should default to unknown error for unrecognized errors', () => {
        const error = new Error('Some random error');
        const code = errorService.classifyError(error);
        expect(code).toBe(AdminErrorCode.UNKNOWN_ERROR);
      });
    });

    describe('formatErrorForUser', () => {
      it('should format unauthorized error for user display', () => {
        const error = new Error('Unauthorized');
        const formatted = errorService.formatErrorForUser(error);

        expect(formatted.title).toBe('Access Denied');
        expect(formatted.severity).toBe(ErrorSeverity.HIGH);
        expect(formatted.canRetry).toBe(false);
        expect(formatted.suggestedActions).toContain('Ensure you are connected with an authorized wallet');
      });

      it('should format validation error for user display', () => {
        const error = new Error('Invalid amount');
        const formatted = errorService.formatErrorForUser(error);

        expect(formatted.title).toBe('Invalid Amount');
        expect(formatted.severity).toBe(ErrorSeverity.LOW);
        expect(formatted.canRetry).toBe(true);
        expect(formatted.suggestedActions).toContain('Enter a positive number greater than 0');
      });
    });

    describe('isRetryable', () => {
      it('should identify retryable errors', () => {
        const networkError = new Error('Network timeout');
        expect(errorService.isRetryable(networkError)).toBe(true);

        const transactionError = new Error('Transaction failed');
        expect(errorService.isRetryable(transactionError)).toBe(true);
      });

      it('should identify non-retryable errors', () => {
        const unauthorizedError = new Error('Unauthorized');
        expect(errorService.isRetryable(unauthorizedError)).toBe(false);

        const validationError = new Error('Invalid amount');
        expect(errorService.isRetryable(validationError)).toBe(false);
      });
    });
  });

  describe('IntegratedAdminService', () => {
    describe('activateLicenseManual', () => {
      it('should successfully activate license with integrated service', async () => {
        // Mock successful transaction confirmation
        vi.mocked(mockConnection.getSignatureStatus).mockResolvedValue({
          context: { slot: 123 },
          value: {
            confirmations: 1,
            err: null,
            slot: 123,
            confirmationStatus: 'confirmed',
          },
        });

        const request = {
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 30,
          extendExisting: false,
        };

        const result = await integratedService.activateLicenseManual(request);

        expect(result.success).toBe(true);
        expect(result.transactionSignature).toBeDefined();
      });

      it('should handle validation errors', async () => {
        const request = {
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 0, // Invalid duration
          extendExisting: false,
        };

        const result = await integratedService.activateLicenseManual(request);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Duration must be greater than 0 days');
      });

      it('should skip validation when requested', async () => {
        // Mock successful transaction confirmation
        vi.mocked(mockConnection.getSignatureStatus).mockResolvedValue({
          context: { slot: 123 },
          value: {
            confirmations: 1,
            err: null,
            slot: 123,
            confirmationStatus: 'confirmed',
          },
        });

        const request = {
          userPubkey: mockUserPubkey,
          sponsorPubkey: mockSponsorPubkey,
          durationDays: 0, // Would normally be invalid
          extendExisting: false,
        };

        // This should still fail at the contract level since the contract validates duration
        const result = await integratedService.activateLicenseManual(request, {
          skipValidation: true,
        });

        // The result should fail because the contract itself validates the duration
        expect(result.success).toBe(false);
      });
    });

    describe('getUserProfile', () => {
      it('should successfully get user profile', async () => {
        const mockProfile = {
          user: mockUserPubkey,
          sponsor: mockSponsorPubkey,
          createdAt: new anchor.BN(Date.now() / 1000),
          activePrincipalUsdt: new anchor.BN(0),
          lastRoiWithdrawAt: new anchor.BN(0),
          licenseExpiresAt: new anchor.BN(0),
          totalAffiliateEarnings: new anchor.BN(0),
          totalAffiliateWithdrawn: new anchor.BN(0),
          level1Earnings: new anchor.BN(0),
          level2Earnings: new anchor.BN(0),
          level3Earnings: new anchor.BN(0),
          creditBalance: new anchor.BN(0),
        };

        vi.mocked(mockProgram.account.userProfile.fetch).mockResolvedValue(mockProfile);

        const result = await integratedService.getUserProfile(mockUserPubkey);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.user).toEqual(mockUserPubkey);
      });

      it('should handle errors when getting user profile', async () => {
        vi.mocked(mockProgram.account.userProfile.fetch).mockRejectedValue(
          new Error('Network error')
        );

        const result = await integratedService.getUserProfile(mockUserPubkey);

        // getUserProfile returns null for errors, not an error result
        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });
    });
  });

  describe('AdminServiceFactory', () => {
    it('should create complete admin service suite', () => {
      const services = AdminServiceFactory.createComplete(mockProvider);

      expect(services.integrated).toBeInstanceOf(IntegratedAdminService);
      expect(services.admin).toBeInstanceOf(AdminService);
      expect(services.transaction).toBeDefined();
      expect(services.error).toBeInstanceOf(AdminErrorService);
    });

    it('should create admin service with custom configuration', () => {
      const config = {
        retryAttempts: 5,
        timeout: 30000,
        confirmationLevel: 'finalized' as const,
      };

      const services = AdminServiceFactory.createWithConfig(mockProvider, config);

      expect(services.integrated).toBeInstanceOf(IntegratedAdminService);
      expect(services.transaction.getTransactionService().getRetryConfig().maxAttempts).toBe(5);
    });
  });

  describe('Utility Functions', () => {
    it('should create admin service instance', () => {
      const service = createAdminService(mockProvider);
      expect(service).toBeInstanceOf(AdminService);
    });

    it('should create transaction service instance', () => {
      const service = createTransactionService(mockConnection);
      expect(service).toBeInstanceOf(TransactionService);
    });

    it('should create integrated admin service instance', () => {
      const service = createIntegratedAdminService(mockProvider);
      expect(service).toBeInstanceOf(IntegratedAdminService);
    });
  });
});