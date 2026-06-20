import { PublicKey } from '@solana/web3.js';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';

/**
 * Manual License Activation Parameters
 */
export interface ManualLicenseActivationParams {
  provider: null;
  userPubkey: string; // Changed from PublicKey to string for backend operation
  sponsorPubkey: string; // Changed from PublicKey to string for backend operation
  durationDays: number;
  extendExisting: boolean;
  authority: PublicKey;
}

/**
 * Manual License Activation Result
 */
export interface ManualLicenseActivationResult {
  txSignature: string;
  userPubkey: string; // Changed from PublicKey to string for backend operation
  sponsorPubkey: string; // Changed from PublicKey to string for backend operation
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
  provider: null;
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
  provider: null;
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
  licenseExpiresAt: number;
  activatedBy: PublicKey;
  wasNewUser: boolean;
  extendExisting: boolean;
  previousExpiration: number;
  timestamp: number;
}

/**
 * Credit Balance Updated Event
 */
export interface CreditBalanceUpdatedEvent {
  user: PublicKey;
  amount: number;
  isDebit: boolean;
  balanceAfter: number;
  updatedBy: PublicKey;
  timestamp: number;
}

/**
 * Admin Service for managing administrative operations
 */
export class AdminService {
  constructor(_provider: null) { }

  private programAccessError(): never {
    throw new Error('AdminService program access disabled: use backend routes');
  }

  /**
   * Manually activate a user's license without USDT payment
   */
  async activateLicenseManual(params: ManualLicenseActivationParams): Promise<ManualLicenseActivationResult> {
    const { userPubkey, sponsorPubkey, durationDays, extendExisting } = params;

    if (durationDays <= 0) {
      throw new Error('Duration days must be greater than 0');
    }

    // Backend operation - addresses are passed as strings
    // Let the backend handle validation and conversion
    const base = API_CONFIG.getBaseUrl();
    const url = `${base}/users/${userPubkey}/license`;
    const resp = await ApiClient.post(url, { durationDays, extendExisting });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || 'Failed to activate license (manual)');
    }
    const payload = await resp.json() as { success: boolean; new_expiration: string; transaction_id?: number };
    const licenseExpiresAt = new Date(payload.new_expiration);

    // Backend operation - no PublicKey validation needed
    // Return strings to maintain consistency with backend approach
    return {
      txSignature: payload.transaction_id ? `BACKEND-LICENSE-${payload.transaction_id}` : 'BACKEND-LICENSE',
      userPubkey: userPubkey as string, // Pass as string, no conversion
      sponsorPubkey: sponsorPubkey as string, // Pass as string, no conversion
      durationDays,
      licenseExpiresAt,
      wasNewUser: false,
      extendExisting,
      previousExpiration: null,
    };
  }

  /**
   * Credit or debit a user's balance
   */
  async creditUserBalance(params: UserCreditParams): Promise<UserCreditResult> {
    const { userPubkey, amount, isDebit } = params;

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const base = API_CONFIG.getBaseUrl();
    const url = isDebit
      ? `${base}/users/${userPubkey.toBase58()}/debit`
      : `${base}/users/${userPubkey.toBase58()}/credit`;
    const resp = await ApiClient.post(url, { amount });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || 'Failed to update user credit balance');
    }
    const payload = await resp.json() as { success: boolean; new_balance?: number | string };
    let balanceAfter = 0;
    if (typeof payload.new_balance === 'number') {
      balanceAfter = payload.new_balance;
    } else if (typeof payload.new_balance === 'string') {
      const micro = Number(payload.new_balance);
      balanceAfter = Number.isFinite(micro) ? micro : 0;
    }

    return {
      txSignature: isDebit ? 'BACKEND-DEBIT' : 'BACKEND-CREDIT',
      userPubkey,
      amount,
      isDebit,
      balanceAfter,
      wasNewUser: false,
    };
  }

  /**
   * Update a user's sponsor
   */
  async updateUserSponsor(params: UserSponsorUpdateParams): Promise<string> {
    const { userPubkey, newSponsor } = params as { userPubkey: PublicKey | string; newSponsor: PublicKey | string };
    const base = API_CONFIG.getBaseUrl();
    const userAddr = typeof userPubkey === 'string' ? userPubkey : userPubkey.toBase58();
    const sponsorAddr = typeof newSponsor === 'string' ? newSponsor : newSponsor.toBase58();
    const url = `${base}/users/${userAddr}/sponsor`;
    const resp = await ApiClient.post(url, { newSponsorAddress: sponsorAddr });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || 'Failed to update user sponsor');
    }
    return 'BACKEND-SPONSOR-UPDATED';
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userPubkey: PublicKey) {
    this.programAccessError();
  }

  /**
   * Check if a user has an active license
   */
  async hasActiveLicense(userPubkey: PublicKey): Promise<boolean> {
    this.programAccessError();
  }

  /**
   * Get system configuration
   */
  async getConfig(): Promise<never> {
    this.programAccessError();
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
export function createAdminService(_provider: unknown): AdminService {
  return new AdminService(null);
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