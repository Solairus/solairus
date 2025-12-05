import { PublicKey } from "@solana/web3.js";
import axios from 'axios';
import { LicenseInfo, UserProfile, AgentTier } from "@/types/backend";
import { LicenseCache } from "@/utils/license-cache";

/**
 * License Status Validator via Backend API
 */

export interface LicenseValidationResult {
  hasProfile: boolean;
  profileData: UserProfile | null;
  licenseInfo: LicenseInfo;
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
  source: 'backend' | 'cache' | 'default';
  lastValidated: number;
  validationMethod: 'full' | 'cached' | 'error-fallback';
  debugInfo?: {
    cacheHit: boolean;
    errors: string[];
  };
}

export class LicenseStatusValidator {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Validate license status against backend API
   */
  async validateOnBackend(userPubkey: PublicKey): Promise<LicenseValidationResult> {
    const validationTimestamp = Date.now();
    const errors: string[] = [];

    try {
      // Fetch license status from API
      // GET /api/license/status/:pubkey
      const response = await axios.get<{ license: LicenseInfo, profile: UserProfile }>(`${this.baseUrl}/license/status/${userPubkey.toString()}`);

      const { license, profile } = response.data;

      return {
        hasProfile: !!profile,
        profileData: profile || null,
        licenseInfo: license,
        validationTimestamp,
        errors
      };

    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.message : String(error);
      errors.push(`Backend validation failed: ${msg}`);

      return {
        hasProfile: false,
        profileData: null,
        licenseInfo: {
          active: false,
          tier: AgentTier.None,
          expiryDate: null,
        } as LicenseInfo,
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
    const isExpired = false;
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

      isValid = true;
      // Further checks could be added here similar to original logic

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

    // Validate on backend
    const result = await this.validateOnBackend(userPubkey);

    // Cache the fresh data
    if (result.licenseInfo && !result.errors.length) {
      LicenseCache.setCached(userPubkey, result.licenseInfo);
    }

    // Return enhanced license info
    return {
      ...result.licenseInfo,
      source: 'backend',
      lastValidated: result.validationTimestamp,
      validationMethod: 'full',
      debugInfo: {
        cacheHit: false,
        errors: result.errors,
      },
    };
  }

  /**
   * Get comprehensive license status with smart caching
   */
  async getValidatedLicenseStatus(userPubkey: PublicKey, forceRefresh: boolean = false): Promise<EnhancedLicenseInfo> {
    try {
      // Check if we need fresh validation (page load, or force refresh)
      const needsFresh = forceRefresh || LicenseCache.needsFreshValidation(userPubkey);

      if (!needsFresh) {
        // Try cache first
        const cachedInfo = LicenseCache.getCached(userPubkey);
        if (cachedInfo) {
          console.log('📦 Using valid cached license data');
          return {
            ...cachedInfo,
            source: 'cache',
            lastValidated: Date.now(),
            validationMethod: 'cached',
            debugInfo: {
              cacheHit: true,
              errors: [],
            },
          };
        }
      }

      // Need fresh validation - fetch from backend
      console.log('🔍 Fetching fresh license data for:', userPubkey.toString());
      const result = await this.validateOnBackend(userPubkey);

      if (result.errors.length === 0) {
        console.log('✅ Backend validation successful, caching fresh data');
        LicenseCache.setCached(userPubkey, result.licenseInfo);
        LicenseCache.markPageLoadValidated();

        return {
          ...result.licenseInfo,
          source: 'backend',
          lastValidated: result.validationTimestamp,
          validationMethod: 'full',
          debugInfo: {
            cacheHit: false,
            errors: result.errors,
          },
        };
      }

      // Backend failed, try cache fallback
      console.log('⚠️ Backend validation failed, trying cache fallback');
      const cacheValidation = this.validateCache(userPubkey);

      if (cacheValidation.isValid && cacheValidation.cachedInfo) {
        return {
          ...cacheValidation.cachedInfo,
          source: 'cache',
          lastValidated: Date.now(),
          validationMethod: 'cached',
          debugInfo: {
            cacheHit: true,
            errors: [...result.errors, ...cacheValidation.issues],
          },
        };
      }

      // All failed
      return {
        active: false,
        tier: AgentTier.None,
        expiryDate: null,
        source: 'default',
        lastValidated: Date.now(),
        validationMethod: 'error-fallback',
        debugInfo: {
          cacheHit: false,
          errors: result.errors
        }
      };

    } catch (error) {
      console.error('License status validation failed:', error);
      return {
        active: false,
        tier: AgentTier.None,
        expiryDate: null,
        source: 'default',
        lastValidated: Date.now(),
        validationMethod: 'error-fallback',
        debugInfo: {
          cacheHit: false,
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  }

  async getLicenseStatusOptimized(userPubkey: PublicKey): Promise<EnhancedLicenseInfo> {
    return await this.getValidatedLicenseStatus(userPubkey, false);
  }
}