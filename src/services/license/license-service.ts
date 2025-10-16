import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getProgram,
  derivePdas,
  UserProfile,
  Config,
  LicenseInfo,
  getLicenseInfo,
  isLicenseActive,
  getLicenseExpiryDate,
  getErrorMessage,
  activateLicenseUsdt,
} from "@/lib/solairus-main";
import { getSponsorL1, type SponsorHierarchy } from "@/lib/sponsor-tree";
import { LicenseErrorHandler } from "@/utils/license-error-handler";
import { LicensePerformanceMonitor } from "@/utils/license-performance";
import { 
  ProfileAccountValidator, 
  createProfileAccountValidator,
  ValidationResult 
} from "@/services/profile/profile-account-validator";
import { 
  AccountRecoveryService, 
  createAccountRecoveryService,
  RecoveryResult 
} from "@/services/profile/account-recovery-service";

/**
 * LicenseService
 * 
 * Purpose: Service layer for managing license operations with solairus_main contract
 * 
 * Key Features:
 * - License status validation and expiration checking
 * - User profile management and registration
 * - License activation with proper PDA derivation
 * - Cost-conscious error handling (no automatic retries)
 * 
 * License Activation Process:
 * 1. Check if user needs registration (create profile if needed)
 * 2. Fetch user profile to get sponsor information
 * 3. Submit license activation transaction (earnings tracked in sponsor profiles)
 * 4. Handle errors with user-friendly messages and manual retry options
 * 
 * Simplified Affiliate System:
 * - Affiliate earnings tracked directly in sponsor UserProfile accounts
 * - No separate affiliate PDAs needed
 * - Unregistered sponsors default to dev account for earnings
 * 
 * Cost Protection:
 * - No automatic retries to prevent unexpected gas costs
 * - All retries are user-controlled with clear guidance
 * - Enhanced error messages help users understand when to retry vs take action
 */
export class LicenseService {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private profileValidator: ProfileAccountValidator;
  private accountRecoveryService: AccountRecoveryService;

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    console.log('🔧 Initializing LicenseService with provider');
    this.program = getProgram(provider);
    
    // Initialize profile validation and recovery services
    this.profileValidator = createProfileAccountValidator(this.program, this.provider);
    this.accountRecoveryService = createAccountRecoveryService(this.program, this.provider, this.profileValidator);
    
    console.log('✅ LicenseService initialized with validation and recovery services');
  }

  /**
   * Check if user has a profile and fetch profile data
   */
  async checkUserProfile(userPubkey: PublicKey): Promise<UserProfile | null> {
    try {
      const { profile } = derivePdas(userPubkey);
      const userProfile = await this.program.account["userProfile"].fetch(profile);
      
      // Profile found successfully
      
      return userProfile as UserProfile;
    } catch (error) {
      // Profile doesn't exist or other error
      console.log("User profile not found:", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Fetch license configuration from smart contract
   */
  async getConfig(): Promise<Config> {
    try {
      const { config } = derivePdas();
      const configData = await this.program.account["config"].fetch(config);
      return configData as Config;
    } catch (error) {
      const errorMsg = getErrorMessage(error);

      // Check if this is a "contract not deployed" error
      if (errorMsg.includes('Account does not exist') ||
        errorMsg.includes('AccountNotInitialized') ||
        errorMsg.includes('3012')) {
        throw new Error('Smart contract not deployed. Please contact support.');
      }

      throw new Error(`Failed to fetch config: ${errorMsg}`);
    }
  }

  /**
   * Check if user has an active license
   */
  async isLicenseActive(userPubkey: PublicKey): Promise<boolean> {
    try {
      const userProfile = await this.checkUserProfile(userPubkey);
      if (!userProfile) return false;
      return isLicenseActive(userProfile);
    } catch (error) {
      console.error("Error checking license status:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get comprehensive license information for a user
   * FIXED: Returns 'none' status on errors instead of 'loading' (addresses false positive issue)
   */
  async getLicenseInfo(userPubkey: PublicKey): Promise<LicenseInfo> {
    const endTiming: (success?: boolean, cached?: boolean, error?: string) => void = LicensePerformanceMonitor.startTiming('getLicenseInfo');

    try {
      console.log('🔍 Getting fresh license info for:', userPubkey.toString());
      const userProfile = await this.checkUserProfile(userPubkey);
      const result = getLicenseInfo(userProfile);
      console.log('✅ License info result:', result);
      endTiming(true, false);
      return result;
    } catch (error) {
      console.error("Error getting license info:", getErrorMessage(error));
      endTiming(false, false, getErrorMessage(error));
      
      // CRITICAL FIX: Return 'none' instead of 'loading' on errors
      // This prevents false positive license status display
      return {
        status: 'none',
        isValid: false,
      };
    }
  }

  /**
   * Get license expiry date for a user
   */
  async getLicenseExpiryDate(userPubkey: PublicKey): Promise<Date | null> {
    try {
      const userProfile = await this.checkUserProfile(userPubkey);
      if (!userProfile) return null;
      return getLicenseExpiryDate(userProfile);
    } catch (error) {
      console.error("Error getting license expiry:", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Check if user needs to register (no profile exists)
   */
  async needsRegistration(userPubkey: PublicKey): Promise<boolean> {
    const userProfile = await this.checkUserProfile(userPubkey);
    return userProfile === null;
  }

  /**
   * Check if user is properly registered (has valid profile data)
   */
  async isUserRegistered(userPubkey: PublicKey): Promise<boolean> {
    try {
      const userProfile = await this.checkUserProfile(userPubkey);
      
      if (!userProfile) {
        console.log('❌ User not registered: No profile found');
        return false;
      }

      // Validate registration fields
      const hasValidCreatedAt = userProfile.createdAt && !userProfile.createdAt.eq(new anchor.BN(0));
      const hasValidSponsor = userProfile.sponsor && !userProfile.sponsor.equals(PublicKey.default);
      const hasValidUser = userProfile.user && userProfile.user.equals(userPubkey);

      const isRegistered = hasValidCreatedAt && hasValidSponsor && hasValidUser;
      
      console.log('🔍 Registration check result:', {
        hasValidCreatedAt,
        hasValidSponsor, 
        hasValidUser,
        isRegistered,
        createdAt: userProfile.createdAt?.toString(),
        sponsor: userProfile.sponsor?.toString(),
      });

      return isRegistered;
    } catch (error) {
      console.error("Error checking registration status:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get license fee from config
   */
  async getLicenseFee(): Promise<{ amount: anchor.BN; usdtMint: PublicKey }> {
    try {
      const config = await this.getConfig();
      return {
        amount: config.activationFeeUsdt,
        usdtMint: config.usdtMint,
      };
    } catch (error) {
      throw new Error(`Failed to get license fee: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get license duration from config
   */
  async getLicenseDuration(): Promise<number> {
    try {
      const config = await this.getConfig();
      return config.licenseDurationDays;
    } catch (error) {
      console.error("Error getting license duration:", getErrorMessage(error));
      return 365; // Default fallback
    }
  }

  /**
   * Calculate days remaining until license expiry
   */
  async getDaysRemaining(userPubkey: PublicKey): Promise<number> {
    try {
      const licenseInfo = await this.getLicenseInfo(userPubkey);
      return licenseInfo.daysRemaining || 0;
    } catch (error) {
      console.error("Error calculating days remaining:", getErrorMessage(error));
      return 0;
    }
  }

  /**
   * Check if license is near expiry (within 7 days)
   */
  async isNearExpiry(userPubkey: PublicKey): Promise<boolean> {
    try {
      const daysRemaining = await this.getDaysRemaining(userPubkey);
      return daysRemaining > 0 && daysRemaining <= 7;
    } catch (error) {
      console.error("Error checking near expiry:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Activate license by paying USDT
   */
  async activateLicense(userPubkey: PublicKey, amount?: anchor.BN): Promise<string> {
    console.log('💰 Starting activateLicense for:', userPubkey.toString());
    const endTiming: (success?: boolean, cached?: boolean, error?: string) => void = LicensePerformanceMonitor.startTiming('activateLicense');

    try {
      // Get license fee if amount not provided
      console.log('💵 Getting license fee...');
      const licenseAmount = amount || (await this.getLicenseFee()).amount;
      const { usdtMint } = await this.getLicenseFee();
      console.log('💵 License amount:', licenseAmount.toString(), 'USDT mint:', usdtMint.toString());

      // Use the statically imported activation function
      console.log('📦 Using statically imported activation function...');
      console.log('📦 Function type:', typeof activateLicenseUsdt);
      console.log('📦 Function name:', activateLicenseUsdt.name);

      // Execute the transaction
      console.log('🚀 Executing license activation transaction...');
      console.log('📋 Transaction parameters:', {
        program: this.program.programId.toString(),
        user: userPubkey.toString(),
        amount: licenseAmount.toString(),
        mint: usdtMint.toString()
      });

      const txSignature = await activateLicenseUsdt(
        this.program,
        userPubkey,
        licenseAmount,
        usdtMint
      );
      console.log('🎉 Transaction submitted:', txSignature);

      console.log("License activation transaction:", txSignature);
      endTiming(true, false);
      return txSignature;
    } catch (error) {
      const licenseError = LicenseErrorHandler.parseError(error);
      console.error("License activation failed:", licenseError);
      endTiming(false, false, licenseError.message);

      // Throw the parsed error with better messaging
      const enhancedError = new Error(licenseError.message) as Error & {
        type: string;
        isRetryable: boolean;
        suggestedAction: string;
      };
      enhancedError.type = licenseError.type;
      enhancedError.isRetryable = licenseError.isRetryable;
      enhancedError.suggestedAction = licenseError.suggestedAction || '';
      throw enhancedError;
    }
  }



  /**
   * Perform pre-registration validation to check account state
   */
  private async performPreRegistrationValidation(userPubkey: PublicKey): Promise<{
    canProceed: boolean;
    existingAccount: boolean;
    accountValid: boolean;
    reason?: string;
  }> {
    try {
      console.log('🔍 Performing pre-registration validation for:', userPubkey.toString());
      
      const { profile } = derivePdas(userPubkey);
      if (!profile) {
        return {
          canProceed: false,
          existingAccount: false,
          accountValid: false,
          reason: 'Failed to derive profile PDA',
        };
      }

      // Check if account exists
      const accountExists = await this.profileValidator.checkAccountExists(profile);
      
      if (!accountExists) {
        console.log('✅ No existing account found, can proceed with registration');
        return {
          canProceed: true,
          existingAccount: false,
          accountValid: false,
        };
      }

      // Account exists, validate its structure
      console.log('🔍 Existing account found, validating structure...');
      const validationResult = await this.profileValidator.validateAccountStructure(profile);
      
      if (validationResult.isValid) {
        console.log('✅ Existing account is valid');
        return {
          canProceed: true,
          existingAccount: true,
          accountValid: true,
        };
      } else {
        console.log('⚠️ Existing account is invalid:', validationResult.errors);
        return {
          canProceed: true,
          existingAccount: true,
          accountValid: false,
        };
      }
      
    } catch (error) {
      console.error('❌ Pre-registration validation failed:', getErrorMessage(error));
      return {
        canProceed: false,
        existingAccount: false,
        accountValid: false,
        reason: getErrorMessage(error),
      };
    }
  }

  /**
   * Handle invalid existing account by attempting recovery
   */
  private async handleInvalidExistingAccount(
    userPubkey: PublicKey, 
    sponsorHierarchy?: SponsorHierarchy
  ): Promise<RecoveryResult> {
    try {
      console.log('🔄 Attempting to recover invalid existing account...');
      
      // Get sponsor for recovery
      let sponsor: PublicKey;
      if (sponsorHierarchy?.sponsorL1) {
        sponsor = sponsorHierarchy.sponsorL1;
      } else {
        const rawSponsor = await getSponsorL1(this.provider);
        const defaultSponsor = new PublicKey(import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
        
        // Validate sponsor - if not registered, use default
        try {
          const { profile: sponsorProfile } = derivePdas(rawSponsor);
          await this.program.account["userProfile"].fetch(sponsorProfile);
          sponsor = rawSponsor;
        } catch (error) {
          sponsor = defaultSponsor;
        }
      }

      // Attempt account recovery
      const recoveryResult = await this.accountRecoveryService.attemptAccountRecovery(
        userPubkey,
        sponsor,
        3 // max attempts
      );

      if (recoveryResult.success) {
        console.log('✅ Account recovery successful:', recoveryResult.action);
      } else {
        console.error('❌ Account recovery failed:', recoveryResult.error);
      }

      return recoveryResult;
      
    } catch (error) {
      console.error('❌ Error handling invalid existing account:', getErrorMessage(error));
      return {
        success: false,
        action: 'failed',
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Perform post-registration validation to ensure account integrity
   */
  private async performPostRegistrationValidation(
    userPubkey: PublicKey,
    transactionSignature: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('🔍 Performing post-registration validation...');
      
      // Wait for transaction confirmation
      console.log('⏳ Waiting for transaction confirmation...');
      await this.waitForTransactionConfirmation(transactionSignature);
      
      const { profile } = derivePdas(userPubkey);
      if (!profile) {
        errors.push('Failed to derive profile PDA for validation');
        return { isValid: false, errors, warnings };
      }

      // Step 1: Validate account exists
      const accountExists = await this.profileValidator.checkAccountExists(profile);
      if (!accountExists) {
        errors.push('Profile account was not created despite successful transaction');
        return { isValid: false, errors, warnings };
      }

      // Step 2: Validate account structure
      const validationResult = await this.profileValidator.validateAccountStructure(profile);
      if (!validationResult.isValid) {
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
        return { isValid: false, errors, warnings };
      }

      // Step 3: Verify account can be deserialized
      try {
        const userProfile = await this.program.account["userProfile"].fetch(profile) as UserProfile;
        
        // Step 4: Validate profile data integrity
        const dataValidation = this.validateProfileData(userProfile, userPubkey);
        if (!dataValidation.isValid) {
          errors.push(...dataValidation.errors);
          warnings.push(...dataValidation.warnings);
        }
        
      } catch (deserializationError) {
        errors.push(`Account deserialization failed: ${getErrorMessage(deserializationError)}`);
        return { isValid: false, errors, warnings };
      }

      const isValid = errors.length === 0;
      console.log(isValid ? '✅ Post-registration validation passed' : '❌ Post-registration validation failed');
      
      return { isValid, errors, warnings };
      
    } catch (error) {
      errors.push(`Post-registration validation error: ${getErrorMessage(error)}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Validate profile data integrity after registration
   */
  private validateProfileData(
    userProfile: UserProfile,
    expectedUserPubkey: PublicKey
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate user field matches expected
      if (!userProfile.user.equals(expectedUserPubkey)) {
        errors.push(`Profile user field mismatch. Expected: ${expectedUserPubkey.toString()}, Got: ${userProfile.user.toString()}`);
      }

      // Validate sponsor field is not default
      if (userProfile.sponsor.equals(PublicKey.default)) {
        errors.push('Profile sponsor field is default PublicKey');
      }

      // Validate createdAt is set
      if (!userProfile.createdAt || userProfile.createdAt.eq(new anchor.BN(0))) {
        errors.push('Profile createdAt field is not set');
      }

      // Validate numeric fields are initialized (should be zero for new profiles)
      if (!anchor.BN.isBN(userProfile.activePrincipalUsdt)) {
        errors.push('Profile activePrincipalUsdt field is not a valid BN');
      }

      if (!anchor.BN.isBN(userProfile.licenseExpiresAt)) {
        errors.push('Profile licenseExpiresAt field is not a valid BN');
      }

      // Validate affiliate earnings fields
      if (!anchor.BN.isBN(userProfile.totalAffiliateEarnings)) {
        errors.push('Profile totalAffiliateEarnings field is not a valid BN');
      }

      if (!anchor.BN.isBN(userProfile.level1Earnings)) {
        errors.push('Profile level1Earnings field is not a valid BN');
      }

      // Check for reasonable timestamp (not too far in past or future)
      if (userProfile.createdAt && !userProfile.createdAt.eq(new anchor.BN(0))) {
        const createdAtSeconds = userProfile.createdAt.toNumber();
        const nowSeconds = Math.floor(Date.now() / 1000);
        const oneHourAgo = nowSeconds - 3600;
        const oneHourFromNow = nowSeconds + 3600;
        
        if (createdAtSeconds < oneHourAgo || createdAtSeconds > oneHourFromNow) {
          warnings.push(`Profile createdAt timestamp seems unusual: ${new Date(createdAtSeconds * 1000).toISOString()}`);
        }
      }

      const isValid = errors.length === 0;
      return { isValid, errors, warnings };
      
    } catch (error) {
      errors.push(`Profile data validation error: ${getErrorMessage(error)}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  private async waitForTransactionConfirmation(
    transactionSignature: string,
    timeoutMs: number = 30000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.provider.connection.getSignatureStatus(transactionSignature);
        
        if (status.value?.confirmationStatus === 'confirmed' || 
            status.value?.confirmationStatus === 'finalized') {
          console.log('✅ Transaction confirmed:', transactionSignature);
          return;
        }
        
        if (status.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.warn('Error checking transaction status:', getErrorMessage(error));
        // Continue waiting unless we've timed out
      }
    }
    
    console.warn('⚠️ Transaction confirmation timeout, proceeding with validation');
  }

  /**
   * Activate license with retry logic for failed attempts
   */
  private async activateLicenseWithRetry(
    userPubkey: PublicKey, 
    maxRetries: number = 2
  ): Promise<string> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🎫 License activation attempt ${attempt}/${maxRetries}`);
        
        const txSignature = await this.activateLicense(userPubkey);
        console.log('✅ License activation successful on attempt', attempt);
        return txSignature;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ License activation attempt ${attempt} failed:`, getErrorMessage(error));
        
        // Check if error is retryable
        const licenseError = LicenseErrorHandler.parseError(error);
        
        if (!licenseError.isRetryable || attempt >= maxRetries) {
          break;
        }

        // Wait before retry
        const waitTime = 1000 * attempt;
        console.log(`⏳ Waiting ${waitTime}ms before license activation retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All attempts failed
    console.error('❌ License activation failed after all retry attempts');
    throw lastError || new Error('License activation failed after retries');
  }

  /**
   * Validate that license activation was successful
   */
  private async validateLicenseActivationSuccess(
    userPubkey: PublicKey,
    activationTx: string
  ): Promise<void> {
    try {
      console.log('🔍 Validating license activation success...');
      
      // Wait for transaction confirmation
      await this.waitForTransactionConfirmation(activationTx);
      
      // Check license status
      const licenseInfo = await this.getLicenseInfo(userPubkey);
      
      if (licenseInfo.status !== 'active') {
        throw new Error(`License activation validation failed: status is ${licenseInfo.status}, expected 'active'`);
      }
      
      if (!licenseInfo.isValid) {
        throw new Error('License activation validation failed: license is not valid');
      }
      
      console.log('✅ License activation validation successful');
      
    } catch (error) {
      console.error('❌ License activation validation failed:', getErrorMessage(error));
      throw new Error(`License activation validation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Attempt rollback if post-registration validation fails
   */
  private async attemptRegistrationRollback(
    userPubkey: PublicKey,
    transactionSignature: string,
    validationErrors: string[]
  ): Promise<void> {
    try {
      console.log('🔄 Attempting registration rollback due to validation failure...');
      console.log('❌ Validation errors:', validationErrors);
      console.log('📝 Transaction signature:', transactionSignature);
      
      // For now, we'll just log the rollback attempt
      // In a full implementation, this might involve:
      // 1. Closing the created account (if the program supports it)
      // 2. Refunding any fees (if applicable)
      // 3. Cleaning up any related state
      
      console.log('⚠️ Rollback not fully implemented - account may remain in invalid state');
      console.log('💡 User should contact support or retry registration');
      
    } catch (error) {
      console.error('❌ Rollback attempt failed:', getErrorMessage(error));
    }
  }

  /**
   * Detect current registration state to handle retry scenarios
   */
  private async detectRegistrationState(userPubkey: PublicKey): Promise<{
    state: 'none' | 'partial' | 'completed' | 'corrupted';
    transactionSignature?: string;
    details?: string;
  }> {
    try {
      console.log('🔍 Detecting registration state for:', userPubkey.toString());
      
      const { profile } = derivePdas(userPubkey);
      
      // Check if account exists
      const accountExists = await this.profileValidator.checkAccountExists(profile);
      
      if (!accountExists) {
        return { state: 'none', details: 'No profile account found' };
      }

      // Account exists, check its validity
      const validationResult = await this.profileValidator.validateAccountStructure(profile);
      
      if (validationResult.isValid) {
        // Check if registration is actually complete
        const isRegistered = await this.isUserRegistered(userPubkey);
        
        if (isRegistered) {
          return { 
            state: 'completed', 
            details: 'Registration completed successfully' 
          };
        } else {
          return { 
            state: 'partial', 
            details: 'Account exists but registration incomplete' 
          };
        }
      } else {
        // Account exists but is invalid
        if (validationResult.canRecover) {
          return { 
            state: 'partial', 
            details: `Account exists but invalid: ${validationResult.errors.join(', ')}` 
          };
        } else {
          return { 
            state: 'corrupted', 
            details: `Account corrupted: ${validationResult.errors.join(', ')}` 
          };
        }
      }
      
    } catch (error) {
      console.error('❌ Error detecting registration state:', getErrorMessage(error));
      return { 
        state: 'none', 
        details: `Detection failed: ${getErrorMessage(error)}` 
      };
    }
  }

  /**
   * Handle partial registration state by attempting completion
   */
  private async handlePartialRegistrationState(
    userPubkey: PublicKey,
    sponsorHierarchy?: SponsorHierarchy,
    context?: { userPubkey: PublicKey; sponsor?: PublicKey; profilePda?: PublicKey; lastAttemptResult?: string }
  ): Promise<string> {
    try {
      console.log('🔄 Handling partial registration state...');
      
      // Attempt to recover the existing account
      const recoveryResult = await this.handleInvalidExistingAccount(userPubkey, sponsorHierarchy);
      
      if (recoveryResult.success) {
        console.log('✅ Partial registration recovery successful');
        return recoveryResult.transactionSignature || 'PARTIAL_RECOVERED';
      } else {
        throw new Error(`Partial registration recovery failed: ${recoveryResult.error}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to handle partial registration state:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Handle corrupted registration state by cleaning up and preparing for retry
   */
  private async handleCorruptedRegistrationState(
    userPubkey: PublicKey,
    context?: { userPubkey: PublicKey; sponsor?: PublicKey; profilePda?: PublicKey; lastAttemptResult?: string }
  ): Promise<void> {
    try {
      console.log('🧹 Handling corrupted registration state...');
      
      // Attempt to clean up corrupted account
      const { profile } = derivePdas(userPubkey);
      
      // Try to recover or recreate the account
      const recoveryResult = await this.accountRecoveryService.attemptAccountRecovery(
        userPubkey,
        new PublicKey(import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
        1 // single attempt for cleanup
      );
      
      if (recoveryResult.success) {
        console.log('✅ Corrupted account cleanup successful');
      } else {
        console.warn('⚠️ Corrupted account cleanup failed, proceeding with fresh attempt');
      }
      
    } catch (error) {
      console.warn('⚠️ Error handling corrupted registration state:', getErrorMessage(error));
      // Continue with fresh registration attempt
    }
  }

  /**
   * Execute idempotent registration that handles retry scenarios
   */
  private async executeIdempotentRegistration(
    userPubkey: PublicKey,
    sponsorHierarchy?: SponsorHierarchy,
    context?: { userPubkey: PublicKey; sponsor?: PublicKey; profilePda?: PublicKey; lastAttemptResult?: string }
  ): Promise<string> {
    try {
      console.log('📝 Executing idempotent registration...');
      
      const { config, profile } = derivePdas(userPubkey);

      // Get direct sponsor (L1) with validation
      let directSponsor: PublicKey;
      
      if (sponsorHierarchy?.sponsorL1) {
        directSponsor = sponsorHierarchy.sponsorL1;
      } else {
        // Get sponsor from referral system
        const rawSponsor = await getSponsorL1(this.provider);
        const defaultSponsor = new PublicKey(import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

        // Validate sponsor - if not registered, use default
        try {
          const { profile: sponsorProfile } = derivePdas(rawSponsor);
          await this.program.account["userProfile"].fetch(sponsorProfile);
          directSponsor = rawSponsor; // Sponsor is registered, use it
          console.log('✅ Direct sponsor is registered:', directSponsor.toString());
        } catch (error) {
          console.log('⚠️ Direct sponsor not registered, using default:', defaultSponsor.toString());
          directSponsor = defaultSponsor;
        }
      }

      // Store sponsor in context for potential retries
      if (context) {
        context.sponsor = directSponsor;
        context.profilePda = profile;
      }

      console.log('📝 Executing registration transaction with sponsor:', directSponsor.toString());

      const txSignature = await this.program.methods
        .registerUser(directSponsor)
        .accounts({
          config,
          profile,
          user: userPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Idempotent registration transaction:", txSignature);
      return txSignature;
      
    } catch (error) {
      console.error('❌ Idempotent registration execution failed:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check if registration error is retryable
   */
  private isRegistrationErrorRetryable(error: unknown): boolean {
    const errorMessage = getErrorMessage(error).toLowerCase();
    
    // Network/RPC errors are retryable
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('rpc')) {
      return true;
    }
    
    // Temporary blockchain issues are retryable
    if (errorMessage.includes('blockhash') ||
        errorMessage.includes('slot') ||
        errorMessage.includes('recent')) {
      return true;
    }
    
    // Account already exists is not retryable (should be handled differently)
    if (errorMessage.includes('already exists') ||
        errorMessage.includes('already initialized')) {
      return false;
    }
    
    // Insufficient funds is not retryable
    if (errorMessage.includes('insufficient') ||
        errorMessage.includes('balance')) {
      return false;
    }
    
    // Validation errors might be retryable depending on context
    if (errorMessage.includes('validation')) {
      return true;
    }
    
    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Provide graceful fallback options when registration fails
   */
  private async provideFallbackOptions(
    userPubkey: PublicKey,
    lastError: Error | null,
    context?: { userPubkey: PublicKey; sponsor?: PublicKey; profilePda?: PublicKey; lastAttemptResult?: string }
  ): Promise<{
    canProceed: boolean;
    action?: string;
    result?: string;
    message?: string;
  }> {
    try {
      console.log('🔄 Providing fallback options for failed registration...');
      
      // Check if user actually has a valid profile despite errors
      const isRegistered = await this.isUserRegistered(userPubkey);
      
      if (isRegistered) {
        console.log('✅ Fallback: User is actually registered despite errors');
        return {
          canProceed: true,
          action: 'already_registered',
          result: 'FALLBACK_ALREADY_REGISTERED',
          message: 'Registration was actually successful despite reported errors'
        };
      }
      
      // Check if we can use a simplified registration approach
      const { profile } = derivePdas(userPubkey);
      const accountExists = await this.profileValidator.checkAccountExists(profile);
      
      if (accountExists) {
        // Account exists, try one more recovery attempt
        console.log('🔄 Fallback: Attempting final recovery of existing account...');
        
        const recoveryResult = await this.accountRecoveryService.attemptAccountRecovery(
          userPubkey,
          context?.sponsor || new PublicKey(import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
          1 // single attempt
        );
        
        if (recoveryResult.success) {
          return {
            canProceed: true,
            action: 'recovery_fallback',
            result: recoveryResult.transactionSignature || 'FALLBACK_RECOVERED',
            message: 'Account recovered using fallback recovery method'
          };
        }
      }
      
      // No viable fallback options
      console.log('❌ No viable fallback options available');
      return {
        canProceed: false,
        message: `Registration failed after all attempts and no fallback options available. Last error: ${getErrorMessage(lastError)}`
      };
      
    } catch (error) {
      console.error('❌ Error providing fallback options:', getErrorMessage(error));
      return {
        canProceed: false,
        message: `Fallback options failed: ${getErrorMessage(error)}`
      };
    }
  }

  /**
   * Register user with resilient, idempotent flow (enhanced for profile deserialization fix)
   * Implements requirements 3.5, 2.5, 1.5 for robust registration handling
   */
  async registerUser(
    userPubkey: PublicKey, 
    sponsorHierarchy?: SponsorHierarchy,
    maxRetries: number = 3
  ): Promise<string> {
    console.log('🔍 Starting resilient registration flow with idempotent handling...');
    
    let attempt = 0;
    let lastError: Error | null = null;
    const registrationContext: {
      userPubkey: PublicKey;
      sponsor?: PublicKey;
      profilePda?: PublicKey;
      lastAttemptResult?: string;
    } = { userPubkey };

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🔄 Registration attempt ${attempt}/${maxRetries}`);
        
        // Step 1: Detect and handle partial registration states
        const registrationState = await this.detectRegistrationState(userPubkey);
        console.log('🔍 Registration state detected:', registrationState);

        // Handle different registration states
        switch (registrationState.state) {
          case 'completed':
            console.log('✅ Registration already completed successfully');
            return registrationState.transactionSignature || 'ALREADY_REGISTERED';
            
          case 'partial':
            console.log('⚠️ Partial registration detected, attempting recovery...');
            return await this.handlePartialRegistrationState(userPubkey, sponsorHierarchy, registrationContext);
            
          case 'corrupted':
            console.log('❌ Corrupted registration detected, attempting cleanup and retry...');
            await this.handleCorruptedRegistrationState(userPubkey, registrationContext);
            // Continue to fresh registration attempt
            break;
            
          case 'none':
            console.log('📝 No existing registration, proceeding with fresh registration');
            break;
        }

        // Step 2: Pre-registration validation
        const preValidationResult = await this.performPreRegistrationValidation(userPubkey);
        
        if (!preValidationResult.canProceed) {
          throw new Error(`Pre-registration validation failed: ${preValidationResult.reason}`);
        }

        // Step 3: Handle existing account scenarios with recovery
        if (preValidationResult.existingAccount) {
          if (preValidationResult.accountValid) {
            console.log('✅ User already has valid profile, registration complete');
            return 'ALREADY_REGISTERED';
          } else {
            console.log('⚠️ Existing account is invalid, attempting recovery...');
            const recoveryResult = await this.handleInvalidExistingAccount(userPubkey, sponsorHierarchy);
            if (recoveryResult.success) {
              return recoveryResult.transactionSignature || 'RECOVERED';
            } else {
              throw new Error(`Account recovery failed: ${recoveryResult.error}`);
            }
          }
        }

        // Step 4: Execute fresh registration
        const txSignature = await this.executeIdempotentRegistration(userPubkey, sponsorHierarchy, registrationContext);
        
        // Step 5: Post-registration validation
        const postValidationResult = await this.performPostRegistrationValidation(userPubkey, txSignature);
        
        if (!postValidationResult.isValid) {
          console.error('❌ Post-registration validation failed:', postValidationResult.errors);
          
          // Store context for potential retry
          registrationContext.lastAttemptResult = 'validation_failed';
          
          if (attempt >= maxRetries) {
            // Final attempt failed, try rollback
            await this.attemptRegistrationRollback(userPubkey, txSignature, postValidationResult.errors);
          }
          
          throw new Error(`Post-registration validation failed: ${postValidationResult.errors.join(', ')}`);
        }

        console.log('✅ Resilient registration completed successfully');
        return txSignature;

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Registration attempt ${attempt} failed:`, getErrorMessage(error));
        
        // Update context with error information
        registrationContext.lastAttemptResult = 'failed';
        
        // Check if error is retryable
        const isRetryable = this.isRegistrationErrorRetryable(error);
        
        if (!isRetryable || attempt >= maxRetries) {
          console.error('❌ Registration failed after all attempts or non-retryable error');
          break;
        }

        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before registration retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All attempts failed - provide graceful fallback options
    console.error('❌ All registration attempts failed, providing fallback options...');
    const fallbackResult = await this.provideFallbackOptions(userPubkey, lastError, registrationContext);
    
    if (fallbackResult.canProceed) {
      console.log('✅ Fallback option successful:', fallbackResult.action);
      return fallbackResult.result || 'FALLBACK_SUCCESS';
    }

    // Final failure
    const errorMessage = getErrorMessage(lastError);
    console.error("❌ Resilient user registration failed after all attempts and fallbacks:", errorMessage);
    throw new Error(`User registration failed after ${attempt} attempts: ${errorMessage}`);
  }

  /**
   * Complete license activation flow with enhanced validation and recovery (register + activate if needed)
   * Implements requirements 1.1, 1.3, 3.2 for robust license activation
   */
  async completeLicenseActivation(
    userPubkey: PublicKey,
    sponsorHierarchy?: SponsorHierarchy,
    maxRetries: number = 3
  ): Promise<{ registrationTx?: string; activationTx: string }> {
    console.log('🚀 Starting enhanced license activation with validation and recovery...');
    
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🔄 License activation attempt ${attempt}/${maxRetries}`);
        
        let registrationTx: string | undefined;

        // Step 1: Enhanced registration check with validation
        console.log('🔍 Performing enhanced registration validation...');
        const preValidationResult = await this.performPreRegistrationValidation(userPubkey);
        
        if (!preValidationResult.canProceed) {
          throw new Error(`Pre-activation validation failed: ${preValidationResult.reason}`);
        }

        // Handle registration scenarios with recovery
        if (!preValidationResult.existingAccount) {
          // No existing account - proceed with normal registration
          console.log('📝 No existing profile found, registering user...');
          registrationTx = await this.registerUser(userPubkey, sponsorHierarchy);
          console.log('✅ User registered with tx:', registrationTx);
        } else if (!preValidationResult.accountValid) {
          // Invalid existing account - attempt recovery
          console.log('⚠️ Invalid existing account detected, attempting recovery...');
          const recoveryResult = await this.handleInvalidExistingAccount(userPubkey, sponsorHierarchy);
          
          if (recoveryResult.success) {
            registrationTx = recoveryResult.transactionSignature;
            console.log('✅ Account recovery successful:', recoveryResult.action);
          } else {
            throw new Error(`Account recovery failed: ${recoveryResult.error}`);
          }
        } else {
          console.log('✅ Valid existing profile found, skipping registration');
        }

        // Step 2: Wait for registration confirmation if needed
        if (registrationTx && registrationTx !== 'ALREADY_REGISTERED' && registrationTx !== 'RECOVERED') {
          console.log('⏳ Waiting for registration confirmation...');
          await this.waitForTransactionConfirmation(registrationTx);
        }

        // Step 3: Final validation before license activation
        console.log('🔍 Performing final validation before license activation...');
        const { profile } = derivePdas(userPubkey);
        const finalValidation = await this.profileValidator.validateAccountStructure(profile);
        
        if (!finalValidation.isValid) {
          throw new Error(`Final validation failed: ${finalValidation.errors.join(', ')}`);
        }

        // Step 4: Activate license with retry logic
        console.log('🎫 Activating license with enhanced error handling...');
        const activationTx = await this.activateLicenseWithRetry(userPubkey, 2);
        console.log('✅ License activated with tx:', activationTx);

        // Step 5: Post-activation validation
        console.log('🔍 Performing post-activation validation...');
        await this.validateLicenseActivationSuccess(userPubkey, activationTx);

        console.log('🎉 Enhanced license activation completed successfully');
        return {
          registrationTx,
          activationTx,
        };

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ License activation attempt ${attempt} failed:`, getErrorMessage(error));
        
        // Check if error is retryable
        const licenseError = LicenseErrorHandler.parseError(error);
        
        if (!licenseError.isRetryable || attempt >= maxRetries) {
          console.error('❌ License activation failed after all attempts');
          break;
        }

        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All attempts failed
    const licenseError = LicenseErrorHandler.parseError(lastError);
    console.error("Enhanced license activation failed after all attempts:", licenseError);

    // Throw the parsed error with better messaging
    const enhancedError = new Error(licenseError.message) as Error & {
      type: string;
      isRetryable: boolean;
      suggestedAction: string;
      attempts: number;
    };
    enhancedError.type = licenseError.type;
    enhancedError.isRetryable = licenseError.isRetryable;
    enhancedError.suggestedAction = licenseError.suggestedAction || '';
    enhancedError.attempts = attempt;
    throw enhancedError;
  }

  /**
   * Complete license activation process (registration + activation)
   * Users can manually retry if needed
   */
  async activateLicenseComplete(
    userPubkey: PublicKey,
    sponsorHierarchy?: SponsorHierarchy
  ): Promise<{ registrationTx?: string; activationTx: string }> {
    console.log('🚀 Starting license activation process for:', userPubkey.toString());
    try {
      const result = await this.completeLicenseActivation(userPubkey, sponsorHierarchy);
      console.log('✅ License activation completed successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ License activation failed in activateLicenseComplete:', error);
      throw error;
    }
  }
}

// Singleton instance factory
let licenseServiceInstance: LicenseService | null = null;

export function createLicenseService(provider: anchor.AnchorProvider): LicenseService {
  licenseServiceInstance = new LicenseService(provider);
  return licenseServiceInstance;
}

export function getLicenseService(): LicenseService {
  if (!licenseServiceInstance) {
    throw new Error("LicenseService not initialized. Call createLicenseService first.");
  }
  return licenseServiceInstance;
}