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
import { getSponsorL1, buildSponsorHierarchy, type SponsorHierarchy } from "@/lib/sponsor-tree";
import { LicenseErrorHandler } from "@/utils/license-error-handler";
import { LicensePerformanceMonitor } from "@/utils/license-performance";

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

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    console.log('🔧 Initializing LicenseService with provider');
    this.program = getProgram(provider);
    console.log('✅ LicenseService initialized');
  }

  /**
   * Check if user has a profile and fetch profile data
   */
  async checkUserProfile(userPubkey: PublicKey): Promise<UserProfile | null> {
    try {
      const { profile } = derivePdas(userPubkey);
      const userProfile = await this.program.account["userProfile"].fetch(profile);
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
   * Validate sponsor hierarchy and replace unregistered sponsors with default
   * This ensures license activation doesn't fail due to unregistered sponsors
   */
  private async validateSponsorHierarchy(sponsorL1: PublicKey, sponsorL2: PublicKey, sponsorL3: PublicKey): Promise<SponsorHierarchy> {
    const program = this.program;
    const defaultSponsor = new PublicKey(import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

    console.log('🔍 Validating sponsor hierarchy...');

    // Validate L1 sponsor
    let validSponsorL1 = defaultSponsor;
    try {
      const { profile: l1Profile } = derivePdas(sponsorL1);
      await program.account["userProfile"].fetch(l1Profile);
      validSponsorL1 = sponsorL1;
      console.log('✅ L1 sponsor valid:', sponsorL1.toString());
    } catch (error) {
      console.log('⚠️ L1 sponsor not registered, using default:', defaultSponsor.toString());
    }

    // Validate L2 sponsor
    let validSponsorL2 = defaultSponsor;
    try {
      const { profile: l2Profile } = derivePdas(sponsorL2);
      await program.account["userProfile"].fetch(l2Profile);
      validSponsorL2 = sponsorL2;
      console.log('✅ L2 sponsor valid:', sponsorL2.toString());
    } catch (error) {
      console.log('⚠️ L2 sponsor not registered, using default:', defaultSponsor.toString());
    }

    // Validate L3 sponsor
    let validSponsorL3 = defaultSponsor;
    try {
      const { profile: l3Profile } = derivePdas(sponsorL3);
      await program.account["userProfile"].fetch(l3Profile);
      validSponsorL3 = sponsorL3;
      console.log('✅ L3 sponsor valid:', sponsorL3.toString());
    } catch (error) {
      console.log('⚠️ L3 sponsor not registered, using default:', defaultSponsor.toString());
    }

    return {
      sponsorL1: validSponsorL1,
      sponsorL2: validSponsorL2,
      sponsorL3: validSponsorL3
    };
  }

  /**
   * Register user with complete sponsor hierarchy built at registration time
   */
  async registerUser(userPubkey: PublicKey, sponsorHierarchy?: SponsorHierarchy): Promise<string> {
    try {
      const { config, profile } = derivePdas(userPubkey);

      // Build complete sponsor hierarchy if not provided
      let hierarchy = sponsorHierarchy;
      if (!hierarchy) {
        console.log('🌳 Building sponsor hierarchy for registration...');

        // Get L1 from referral system (could be from localStorage)
        const rawSponsorL1 = await getSponsorL1(this.provider);

        // Validate and build sponsor hierarchy with fallbacks
        const program = this.program;
        const defaultSponsor = new PublicKey(import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

        // Validate L1 sponsor - if not registered, use default
        let sponsorL1 = defaultSponsor;
        try {
          const { profile: l1Profile } = derivePdas(rawSponsorL1);
          await program.account["userProfile"].fetch(l1Profile);
          sponsorL1 = rawSponsorL1; // L1 is registered, use it
          console.log('✅ L1 sponsor is registered:', sponsorL1.toString());
        } catch (error) {
          console.log('⚠️ L1 sponsor not registered, using default:', defaultSponsor.toString());
          sponsorL1 = defaultSponsor;
        }

        let sponsorL2 = defaultSponsor;
        let sponsorL3 = defaultSponsor;

        // Try to get L1's sponsors to build L2 (only if L1 is not default)
        if (!sponsorL1.equals(defaultSponsor)) {
          try {
            const { profile: l1Profile } = derivePdas(sponsorL1);
            const l1UserProfile = await program.account["userProfile"].fetch(l1Profile);
            const rawSponsorL2 = l1UserProfile.sponsorL1 as PublicKey;

            // Validate L2 sponsor
            try {
              const { profile: l2Profile } = derivePdas(rawSponsorL2);
              await program.account["userProfile"].fetch(l2Profile);
              sponsorL2 = rawSponsorL2; // L2 is registered, use it
              console.log('✅ L2 sponsor is registered:', sponsorL2.toString());

              // Try to get L2's sponsors to build L3 (only if L2 is not default)
              if (!sponsorL2.equals(defaultSponsor)) {
                try {
                  const l2UserProfile = await program.account["userProfile"].fetch(l2Profile);
                  const rawSponsorL3 = l2UserProfile.sponsorL1 as PublicKey;

                  // Validate L3 sponsor
                  try {
                    const { profile: l3Profile } = derivePdas(rawSponsorL3);
                    await program.account["userProfile"].fetch(l3Profile);
                    sponsorL3 = rawSponsorL3; // L3 is registered, use it
                    console.log('✅ L3 sponsor is registered:', sponsorL3.toString());
                  } catch (error) {
                    console.log('⚠️ L3 sponsor not registered, using default:', defaultSponsor.toString());
                    sponsorL3 = defaultSponsor;
                  }
                } catch (error) {
                  console.log('⚠️ Could not fetch L2 profile for L3 derivation, using default');
                  sponsorL3 = defaultSponsor;
                }
              }
            } catch (error) {
              console.log('⚠️ L2 sponsor not registered, using default:', defaultSponsor.toString());
              sponsorL2 = defaultSponsor;
              sponsorL3 = defaultSponsor;
            }
          } catch (error) {
            console.log('⚠️ Could not fetch L1 profile for L2 derivation, using defaults');
            sponsorL2 = defaultSponsor;
            sponsorL3 = defaultSponsor;
          }
        }

        hierarchy = { sponsorL1, sponsorL2, sponsorL3 };
      }

      // ALWAYS validate the final hierarchy to ensure all sponsors are registered
      console.log('🔍 Final validation of sponsor hierarchy...');
      hierarchy = await this.validateSponsorHierarchy(
        hierarchy.sponsorL1,
        hierarchy.sponsorL2,
        hierarchy.sponsorL3
      );

      console.log('📝 Registering user with complete sponsor hierarchy:');
      console.log('  L1:', hierarchy.sponsorL1.toString());
      console.log('  L2:', hierarchy.sponsorL2.toString());
      console.log('  L3:', hierarchy.sponsorL3.toString());

      const txSignature = await this.program.methods
        .registerUser(hierarchy.sponsorL1, hierarchy.sponsorL2, hierarchy.sponsorL3)
        .accounts({
          config,
          profile,
          user: userPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("✅ User registration transaction:", txSignature);
      return txSignature;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("❌ User registration failed:", errorMessage);
      throw new Error(`User registration failed: ${errorMessage}`);
    }
  }

  /**
   * Complete license activation flow (register + activate if needed)
   */
  async completeLicenseActivation(
    userPubkey: PublicKey,
    sponsorHierarchy?: SponsorHierarchy
  ): Promise<{ registrationTx?: string; activationTx: string }> {
    try {
      let registrationTx: string | undefined;

      // Check if user needs registration
      console.log('🔍 Checking if user needs registration...');
      const needsReg = await this.needsRegistration(userPubkey);
      console.log('📝 User needs registration:', needsReg);

      if (needsReg) {
        console.log('📝 Registering user...');
        registrationTx = await this.registerUser(userPubkey, sponsorHierarchy);
        console.log('✅ User registered with tx:', registrationTx);

        // Wait a bit for registration to be confirmed
        console.log('⏳ Waiting for registration confirmation...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify registration was successful
        console.log('🔍 Verifying registration was successful...');
        const profileAfterReg = await this.checkUserProfile(userPubkey);
        if (!profileAfterReg) {
          throw new Error('Registration failed - user profile still not found after registration');
        }
        console.log('✅ Registration verified - user profile exists');
      }

      // Activate license
      console.log('🎫 Activating license...');
      const activationTx = await this.activateLicense(userPubkey);
      console.log('✅ License activated with tx:', activationTx);

      return {
        registrationTx,
        activationTx,
      };
    } catch (error) {
      const licenseError = LicenseErrorHandler.parseError(error);
      console.error("Complete license activation failed:", licenseError);

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