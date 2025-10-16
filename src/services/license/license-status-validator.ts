import * as anchor from "@coral-xyz/anchor";
import { PublicKey, AccountInfo } from "@solana/web3.js";
import { LicenseInfo, UserProfile, getLicenseInfo } from "@/lib/solairus-main";
import { LicenseCache } from "@/utils/license-cache";

/**
 * License Status Validator
 * Purpose: Validates license status against on-chain reality and manages cache consistency
 * Features:
 * - On-chain validation with raw account data inspection
 * - Cache validation with expiry and corruption checks
 * - Status reconciliation between on-chain and cached data
 * - Comprehensive error handling and fallback logic
 */

export interface LicenseValidationResult {
  hasProfile: boolean;
  profileData: UserProfile | null;
  licenseInfo: LicenseInfo;
  rawAccountData?: Buffer;
  validationTimestamp: number;
  errors: string[];
}

export interface CacheValidationResult {
  isValid: boolean;
  isExpired: boolean;
  cachedInfo: LicenseInfo | null;
  shouldRefresh: boolean;
  issues: string[];
  lastValidated?: number;
}

export interface EnhancedLicenseInfo extends LicenseInfo {
  source: 'onchain' | 'cache' | 'default';
  lastValidated: number;
  validationMethod: 'full' | 'cached' | 'error-fallback';
  debugInfo?: {
    profileExists: boolean;
    cacheHit: boolean;
    errors: string[];
  };
}

export class LicenseStatusValidator {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
  }

  /**
   * Validate license status against on-chain data
   */
  async validateOnChain(userPubkey: PublicKey): Promise<LicenseValidationResult> {
    const validationTimestamp = Date.now();
    const errors: string[] = [];

    try {
      // Derive profile PDA
      const profilePda = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        userPubkey.toBuffer(),
      ], this.program.programId)[0];

      // Fetch raw account info first
      let rawAccountData: Buffer | undefined;
      let accountInfo: AccountInfo<Buffer> | null = null;

      try {
        accountInfo = await this.provider.connection.getAccountInfo(profilePda);
        rawAccountData = accountInfo?.data;
      } catch (error) {
        errors.push(`Failed to fetch raw account data: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Try to fetch and decode profile data
      let profileData: UserProfile | null = null;
      let hasProfile = false;

      if (accountInfo && accountInfo.data) {
        try {
          profileData = await this.program.account["userProfile"].fetch(profilePda) as UserProfile;
          hasProfile = true;
        } catch (error) {
          errors.push(`Failed to decode profile data: ${error instanceof Error ? error.message : String(error)}`);
          hasProfile = false;
        }
      }

      // Generate license info
      const licenseInfo = getLicenseInfo(profileData);

      return {
        hasProfile,
        profileData,
        licenseInfo,
        rawAccountData,
        validationTimestamp,
        errors,
      };
    } catch (error) {
      errors.push(`On-chain validation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        hasProfile: false,
        profileData: null,
        licenseInfo: {
          status: 'none',
          isValid: false,
        },
        validationTimestamp,
        errors,
      };
    }
  }

  /**
   * Validate cached license data
   */
  validateCache(userPubkey: PublicKey): CacheValidationResult {
    const issues: string[] = [];
    let isValid = false;
    let isExpired = false;
    let shouldRefresh = true;
    let cachedInfo: LicenseInfo | null = null;
    let lastValidated: number | undefined;

    try {
      // Get cached data
      cachedInfo = LicenseCache.getCached(userPubkey);
      
      if (!cachedInfo) {
        issues.push('No cached data found');
        shouldRefresh = true;
        return {
          isValid: false,
          isExpired: false,
          cachedInfo: null,
          shouldRefresh: true,
          issues,
        };
      }

      // Check if cache needs background refresh
      const needsRefresh = LicenseCache.needsBackgroundRefresh(userPubkey);
      if (needsRefresh) {
        issues.push('Cache data is stale and needs refresh');
        shouldRefresh = true;
      } else {
        shouldRefresh = false;
      }

      // Validate cache structure
      if (!cachedInfo.status || typeof cachedInfo.isValid !== 'boolean') {
        issues.push('Cached data has invalid structure');
        isValid = false;
        shouldRefresh = true;
      } else {
        isValid = true;
      }

      // Check for expired license in cache
      if (cachedInfo.status === 'expired') {
        isExpired = true;
        issues.push('Cached license is expired');
      }

      // Validate expiration date if present
      if (cachedInfo.expirationDate) {
        try {
          const expDate = new Date(cachedInfo.expirationDate);
          if (isNaN(expDate.getTime())) {
            issues.push('Cached expiration date is invalid');
            isValid = false;
          } else if (expDate < new Date()) {
            isExpired = true;
            issues.push('Cached license has expired');
          }
        } catch (error) {
          issues.push('Failed to parse cached expiration date');
          isValid = false;
        }
      }

    } catch (error) {
      issues.push(`Cache validation error: ${error instanceof Error ? error.message : String(error)}`);
      isValid = false;
      shouldRefresh = true;
    }

    return {
      isValid,
      isExpired,
      cachedInfo,
      shouldRefresh,
      issues,
      lastValidated,
    };
  }

  /**
   * Reconcile status between on-chain and cached data
   */
  reconcileStatus(onChain: LicenseInfo, cached: LicenseInfo | null): EnhancedLicenseInfo {
    const now = Date.now();
    const debugInfo = {
      profileExists: onChain.status !== 'none',
      cacheHit: cached !== null,
      errors: [] as string[],
    };

    // If no cached data, use on-chain data
    if (!cached) {
      return {
        ...onChain,
        source: 'onchain',
        lastValidated: now,
        validationMethod: 'full',
        debugInfo,
      };
    }

    // Compare status values
    if (onChain.status !== cached.status) {
      debugInfo.errors.push(`Status mismatch: on-chain=${onChain.status}, cached=${cached.status}`);
      
      // On-chain data takes precedence
      return {
        ...onChain,
        source: 'onchain',
        lastValidated: now,
        validationMethod: 'full',
        debugInfo,
      };
    }

    // Compare validity
    if (onChain.isValid !== cached.isValid) {
      debugInfo.errors.push(`Validity mismatch: on-chain=${onChain.isValid}, cached=${cached.isValid}`);
      
      // On-chain data takes precedence
      return {
        ...onChain,
        source: 'onchain',
        lastValidated: now,
        validationMethod: 'full',
        debugInfo,
      };
    }

    // Compare expiration dates if both exist
    if (onChain.expirationDate && cached.expirationDate) {
      const onChainTime = onChain.expirationDate.getTime();
      const cachedTime = new Date(cached.expirationDate).getTime();
      
      if (Math.abs(onChainTime - cachedTime) > 1000) { // Allow 1 second difference
        debugInfo.errors.push(`Expiration date mismatch: on-chain=${onChain.expirationDate.toISOString()}, cached=${new Date(cached.expirationDate).toISOString()}`);
        
        // On-chain data takes precedence
        return {
          ...onChain,
          source: 'onchain',
          lastValidated: now,
          validationMethod: 'full',
          debugInfo,
        };
      }
    }

    // Data matches, use cached data but mark as validated
    return {
      ...cached,
      source: 'cache',
      lastValidated: now,
      validationMethod: 'cached',
      debugInfo,
    };
  }

  /**
   * Clear license cache for a user
   */
  clearCache(userPubkey: PublicKey): void {
    try {
      LicenseCache.removeCached(userPubkey);
    } catch (error) {
      console.error('Failed to clear license cache:', error);
    }
  }

  /**
   * Force refresh license status bypassing cache
   */
  async forceRefresh(userPubkey: PublicKey): Promise<EnhancedLicenseInfo> {
    // Clear existing cache
    this.clearCache(userPubkey);

    // Validate on-chain
    const onChainResult = await this.validateOnChain(userPubkey);
    
    // Cache the fresh data
    if (onChainResult.licenseInfo && !onChainResult.errors.length) {
      LicenseCache.setCached(userPubkey, onChainResult.licenseInfo);
    }

    // Return enhanced license info
    return {
      ...onChainResult.licenseInfo,
      source: 'onchain',
      lastValidated: onChainResult.validationTimestamp,
      validationMethod: 'full',
      debugInfo: {
        profileExists: onChainResult.hasProfile,
        cacheHit: false,
        errors: onChainResult.errors,
      },
    };
  }

  /**
   * Get comprehensive license status with validation
   * ALWAYS fetches fresh on-chain data first, cache is only for fallback
   */
  async getValidatedLicenseStatus(userPubkey: PublicKey, useCache: boolean = false): Promise<EnhancedLicenseInfo> {
    try {
      // ALWAYS validate on-chain first (critical for contract changes/upgrades)
      console.log('🔍 Fetching fresh on-chain license data for:', userPubkey.toString());
      const onChainResult = await this.validateOnChain(userPubkey);
      
      // If on-chain validation successful, use it and update cache
      if (onChainResult.errors.length === 0) {
        console.log('✅ On-chain validation successful, caching fresh data');
        LicenseCache.setCached(userPubkey, onChainResult.licenseInfo);
        
        return {
          ...onChainResult.licenseInfo,
          source: 'onchain',
          lastValidated: onChainResult.validationTimestamp,
          validationMethod: 'full',
          debugInfo: {
            profileExists: onChainResult.hasProfile,
            cacheHit: false,
            errors: onChainResult.errors,
          },
        };
      }

      // On-chain failed, try cache as fallback only if explicitly allowed
      if (useCache) {
        console.log('⚠️ On-chain validation failed, trying cache fallback');
        const cacheValidation = this.validateCache(userPubkey);
        
        if (cacheValidation.isValid && cacheValidation.cachedInfo) {
          console.log('📦 Using cached data as fallback');
          return {
            ...cacheValidation.cachedInfo,
            source: 'cache',
            lastValidated: Date.now(),
            validationMethod: 'cached',
            debugInfo: {
              profileExists: cacheValidation.cachedInfo.status !== 'none',
              cacheHit: true,
              errors: [...onChainResult.errors, ...cacheValidation.issues],
            },
          };
        }
      }

      // Both on-chain and cache failed, return error state
      console.log('❌ Both on-chain and cache validation failed');
      return {
        status: 'none',
        isValid: false,
        source: 'default',
        lastValidated: Date.now(),
        validationMethod: 'error-fallback',
        debugInfo: {
          profileExists: false,
          cacheHit: false,
          errors: onChainResult.errors,
        },
      };
    } catch (error) {
      console.error('License status validation failed:', error);
      
      // Return error fallback state
      return {
        status: 'none',
        isValid: false,
        source: 'default',
        lastValidated: Date.now(),
        validationMethod: 'error-fallback',
        debugInfo: {
          profileExists: false,
          cacheHit: false,
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  }

  /**
   * Get license status with cache preference (for performance-sensitive operations)
   */
  async getLicenseStatusCacheFirst(userPubkey: PublicKey): Promise<EnhancedLicenseInfo> {
    try {
      // Check cache first for performance
      const cacheValidation = this.validateCache(userPubkey);
      
      // If cache is valid and fresh, use it
      if (cacheValidation.isValid && !cacheValidation.shouldRefresh && cacheValidation.cachedInfo) {
        console.log('📦 Using fresh cached data');
        return {
          ...cacheValidation.cachedInfo,
          source: 'cache',
          lastValidated: Date.now(),
          validationMethod: 'cached',
          debugInfo: {
            profileExists: cacheValidation.cachedInfo.status !== 'none',
            cacheHit: true,
            errors: cacheValidation.issues,
          },
        };
      }

      // Cache is stale or invalid, fetch fresh data
      console.log('🔄 Cache is stale, fetching fresh on-chain data');
      return await this.getValidatedLicenseStatus(userPubkey, false);
    } catch (error) {
      console.error('Cache-first license status failed:', error);
      return await this.getValidatedLicenseStatus(userPubkey, true);
    }
  }
}