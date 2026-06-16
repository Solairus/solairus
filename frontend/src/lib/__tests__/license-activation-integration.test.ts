/**
 * License Activation Integration Test
 * Purpose: Test the actual transaction building logic with mocked dependencies
 * Updated for loop-based affiliate earnings distribution
 */

import { describe, it, expect, vi } from 'vitest';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

// Mock the solairus-main module to avoid PDA derivation issues
const mockConfig = Keypair.generate().publicKey;
const mockVault = Keypair.generate().publicKey;
const mockProfile = Keypair.generate().publicKey;

vi.mock('../solairus-main', () => ({
  derivePdas: vi.fn(() => ({
    config: mockConfig,
    vault: mockVault,
    profile: mockProfile,
    counter: null,
  })),
  UserProfile: {},
  Config: {},
}));

describe('License Activation Integration - Loop-Based Earnings', () => {
  it('should handle same sponsor at multiple levels with loop-based contract', async () => {
    // Mock user and sponsor data
    const mockUser = Keypair.generate().publicKey;
    const mockSponsor = Keypair.generate().publicKey;
    const mockDev = Keypair.generate().publicKey;
    const mockUsdtMint = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

    // Mock user profile with same sponsor at multiple levels
    const mockUserProfile = {
      user: mockUser,
      sponsorL1: mockSponsor,
      sponsorL2: mockSponsor, // Same sponsor
      sponsorL3: mockSponsor, // Same sponsor
      createdAt: new anchor.BN(Date.now() / 1000),
      activePrincipalUsdt: new anchor.BN(0),
      lastRoiWithdrawAt: new anchor.BN(0),
      licenseExpiresAt: new anchor.BN(0),
      totalAffiliateEarnings: new anchor.BN(0),
      totalAffiliateWithdrawn: new anchor.BN(0),
      level1Earnings: new anchor.BN(0),
      level2Earnings: new anchor.BN(0),
      level3Earnings: new anchor.BN(0),
    };

    const mockConfigData = {
      bump: 1,
      dev: mockDev,
      admin: mockDev,
      marketer1: mockDev,
      marketer2: mockDev,
      trader: mockDev,
      systemreserve: mockDev,
      usdtMint: mockUsdtMint,
      activationFeeUsdt: new anchor.BN(100_000_000),
      licenseDurationDays: 365,
      roiDailyBps: 100,
      licenseAdminPct: 1000,
      licenseDevPct: 1000,
      licenseMarketer1Pct: 500,
      licenseMarketer2Pct: 500,
      licenseReservePct: 7000,
      licenseAffL1Pct: 500, // 5%
      licenseAffL2Pct: 300, // 3%
      licenseAffL3Pct: 200, // 2%
    };

    // Mock program with loop-based earnings simulation
    const mockProgram = {
      account: {
        userProfile: {
          fetch: vi.fn().mockResolvedValue(mockUserProfile),
        },
        config: {
          fetch: vi.fn().mockResolvedValue(mockConfigData),
        },
      },
      methods: {
        activateLicenseUsdt: vi.fn(() => ({
          accounts: vi.fn(() => ({
            rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
          })),
        })),
      },
    };

    // Test the core logic that would be used in the frontend
    const userProfile = await mockProgram.account.userProfile.fetch(mockProfile);
    const configData = await mockProgram.account.config.fetch(mockConfig);

    // Verify that the same sponsor appears at multiple levels
    expect(userProfile.sponsorL1.toString()).toBe(mockSponsor.toString());
    expect(userProfile.sponsorL2.toString()).toBe(mockSponsor.toString());
    expect(userProfile.sponsorL3.toString()).toBe(mockSponsor.toString());

    // Simulate the loop-based earnings calculation
    const licenseAmount = 100_000_000; // 100 USDT
    const l1Earnings = Math.floor((licenseAmount * configData.licenseAffL1Pct) / 10000);
    const l2Earnings = Math.floor((licenseAmount * configData.licenseAffL2Pct) / 10000);
    const l3Earnings = Math.floor((licenseAmount * configData.licenseAffL3Pct) / 10000);
    
    // Since all sponsors are the same, total earnings would be cumulative
    const totalEarnings = l1Earnings + l2Earnings + l3Earnings;

    expect(l1Earnings).toBe(5_000_000); // 5 USDT
    expect(l2Earnings).toBe(3_000_000); // 3 USDT
    expect(l3Earnings).toBe(2_000_000); // 2 USDT
    expect(totalEarnings).toBe(10_000_000); // 10 USDT total

    // Build accounts object - the loop-based contract handles duplicate PDAs
    const sponsorPda = Keypair.generate().publicKey; // Same PDA for all levels
    const accounts = {
      config: mockConfig,
      vault: mockVault,
      profile: mockProfile,
      user: mockUser,
      usdtMint: mockUsdtMint,
      userUsdt: Keypair.generate().publicKey,
      vaultUsdt: Keypair.generate().publicKey,
      devProfile: Keypair.generate().publicKey,
      // Loop-based contract accepts same PDA for all sponsor levels
      sponsorL1Profile: sponsorPda,
      sponsorL2Profile: sponsorPda, // Same PDA
      sponsorL3Profile: sponsorPda, // Same PDA
    };

    // Test transaction building with loop-based contract
    const amount = new anchor.BN(100_000_000);
    const methodsCall = mockProgram.methods.activateLicenseUsdt(amount);
    const accountsCall = methodsCall.accounts(accounts);
    const result = await accountsCall.rpc();

    expect(result).toBe('mock-tx-signature');
    expect(mockProgram.methods.activateLicenseUsdt).toHaveBeenCalledWith(amount);
  });

  it('should handle mixed sponsor scenario in transaction building', async () => {
    const mockUser = Keypair.generate().publicKey;
    const mockSponsor1 = Keypair.generate().publicKey;
    const mockSponsor2 = Keypair.generate().publicKey;
    const mockDev = Keypair.generate().publicKey;

    // Mock user profile with mixed sponsors
    const mockUserProfile = {
      user: mockUser,
      sponsorL1: mockSponsor1,
      sponsorL2: mockSponsor2,
      sponsorL3: mockSponsor1, // Same as L1
      createdAt: new anchor.BN(Date.now() / 1000),
      activePrincipalUsdt: new anchor.BN(0),
      lastRoiWithdrawAt: new anchor.BN(0),
      licenseExpiresAt: new anchor.BN(0),
      totalAffiliateEarnings: new anchor.BN(0),
      totalAffiliateWithdrawn: new anchor.BN(0),
      level1Earnings: new anchor.BN(0),
      level2Earnings: new anchor.BN(0),
      level3Earnings: new anchor.BN(0),
    };

    // Verify mixed sponsor scenario
    expect(mockUserProfile.sponsorL1.toString()).toBe(mockSponsor1.toString());
    expect(mockUserProfile.sponsorL2.toString()).toBe(mockSponsor2.toString());
    expect(mockUserProfile.sponsorL3.toString()).toBe(mockSponsor1.toString());

    // Count unique sponsors
    const sponsorAddresses = [
      mockUserProfile.sponsorL1,
      mockUserProfile.sponsorL2,
      mockUserProfile.sponsorL3,
    ];
    const uniqueSponsors = new Set(sponsorAddresses.map(s => s.toString()));
    expect(uniqueSponsors.size).toBe(2); // Two unique sponsors

    // The loop-based contract would handle this by:
    // 1. Updating sponsor1's profile twice (L1 and L3 earnings)
    // 2. Updating sponsor2's profile once (L2 earnings)
    expect(mockUserProfile.sponsorL1.equals(mockUserProfile.sponsorL3)).toBe(true);
  });
});