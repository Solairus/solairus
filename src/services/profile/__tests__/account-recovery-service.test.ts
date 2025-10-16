import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { 
  AccountRecoveryService, 
  createAccountRecoveryService,
  type RecoveryResult,
  type AccountFailureClassification 
} from '../account-recovery-service';
import { ProfileAccountValidator } from '../profile-account-validator';

// Mock dependencies
vi.mock('@/lib/solairus-main', () => ({
  derivePdas: vi.fn(() => ({
    profile: PublicKey.default,
  })),
  getErrorMessage: vi.fn((error) => error?.message || String(error)),
  registerUser: vi.fn(() => Promise.resolve('mock-tx-signature')),
  PROGRAM_ID: PublicKey.default,
}));

describe('AccountRecoveryService', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockValidator: ProfileAccountValidator;
  let recoveryService: AccountRecoveryService;
  let userPubkey: PublicKey;
  let sponsorPubkey: PublicKey;

  beforeEach(() => {
    // Create mock objects
    mockProgram = {
      programId: PublicKey.default,
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
    } as unknown as anchor.Program;

    mockProvider = {
      connection: {
        getAccountInfo: vi.fn(),
      },
    } as unknown as anchor.AnchorProvider;

    mockValidator = {
      validateAccountStructure: vi.fn(),
      checkAccountExists: vi.fn(),
      validateAccountData: vi.fn(),
    } as unknown as ProfileAccountValidator;

    recoveryService = new AccountRecoveryService(mockProgram, mockProvider, mockValidator);
    userPubkey = PublicKey.default;
    sponsorPubkey = PublicKey.default;
  });

  describe('classifyAccountFailure', () => {
    it('should classify account not found correctly', async () => {
      const profilePda = PublicKey.default;
      const validationResult = {
        isValid: false,
        errors: ['Account not found'],
        warnings: [],
        canRecover: true,
        suggestedAction: 'recreate' as const,
      };

      vi.mocked(mockValidator.checkAccountExists).mockResolvedValue(false);

      const classification = await recoveryService.classifyAccountFailure(profilePda, validationResult);

      expect(classification.type).toBe('not_found');
      expect(classification.severity).toBe('low');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.suggestedStrategy).toBe('recreate');
    });

    it('should classify size mismatch correctly', async () => {
      const profilePda = PublicKey.default;
      const validationResult = {
        isValid: false,
        errors: ['Size mismatch'],
        warnings: [],
        canRecover: true,
        suggestedAction: 'recreate' as const,
      };

      vi.mocked(mockValidator.checkAccountExists).mockResolvedValue(true);
      vi.mocked(mockProvider.connection.getAccountInfo).mockResolvedValue({
        owner: mockProgram.programId,
        data: Buffer.alloc(100), // Wrong size
        executable: false,
        lamports: 1000000,
        rentEpoch: 0,
      });

      const classification = await recoveryService.classifyAccountFailure(profilePda, validationResult);

      expect(classification.type).toBe('size_mismatch');
      expect(classification.severity).toBe('high');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.suggestedStrategy).toBe('close_and_recreate');
    });

    it('should classify owner mismatch correctly', async () => {
      const profilePda = PublicKey.default;
      const validationResult = {
        isValid: false,
        errors: ['Owner mismatch'],
        warnings: [],
        canRecover: false,
        suggestedAction: 'recreate' as const,
      };

      const wrongOwner = new PublicKey('11111111111111111111111111111112'); // Different from default
      
      vi.mocked(mockValidator.checkAccountExists).mockResolvedValue(true);
      vi.mocked(mockProvider.connection.getAccountInfo).mockResolvedValue({
        owner: wrongOwner, // Wrong owner
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        rentEpoch: 0,
      });

      const classification = await recoveryService.classifyAccountFailure(profilePda, validationResult);

      expect(classification.type).toBe('owner_mismatch');
      expect(classification.severity).toBe('critical');
      expect(classification.isRecoverable).toBe(false);
      expect(classification.suggestedStrategy).toBe('manual_intervention');
    });
  });

  describe('recreateAccount', () => {
    it('should successfully recreate account', async () => {
      const result = await recoveryService.recreateAccount(userPubkey, sponsorPubkey);

      expect(result.success).toBe(true);
      expect(result.action).toBe('recreated');
      expect(result.transactionSignature).toBe('mock-tx-signature');
    });
  });

  describe('getRecoveryRecommendations', () => {
    it('should provide recovery recommendations', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Account not found'],
        warnings: [],
        canRecover: true,
        suggestedAction: 'recreate' as const,
      };

      vi.mocked(mockValidator.validateAccountStructure).mockResolvedValue(validationResult);
      vi.mocked(mockValidator.checkAccountExists).mockResolvedValue(false);

      const recommendations = await recoveryService.getRecoveryRecommendations(userPubkey);

      expect(recommendations.canRecover).toBe(true);
      expect(recommendations.recommendedAction).toBe('Create new profile account');
      expect(recommendations.riskLevel).toBe('low');
    });
  });

  describe('isRecoverySafe', () => {
    it('should determine recovery safety correctly', async () => {
      vi.mocked(mockValidator.checkAccountExists).mockResolvedValue(false);

      const safetyCheck = await recoveryService.isRecoverySafe(userPubkey);

      expect(safetyCheck.isSafe).toBe(true);
      expect(safetyCheck.reason).toBe('Recovery appears safe to attempt');
    });

    it('should detect unsafe recovery conditions', async () => {
      const wrongOwner = new PublicKey('11111111111111111111111111111112'); // Different from default
      
      vi.mocked(mockValidator.checkAccountExists).mockResolvedValue(true);
      vi.mocked(mockProvider.connection.getAccountInfo).mockResolvedValue({
        owner: wrongOwner, // Wrong owner
        data: Buffer.alloc(152),
        executable: false,
        lamports: 1000000,
        rentEpoch: 0,
      });

      const safetyCheck = await recoveryService.isRecoverySafe(userPubkey);

      expect(safetyCheck.isSafe).toBe(false);
      expect(safetyCheck.reason).toContain('incorrect owner');
    });
  });

  describe('createAccountRecoveryService factory', () => {
    it('should create service instance correctly', () => {
      const service = createAccountRecoveryService(mockProgram, mockProvider, mockValidator);
      expect(service).toBeInstanceOf(AccountRecoveryService);
    });
  });
});