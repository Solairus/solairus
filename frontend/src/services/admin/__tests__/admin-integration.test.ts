import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { 
  activateLicenseManual, 
  creditUserBalance, 
  updateUserSponsor,
  withdrawSystemBucket 
} from '../admin-service';

// Mock the solairus-main library
vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(),
  derivePdas: vi.fn(),
}));

// Mock anchor
vi.mock('@coral-xyz/anchor', () => ({
  BN: class MockBN {
    constructor(value: number | string) {
      this.value = typeof value === 'string' ? parseInt(value) : value;
    }
    toString() {
      return this.value.toString();
    }
    neg() {
      return new MockBN(-this.value);
    }
  },
  web3: {
    SystemProgram: {
      programId: new PublicKey('11111111111111111111111111111111'),
    },
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Admin Service Integration Tests', () => {
  const mockProvider = {
    connection: {},
    wallet: {},
    opts: {},
  } as any;

  const mockProgram = {
    methods: {
      activateLicenseManual: vi.fn(),
      creditUserBalance: vi.fn(),
      updateUserProfile: vi.fn(),
      withdrawSystemBucket: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock program methods to return chainable objects
    mockProgram.methods.activateLicenseManual.mockReturnValue({
      accounts: vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue('mock-signature'),
      }),
    });

    mockProgram.methods.creditUserBalance.mockReturnValue({
      accounts: vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue('mock-signature'),
      }),
    });

    mockProgram.methods.updateUserProfile.mockReturnValue({
      accounts: vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue('mock-signature'),
      }),
    });

    mockProgram.methods.withdrawSystemBucket.mockReturnValue({
      accounts: vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue('mock-signature'),
      }),
    });

    const { getProgram, derivePdas } = require('@/lib/solairus-main');
    getProgram.mockReturnValue(mockProgram);
    derivePdas.mockReturnValue({
      config: new PublicKey('11111111111111111111111111111111'),
      profile: new PublicKey('22222222222222222222222222222222'),
    });
  });

  describe('activateLicenseManual', () => {
    it('should activate license manually for existing user', async () => {
      const params = {
        userPubkey: new PublicKey('33333333333333333333333333333333'),
        sponsorPubkey: new PublicKey('44444444444444444444444444444444'),
        durationDays: 30,
        extendExisting: true,
      };

      const result = await activateLicenseManual(mockProvider, params);

      expect(result).toBe('mock-signature');
      expect(mockProgram.methods.activateLicenseManual).toHaveBeenCalledWith(
        params.userPubkey,
        params.sponsorPubkey,
        params.durationDays,
        params.extendExisting
      );
    });

    it('should activate license manually for new user', async () => {
      const params = {
        userPubkey: new PublicKey('33333333333333333333333333333333'),
        sponsorPubkey: new PublicKey('44444444444444444444444444444444'),
        durationDays: 60,
        extendExisting: false,
      };

      const result = await activateLicenseManual(mockProvider, params);

      expect(result).toBe('mock-signature');
      expect(mockProgram.methods.activateLicenseManual).toHaveBeenCalledWith(
        params.userPubkey,
        params.sponsorPubkey,
        params.durationDays,
        params.extendExisting
      );
    });

    it('should handle activation errors', async () => {
      mockProgram.methods.activateLicenseManual.mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error('Unauthorized')),
        }),
      });

      const params = {
        userPubkey: new PublicKey('33333333333333333333333333333333'),
        sponsorPubkey: new PublicKey('44444444444444444444444444444444'),
        durationDays: 30,
        extendExisting: true,
      };

      await expect(activateLicenseManual(mockProvider, params)).rejects.toThrow('Unauthorized');
    });
  });

  describe('creditUserBalance', () => {
    it('should credit user balance', async () => {
      const params = {
        userAddress: new PublicKey('33333333333333333333333333333333'),
        amount: 100,
        isDebit: false,
      };

      const result = await creditUserBalance(mockProvider, params);

      expect(result).toBe('mock-signature');
      expect(mockProgram.methods.creditUserBalance).toHaveBeenCalledWith(
        new anchor.BN(100)
      );
    });

    it('should debit user balance', async () => {
      const params = {
        userAddress: new PublicKey('33333333333333333333333333333333'),
        amount: 50,
        isDebit: true,
      };

      const result = await creditUserBalance(mockProvider, params);

      expect(result).toBe('mock-signature');
      expect(mockProgram.methods.creditUserBalance).toHaveBeenCalledWith(
        new anchor.BN(-50)
      );
    });

    it('should handle credit operation errors', async () => {
      mockProgram.methods.creditUserBalance.mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error('Insufficient funds')),
        }),
      });

      const params = {
        userAddress: new PublicKey('33333333333333333333333333333333'),
        amount: 1000,
        isDebit: true,
      };

      await expect(creditUserBalance(mockProvider, params)).rejects.toThrow('Insufficient funds');
    });
  });

  describe('updateUserSponsor', () => {
    it('should update user sponsor', async () => {
      const params = {
        userAddress: new PublicKey('33333333333333333333333333333333'),
        newSponsor: new PublicKey('44444444444444444444444444444444'),
      };

      const result = await updateUserSponsor(mockProvider, params);

      expect(result).toBe('mock-signature');
      expect(mockProgram.methods.updateUserProfile).toHaveBeenCalledWith(
        params.newSponsor
      );
    });

    it('should handle sponsor update errors', async () => {
      mockProgram.methods.updateUserProfile.mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error('Invalid sponsor')),
        }),
      });

      const params = {
        userAddress: new PublicKey('33333333333333333333333333333333'),
        newSponsor: new PublicKey('44444444444444444444444444444444'),
      };

      await expect(updateUserSponsor(mockProvider, params)).rejects.toThrow('Invalid sponsor');
    });
  });

  describe('withdrawSystemBucket', () => {
    it('should withdraw from system bucket', async () => {
      const params = {
        bucketType: 'admin' as const,
        amount: 500,
      };

      const result = await withdrawSystemBucket(mockProvider, params);

      expect(result).toBe('mock-signature');
      expect(mockProgram.methods.withdrawSystemBucket).toHaveBeenCalledWith(
        'admin',
        new anchor.BN(500)
      );
    });

    it('should handle withdrawal errors', async () => {
      mockProgram.methods.withdrawSystemBucket.mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error('Insufficient bucket balance')),
        }),
      });

      const params = {
        bucketType: 'trader' as const,
        amount: 1000,
      };

      await expect(withdrawSystemBucket(mockProvider, params)).rejects.toThrow('Insufficient bucket balance');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockProgram.methods.activateLicenseManual.mockReturnValue({
        accounts: vi.fn().mockReturnValue({
          rpc: vi.fn().mockRejectedValue(new Error('Network error')),
        }),
      });

      const params = {
        userPubkey: new PublicKey('33333333333333333333333333333333'),
        sponsorPubkey: new PublicKey('44444444444444444444444444444444'),
        durationDays: 30,
        extendExisting: true,
      };

      await expect(activateLicenseManual(mockProvider, params)).rejects.toThrow('Network error');
    });

    it('should handle invalid public key errors', async () => {
      const params = {
        userPubkey: new PublicKey('33333333333333333333333333333333'),
        sponsorPubkey: new PublicKey('44444444444444444444444444444444'),
        durationDays: 0, // Invalid duration
        extendExisting: true,
      };

      // The service should validate inputs before calling the program
      await expect(activateLicenseManual(mockProvider, params)).rejects.toThrow();
    });
  });
});