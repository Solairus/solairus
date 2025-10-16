import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { UserProfile, derivePdas, getErrorMessage } from "@/lib/solairus-main";
import { 
  ProfileErrorFactory, 
  ProfileErrorType, 
  EnhancedProfileError,
  ProfileErrorContext 
} from "./profile-error-types";

/**
 * Profile Account Validation Utilities
 * 
 * Provides comprehensive validation for user profile accounts to prevent
 * AccountDidNotDeserialize errors and other account-related issues.
 * 
 * Key Features:
 * - Account existence validation
 * - Structure and size validation
 * - Deserialization capability testing
 * - Detailed error reporting with actionable information
 */

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canRecover: boolean;
  suggestedAction: 'retry' | 'recreate' | 'migrate' | 'none';
  accountInfo?: AccountInfo;
}

export interface AccountInfo {
  exists: boolean;
  address: string;
  owner?: string;
  size?: number;
  expectedSize?: number;
  canDeserialize: boolean;
  lastValidated: number;
}

export interface AccountValidation {
  exists: boolean;
  canDeserialize: boolean;
  hasCorrectSize: boolean;
  structureMatches: boolean;
  lastValidated: number;
  errorDetails?: {
    expectedSize: number;
    actualSize: number;
    deserializationError: string;
    ownerMismatch?: boolean;
    invalidData?: boolean;
  };
}

export interface ProfileValidationError {
  type: 'account_not_found' | 'deserialization_failed' | 'size_mismatch' | 'data_corruption' | 'owner_mismatch' | 'invalid_structure';
  message: string;
  technicalDetails: {
    accountAddress: string;
    expectedStructure?: string;
    actualData?: string;
    suggestedFix: string;
  };
  isRecoverable: boolean;
  retryable: boolean;
}

/**
 * ProfileAccountValidator
 * 
 * Main validation class for profile accounts with comprehensive
 * error detection and recovery suggestions.
 */
export class ProfileAccountValidator {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
  }

  /**
   * Validate profile account structure and integrity
   */
  async validateAccountStructure(profilePda: PublicKey): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let canRecover = false;
    let suggestedAction: ValidationResult['suggestedAction'] = 'none';
    let accountInfo: AccountInfo | undefined;

    const context: ProfileErrorContext = {
      operation: 'validate_account_structure',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    try {
      // Step 1: Check if account exists
      const exists = await this.checkAccountExists(profilePda);
      accountInfo = {
        exists,
        address: profilePda.toString(),
        canDeserialize: false,
        lastValidated: Date.now(),
      };

      if (!exists) {
        errors.push('Profile account does not exist');
        suggestedAction = 'recreate';
        canRecover = true;
        return {
          isValid: false,
          errors,
          warnings,
          canRecover,
          suggestedAction,
          accountInfo,
        };
      }

      // Step 2: Get account info and validate basic properties
      const accountInfoRaw = await this.provider.connection.getAccountInfo(profilePda);
      if (!accountInfoRaw) {
        errors.push('Account exists but cannot retrieve account info');
        suggestedAction = 'retry';
        canRecover = true;
        return {
          isValid: false,
          errors,
          warnings,
          canRecover,
          suggestedAction,
          accountInfo,
        };
      }

      accountInfo.owner = accountInfoRaw.owner.toString();
      accountInfo.size = accountInfoRaw.data.length;

      // Step 3: Validate account ownership
      if (!accountInfoRaw.owner.equals(this.program.programId)) {
        errors.push(`Account owner mismatch. Expected: ${this.program.programId.toString()}, Got: ${accountInfoRaw.owner.toString()}`);
        suggestedAction = 'recreate';
        canRecover = false; // Owner mismatch usually requires recreation
        return {
          isValid: false,
          errors,
          warnings,
          canRecover,
          suggestedAction,
          accountInfo,
        };
      }

      // Step 4: Validate account size
      const sizeValidation = await this.verifyAccountSize(profilePda);
      accountInfo.expectedSize = this.getExpectedProfileSize();
      
      if (!sizeValidation) {
        errors.push(`Account size mismatch. Expected: ${accountInfo.expectedSize}, Got: ${accountInfo.size}`);
        suggestedAction = 'recreate';
        canRecover = true;
        return {
          isValid: false,
          errors,
          warnings,
          canRecover,
          suggestedAction,
          accountInfo,
        };
      }

      // Step 5: Test deserialization
      const deserializationResult = await this.validateAccountData(profilePda);
      accountInfo.canDeserialize = deserializationResult.canDeserialize;

      if (!deserializationResult.canDeserialize) {
        errors.push('Account data cannot be deserialized');
        if (deserializationResult.errorDetails?.deserializationError) {
          errors.push(`Deserialization error: ${deserializationResult.errorDetails.deserializationError}`);
        }
        
        // Determine recovery strategy based on error type
        if (deserializationResult.errorDetails?.invalidData) {
          suggestedAction = 'recreate';
          canRecover = true;
        } else {
          suggestedAction = 'migrate';
          canRecover = true;
        }
        
        return {
          isValid: false,
          errors,
          warnings,
          canRecover,
          suggestedAction,
          accountInfo,
        };
      }

      // Step 6: Validate data structure integrity
      if (!deserializationResult.structureMatches) {
        warnings.push('Account structure may not match expected format');
        suggestedAction = 'migrate';
        canRecover = true;
      }

      // All validations passed
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        canRecover,
        suggestedAction: errors.length === 0 ? 'none' : suggestedAction,
        accountInfo,
      };

    } catch (error) {
      const profileError = ProfileErrorFactory.fromException(error, context);
      errors.push(`Validation failed: ${profileError.message}`);
      return {
        isValid: false,
        errors,
        warnings,
        canRecover: profileError.isRecoverable,
        suggestedAction: 'retry',
        accountInfo,
      };
    }
  }

  /**
   * Check if profile account exists on the blockchain
   */
  async checkAccountExists(profilePda: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.provider.connection.getAccountInfo(profilePda);
      return accountInfo !== null;
    } catch (error) {
      console.warn('Error checking account existence:', getErrorMessage(error));
      return false;
    }
  }

  /**
   * Verify account has correct size allocation
   */
  async verifyAccountSize(profilePda: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.provider.connection.getAccountInfo(profilePda);
      if (!accountInfo) return false;

      const expectedSize = this.getExpectedProfileSize();
      return accountInfo.data.length === expectedSize;
    } catch (error) {
      console.warn('Error verifying account size:', getErrorMessage(error));
      return false;
    }
  }

  /**
   * Validate account data and test deserialization
   */
  async validateAccountData(profilePda: PublicKey): Promise<AccountValidation> {
    const validation: AccountValidation = {
      exists: false,
      canDeserialize: false,
      hasCorrectSize: false,
      structureMatches: false,
      lastValidated: Date.now(),
    };

    try {
      // Check existence
      const accountInfo = await this.provider.connection.getAccountInfo(profilePda);
      validation.exists = accountInfo !== null;
      
      if (!validation.exists) {
        return validation;
      }

      // Check size
      const expectedSize = this.getExpectedProfileSize();
      validation.hasCorrectSize = accountInfo!.data.length === expectedSize;
      
      if (!validation.hasCorrectSize) {
        validation.errorDetails = {
          expectedSize,
          actualSize: accountInfo!.data.length,
          deserializationError: 'Account size mismatch',
        };
        return validation;
      }

      // Test deserialization
      try {
        const userProfile = await this.program.account["userProfile"].fetch(profilePda) as UserProfile;
        validation.canDeserialize = true;
        
        // Validate structure integrity
        validation.structureMatches = this.validateProfileStructure(userProfile);
        
        if (!validation.structureMatches) {
          validation.errorDetails = {
            expectedSize,
            actualSize: accountInfo!.data.length,
            deserializationError: 'Profile structure validation failed',
            invalidData: true,
          };
        }
        
      } catch (deserializationError) {
        validation.canDeserialize = false;
        validation.errorDetails = {
          expectedSize,
          actualSize: accountInfo!.data.length,
          deserializationError: getErrorMessage(deserializationError),
        };
      }

      return validation;
    } catch (error) {
      validation.errorDetails = {
        expectedSize: this.getExpectedProfileSize(),
        actualSize: 0,
        deserializationError: getErrorMessage(error),
      };
      return validation;
    }
  }

  /**
   * Validate the structure and content of a deserialized UserProfile
   */
  private validateProfileStructure(userProfile: UserProfile): boolean {
    try {
      // Check required fields exist and have valid types
      if (!userProfile.user || !(userProfile.user instanceof PublicKey)) {
        return false;
      }

      if (!userProfile.sponsor || !(userProfile.sponsor instanceof PublicKey)) {
        return false;
      }

      if (!userProfile.createdAt || !anchor.BN.isBN(userProfile.createdAt)) {
        return false;
      }

      if (!userProfile.activePrincipalUsdt || !anchor.BN.isBN(userProfile.activePrincipalUsdt)) {
        return false;
      }

      if (!userProfile.lastRoiWithdrawAt || !anchor.BN.isBN(userProfile.lastRoiWithdrawAt)) {
        return false;
      }

      if (!userProfile.licenseExpiresAt || !anchor.BN.isBN(userProfile.licenseExpiresAt)) {
        return false;
      }

      // Check affiliate earnings fields
      if (!userProfile.totalAffiliateEarnings || !anchor.BN.isBN(userProfile.totalAffiliateEarnings)) {
        return false;
      }

      if (!userProfile.totalAffiliateWithdrawn || !anchor.BN.isBN(userProfile.totalAffiliateWithdrawn)) {
        return false;
      }

      if (!userProfile.level1Earnings || !anchor.BN.isBN(userProfile.level1Earnings)) {
        return false;
      }

      if (!userProfile.level2Earnings || !anchor.BN.isBN(userProfile.level2Earnings)) {
        return false;
      }

      if (!userProfile.level3Earnings || !anchor.BN.isBN(userProfile.level3Earnings)) {
        return false;
      }

      // All structure checks passed
      return true;
    } catch (error) {
      console.warn('Profile structure validation error:', getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get expected size for UserProfile account
   * Based on the UserProfile struct definition
   */
  private getExpectedProfileSize(): number {
    // UserProfile struct size calculation:
    // - user: PublicKey (32 bytes)
    // - sponsor: PublicKey (32 bytes)  
    // - createdAt: BN/i64 (8 bytes)
    // - activePrincipalUsdt: BN/u64 (8 bytes)
    // - lastRoiWithdrawAt: BN/i64 (8 bytes)
    // - licenseExpiresAt: BN/i64 (8 bytes)
    // - totalAffiliateEarnings: BN/u64 (8 bytes)
    // - totalAffiliateWithdrawn: BN/u64 (8 bytes)
    // - level1Earnings: BN/u64 (8 bytes)
    // - level2Earnings: BN/u64 (8 bytes)
    // - level3Earnings: BN/u64 (8 bytes)
    // + 8 bytes discriminator
    // Total: 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 = 152 bytes
    return 152;
  }

  /**
   * Create a comprehensive validation error with actionable information
   */
  createValidationError(
    type: ProfileValidationError['type'],
    accountAddress: string,
    details: Partial<ProfileValidationError['technicalDetails']> = {}
  ): ProfileValidationError {
    const baseError: ProfileValidationError = {
      type,
      message: this.getErrorMessage(type),
      technicalDetails: {
        accountAddress,
        suggestedFix: this.getSuggestedFix(type),
        ...details,
      },
      isRecoverable: this.isRecoverable(type),
      retryable: this.isRetryable(type),
    };

    return baseError;
  }

  /**
   * Get user-friendly error message for validation error type
   */
  private getErrorMessage(type: ProfileValidationError['type']): string {
    switch (type) {
      case 'account_not_found':
        return 'User profile account does not exist. Registration is required.';
      case 'deserialization_failed':
        return 'Profile account data is corrupted or incompatible. Account recovery needed.';
      case 'size_mismatch':
        return 'Profile account has incorrect size allocation. Account recreation required.';
      case 'data_corruption':
        return 'Profile account data is corrupted. Account recovery or recreation needed.';
      case 'owner_mismatch':
        return 'Profile account has incorrect owner. Account recreation required.';
      case 'invalid_structure':
        return 'Profile account structure does not match expected format. Migration needed.';
      default:
        return 'Unknown profile validation error occurred.';
    }
  }

  /**
   * Get suggested fix for validation error type
   */
  private getSuggestedFix(type: ProfileValidationError['type']): string {
    switch (type) {
      case 'account_not_found':
        return 'Complete user registration to create profile account';
      case 'deserialization_failed':
        return 'Attempt account recovery or recreate profile account';
      case 'size_mismatch':
        return 'Close existing account and recreate with correct size';
      case 'data_corruption':
        return 'Attempt data migration or recreate profile account';
      case 'owner_mismatch':
        return 'Recreate profile account with correct program ownership';
      case 'invalid_structure':
        return 'Migrate account data to new structure format';
      default:
        return 'Contact support for assistance with profile account issues';
    }
  }

  /**
   * Check if error type is recoverable
   */
  private isRecoverable(type: ProfileValidationError['type']): boolean {
    switch (type) {
      case 'account_not_found':
      case 'deserialization_failed':
      case 'size_mismatch':
      case 'data_corruption':
      case 'invalid_structure':
        return true;
      case 'owner_mismatch':
        return false; // Usually requires manual intervention
      default:
        return false;
    }
  }

  /**
   * Check if error type is retryable
   */
  private isRetryable(type: ProfileValidationError['type']): boolean {
    switch (type) {
      case 'account_not_found':
        return false; // Need to register first
      case 'deserialization_failed':
      case 'size_mismatch':
      case 'data_corruption':
      case 'owner_mismatch':
      case 'invalid_structure':
        return false; // Need recovery/recreation
      default:
        return true;
    }
  }

  /**
   * Validate profile PDA derivation
   */
  async validatePdaDerivation(userPubkey: PublicKey): Promise<{
    isValid: boolean;
    derivedPda: PublicKey;
    error?: string;
  }> {
    try {
      const { profile } = derivePdas(userPubkey);
      
      if (!profile) {
        return {
          isValid: false,
          derivedPda: PublicKey.default,
          error: 'Failed to derive profile PDA',
        };
      }

      return {
        isValid: true,
        derivedPda: profile,
      };
    } catch (error) {
      return {
        isValid: false,
        derivedPda: PublicKey.default,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get current environment
   */
  private getEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
      if (hostname.includes('staging') || hostname.includes('dev')) {
        return 'staging';
      }
    }
    return 'production';
  }

  /**
   * Get diagnostic information for debugging
   */
  async getDiagnosticInfo(userPubkey: PublicKey): Promise<{
    userPubkey: string;
    derivedPda: string;
    accountExists: boolean;
    accountInfo?: {
      owner: string;
      size: number;
      executable: boolean;
      rentEpoch: number;
    };
    validationResult: ValidationResult;
  }> {
    const { profile } = derivePdas(userPubkey);
    const accountExists = await this.checkAccountExists(profile!);
    
    let accountInfo;
    if (accountExists) {
      const rawAccountInfo = await this.provider.connection.getAccountInfo(profile!);
      if (rawAccountInfo) {
        accountInfo = {
          owner: rawAccountInfo.owner.toString(),
          size: rawAccountInfo.data.length,
          executable: rawAccountInfo.executable,
          rentEpoch: rawAccountInfo.rentEpoch,
        };
      }
    }

    const validationResult = await this.validateAccountStructure(profile!);

    return {
      userPubkey: userPubkey.toString(),
      derivedPda: profile!.toString(),
      accountExists,
      accountInfo,
      validationResult,
    };
  }
}

/**
 * Factory function to create ProfileAccountValidator instance
 */
export function createProfileAccountValidator(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): ProfileAccountValidator {
  return new ProfileAccountValidator(program, provider);
}

/**
 * Utility function to validate profile account with minimal setup
 */
export async function validateProfileAccount(
  program: anchor.Program,
  provider: anchor.AnchorProvider,
  userPubkey: PublicKey
): Promise<ValidationResult> {
  const validator = createProfileAccountValidator(program, provider);
  const { profile } = derivePdas(userPubkey);
  
  if (!profile) {
    return {
      isValid: false,
      errors: ['Failed to derive profile PDA'],
      warnings: [],
      canRecover: false,
      suggestedAction: 'none',
    };
  }

  return validator.validateAccountStructure(profile);
}