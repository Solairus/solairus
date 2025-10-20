import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram, derivePdas, type Config } from '@/lib/solairus-main';

/**
 * Manual License Activation Parameters
 */
export interface ManualLicenseActivationParams {
  provider: anchor.AnchorProvider;
  userPubkey: PublicKey;
  sponsorPubkey: PublicKey;
  durationDays: number;
  extendExisting: boolean;
  authority: PublicKey;
}

/**
 * Manual License Activation Result
 */
export interface ManualLicenseActivationResult {
  txSignature: string;
  userPubkey: PublicKey;
  sponsorPubkey: PublicKey;
  durationDays: number;
  licenseExpiresAt: Date;
  wasNewUser: boolean;
  extendExisting: boolean;
  previousExpiration: Date | null;
}

/**
 * User Credit Management Parameters
 */
export interface UserCreditParams {
  provider: anchor.AnchorProvider;
  userPubkey: PublicKey;
  amount: number;
  isDebit: boolean;
  authority: PublicKey;
}

/**
 * User Credit Management Result
 */
export interface UserCreditResult {
  txSignature: string;
  userPubkey: PublicKey;
  amount: number;
  isDebit: boolean;
  balanceAfter: number;
  wasNewUser: boolean;
}

/**
 * User Sponsor Update Parameters
 */
export interface UserSponsorUpdateParams {
  provider: anchor.AnchorProvider;
  userPubkey: PublicKey;
  newSponsor: PublicKey;
  authority: PublicKey;
}

/**
 * Manual License Activated Event
 */
export interface ManualLicenseActivatedEvent {
  user: PublicKey;
  sponsor: PublicKey;
  durationDays: number;
  licenseExpiresAt: anchor.BN;
  activatedBy: PublicKey;
  wasNewUser: boolean;
  extendExisting: boolean;
  previousExpiration: anchor.BN;
  timestamp: anchor.BN;
}

/**
 * Credit Balance Updated Event
 */
export interface CreditBalanceUpdatedEvent {
  user: PublicKey;
  amount: anchor.BN;
  isDebit: boolean;
  balanceAfter: anchor.BN;
  updatedBy: PublicKey;
  timestamp: anchor.BN;
}

/**
 * Admin Service for managing administrative operations
 */
export class AdminService {
  private program: anchor.Program;
  
  constructor(provider: anchor.AnchorProvider) {
    this.program = getProgram(provider);
  }

  /**
   * Manually activate a user's license without USDT payment
   */
  async activateLicenseManual(params: ManualLicenseActivationParams): Promise<ManualLicenseActivationResult> {
    const {
      userPubkey,
      sponsorPubkey,
      durationDays,
      extendExisting,
      authority,
    } = params;

    // Validate parameters
    if (durationDays <= 0) {
      throw new Error('Duration days must be greater than 0');
    }

    // Derive PDAs
    const { config } = derivePdas();
    const { profile: userProfile } = derivePdas(userPubkey);

    if (!userProfile) {
      throw new Error('Could not derive user profile PDA');
    }

    // Check if user profile exists to determine if this is a new user
    let wasNewUser = false;
    let previousExpiration: Date | null = null;

    try {
      const existingProfile = await this.program.account['userProfile'].fetch(userProfile);
      // If profile exists but user field is default, it's effectively a new user
      wasNewUser = existingProfile.user.equals(PublicKey.default);
      
      if (!wasNewUser && existingProfile.licenseExpiresAt) {
        const prevExpTimestamp = existingProfile.licenseExpiresAt.toNumber();
        if (prevExpTimestamp > 0) {
          previousExpiration = new Date(prevExpTimestamp * 1000);
        }
      }
    } catch (error) {
      // Profile doesn't exist, so it's a new user
      wasNewUser = true;
    }

    try {
      // Call the contract method
      const txSignature = await this.program.methods
        .activateLicenseManual(
          userPubkey,
          sponsorPubkey,
          durationDays,
          extendExisting
        )
        .accounts({
          config,
          userProfile,
          authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Calculate the expected expiration date
      const now = new Date();
      const durationMs = durationDays * 24 * 60 * 60 * 1000;
      
      let licenseExpiresAt: Date;
      if (extendExisting && previousExpiration && previousExpiration > now) {
        // Extend from previous expiration
        licenseExpiresAt = new Date(previousExpiration.getTime() + durationMs);
      } else {
        // Set from current time
        licenseExpiresAt = new Date(now.getTime() + durationMs);
      }

      return {
        txSignature,
        userPubkey,
        sponsorPubkey,
        durationDays,
        licenseExpiresAt,
        wasNewUser,
        extendExisting,
        previousExpiration,
      };
    } catch (error) {
      console.error('Error in manual license activation:', error);
      throw this.formatContractError(error);
    }
  }

  /**
   * Credit or debit a user's balance
   */
  async creditUserBalance(params: UserCreditParams): Promise<UserCreditResult> {
    const { userPubkey, amount, isDebit, authority } = params;

    // Validate parameters - amount should be a number (already converted from BN)
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Derive PDAs
    const { config } = derivePdas();
    const { profile: userProfile } = derivePdas(userPubkey);

    if (!userProfile) {
      throw new Error('Could not derive user profile PDA');
    }

    // Check if user profile exists to determine if this is a new user
    let wasNewUser = false;
    try {
      const existingProfile = await this.program.account['userProfile'].fetch(userProfile);
      wasNewUser = existingProfile.user.equals(PublicKey.default);
    } catch (error) {
      // Profile doesn't exist, so it's a new user
      wasNewUser = true;
    }

    try {
      // Call the contract method - ensure amount is properly converted to BN
      const amountBN = new anchor.BN(Math.floor(amount)); // Ensure integer value
      const txSignature = await this.program.methods
        .creditUserBalance(userPubkey, amountBN, isDebit)
        .accounts({
          config,
          profile: userProfile,
          authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Fetch updated profile to get balance after
      const updatedProfile = await this.program.account['userProfile'].fetch(userProfile);
      const balanceAfter = updatedProfile.creditBalance?.toNumber() || 0;

      return {
        txSignature,
        userPubkey,
        amount,
        isDebit,
        balanceAfter,
        wasNewUser,
      };
    } catch (error) {
      console.error('Error in credit user balance:', error);
      throw this.formatContractError(error);
    }
  }

  /**
   * Update a user's sponsor
   */
  async updateUserSponsor(params: UserSponsorUpdateParams): Promise<string> {
    const { userPubkey, newSponsor, authority } = params;

    // Derive PDAs
    const { config } = derivePdas();
    const { profile: userProfile } = derivePdas(userPubkey);

    if (!userProfile) {
      throw new Error('Could not derive user profile PDA');
    }

    // Verify user profile exists
    try {
      const existingProfile = await this.program.account['userProfile'].fetch(userProfile);
      if (existingProfile.user.equals(PublicKey.default)) {
        throw new Error('User profile does not exist');
      }
    } catch (error) {
      throw new Error('User profile not found. User must be registered first.');
    }

    // Verify new sponsor is registered
    const { profile: sponsorProfile } = derivePdas(newSponsor);
    if (!sponsorProfile) {
      throw new Error('Could not derive sponsor profile PDA');
    }

    try {
      const sponsorProfileData = await this.program.account['userProfile'].fetch(sponsorProfile);
      if (sponsorProfileData.user.equals(PublicKey.default)) {
        throw new Error('New sponsor is not registered');
      }
    } catch (error) {
      throw new Error('New sponsor is not registered in the system');
    }

    try {
      // Call the update_user_profile method (assuming it exists in the contract)
      const txSignature = await this.program.methods
        .updateUserProfile(newSponsor)
        .accounts({
          config,
          profile: userProfile,
          authority,
        })
        .rpc();

      return txSignature;
    } catch (error) {
      console.error('Error updating user sponsor:', error);
      throw this.formatContractError(error);
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userPubkey: PublicKey) {
    const { profile } = derivePdas(userPubkey);
    
    if (!profile) {
      throw new Error('Could not derive user profile PDA');
    }

    try {
      const userProfile = await this.program.account['userProfile'].fetch(profile);
      
      // Check if profile is initialized
      if (userProfile.user.equals(PublicKey.default)) {
        return null; // Profile exists but not initialized
      }

      return {
        user: userProfile.user,
        sponsor: userProfile.sponsor,
        createdAt: new Date(userProfile.createdAt.toNumber() * 1000),
        activePrincipalUsdt: userProfile.activePrincipalUsdt.toNumber(),
        lastRoiWithdrawAt: userProfile.lastRoiWithdrawAt.toNumber() > 0 
          ? new Date(userProfile.lastRoiWithdrawAt.toNumber() * 1000) 
          : null,
        licenseExpiresAt: userProfile.licenseExpiresAt.toNumber() > 0 
          ? new Date(userProfile.licenseExpiresAt.toNumber() * 1000) 
          : null,
        totalAffiliateEarnings: userProfile.totalAffiliateEarnings.toNumber(),
        totalAffiliateWithdrawn: userProfile.totalAffiliateWithdrawn.toNumber(),
        level1Earnings: userProfile.level1Earnings.toNumber(),
        level2Earnings: userProfile.level2Earnings.toNumber(),
        level3Earnings: userProfile.level3Earnings.toNumber(),
        creditBalance: userProfile.creditBalance?.toNumber() || 0,
      };
    } catch (error) {
      // Profile doesn't exist
      return null;
    }
  }

  /**
   * Check if a user has an active license
   */
  async hasActiveLicense(userPubkey: PublicKey): Promise<boolean> {
    const profile = await this.getUserProfile(userPubkey);
    
    if (!profile || !profile.licenseExpiresAt) {
      return false;
    }

    return profile.licenseExpiresAt > new Date();
  }

  /**
   * Get system configuration
   */
  async getConfig(): Promise<Config> {
    const { config } = derivePdas();
    return await this.program.account['config'].fetch(config) as Config;
  }

  /**
   * Format contract errors for user display
   */
  private formatContractError(error: unknown): Error {
    if (error instanceof Error) {
      // Check for specific error codes
      if (error.message.includes('Unauthorized')) {
        return new Error('You are not authorized to perform this action. Only admin or dev can perform administrative operations.');
      }
      
      if (error.message.includes('InvalidAmount')) {
        return new Error('Invalid amount provided. Please check your input values.');
      }
      
      if (error.message.includes('InsufficientFunds')) {
        return new Error('Insufficient funds for this operation.');
      }
      
      if (error.message.includes('MathOverflow')) {
        return new Error('Mathematical overflow occurred. Please check your input values.');
      }
      
      if (error.message.includes('SponsorNotRegistered')) {
        return new Error('The specified sponsor is not registered in the system.');
      }
      
      // Return original error if no specific handling
      return error;
    }
    
    return new Error(`Transaction failed: ${String(error)}`);
  }
}

/**
 * Create admin service instance
 */
export function createAdminService(provider: anchor.AnchorProvider): AdminService {
  return new AdminService(provider);
}

/**
 * Utility functions for admin operations
 */
export const AdminServiceUtils = {
  /**
   * Validate license duration
   */
  validateLicenseDuration(durationDays: number): { isValid: boolean; error?: string } {
    if (durationDays <= 0) {
      return { isValid: false, error: 'Duration must be greater than 0 days' };
    }
    
    if (durationDays > 3650) { // 10 years max
      return { isValid: false, error: 'Duration cannot exceed 10 years (3650 days)' };
    }
    
    return { isValid: true };
  },

  /**
   * Validate credit amount
   */
  validateCreditAmount(amount: number): { isValid: boolean; error?: string } {
    if (amount <= 0) {
      return { isValid: false, error: 'Amount must be greater than 0' };
    }
    
    if (amount > 1_000_000_000) { // 1 billion max
      return { isValid: false, error: 'Amount is too large' };
    }
    
    return { isValid: true };
  },

  /**
   * Calculate license expiration date
   */
  calculateLicenseExpiration(
    durationDays: number,
    extendExisting: boolean,
    currentExpiration?: Date
  ): Date {
    const now = new Date();
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    
    if (extendExisting && currentExpiration && currentExpiration > now) {
      return new Date(currentExpiration.getTime() + durationMs);
    }
    
    return new Date(now.getTime() + durationMs);
  },

  /**
   * Format license duration for display
   */
  formatLicenseDuration(durationDays: number): string {
    if (durationDays === 1) {
      return '1 day';
    }
    
    if (durationDays < 30) {
      return `${durationDays} days`;
    }
    
    if (durationDays < 365) {
      const months = Math.floor(durationDays / 30);
      const remainingDays = durationDays % 30;
      
      if (remainingDays === 0) {
        return months === 1 ? '1 month' : `${months} months`;
      }
      
      return `${months} month${months > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    
    const years = Math.floor(durationDays / 365);
    const remainingDays = durationDays % 365;
    
    if (remainingDays === 0) {
      return years === 1 ? '1 year' : `${years} years`;
    }
    
    return `${years} year${years > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  },
};