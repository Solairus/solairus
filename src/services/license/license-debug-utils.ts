import * as anchor from "@coral-xyz/anchor";
import { PublicKey, AccountInfo } from "@solana/web3.js";
import { LicenseInfo, UserProfile, getLicenseInfo } from "@/lib/solairus-removed";
import { LicenseCache } from "@/utils/license-cache";
import { LicenseStatusValidator, LicenseValidationResult, CacheValidationResult } from "./license-status-validator";

/**
 * License Debug Utilities
 * Purpose: Comprehensive debugging tools for license status inspection and troubleshooting
 * Features:
 * - On-chain data inspection with raw account analysis
 * - Cache inspection and analysis
 * - Debug report generation with recommendations
 * - Cache management and cleanup utilities
 */

export interface OnChainInspection {
  profileExists: boolean;
  profilePda: string;
  accountInfo: AccountInfo<Buffer> | null;
  decodedData: UserProfile | null;
  rawDataHex: string;
  accountOwner?: string;
  accountLamports?: number;
  accountExecutable?: boolean;
  accountRentEpoch?: number;
  decodingErrors: string[];
}

export interface LicenseCacheEntry {
  userPubkey: string;
  licenseInfo: LicenseInfo;
  timestamp: number;
  expiresAt: number;
  validationHash?: string;
  isExpired: boolean;
  isCorrupted: boolean;
}

export interface CacheInspection {
  totalEntries: number;
  licenseEntries: LicenseCacheEntry[];
  expiredEntries: number;
  corruptedEntries: number;
  totalSizeBytes: number;
  oldestEntry?: LicenseCacheEntry;
  newestEntry?: LicenseCacheEntry;
}

export interface Issue {
  severity: 'error' | 'warning' | 'info';
  category: 'onchain' | 'cache' | 'validation' | 'configuration';
  message: string;
  details?: string;
  suggestedAction?: string;
}

export interface DebugReport {
  timestamp: string;
  userPubkey: string;
  onChainInspection: OnChainInspection;
  cacheInspection: CacheInspection;
  currentStatus: LicenseInfo;
  validationResult: LicenseValidationResult;
  cacheValidationResult: CacheValidationResult;
  issues: Issue[];
  recommendations: string[];
  systemInfo: {
    programId: string;
    providerEndpoint: string;
    hasProvider: boolean;
    localStorageAvailable: boolean;
  };
}

export class LicenseDebugUtils {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private validator: LicenseStatusValidator;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
    this.validator = new LicenseStatusValidator(program, provider);
  }

  /**
   * Inspect on-chain data for a user profile
   */
  async inspectOnChainData(userPubkey: PublicKey): Promise<OnChainInspection> {
    const decodingErrors: string[] = [];

    try {
      // Derive profile PDA
      const profilePda = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        userPubkey.toBuffer(),
      ], this.program.programId)[0];

      // Fetch raw account info
      let accountInfo: AccountInfo<Buffer> | null = null;
      let rawDataHex = '';

      try {
        accountInfo = await this.provider.connection.getAccountInfo(profilePda);
        rawDataHex = accountInfo?.data ? accountInfo.data.toString('hex') : '';
      } catch (error) {
        decodingErrors.push(`Failed to fetch account info: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Try to decode profile data
      let decodedData: UserProfile | null = null;
      let profileExists = false;

      if (accountInfo && accountInfo.data && accountInfo.data.length > 0) {
        try {
          decodedData = await this.program.account["userProfile"].fetch(profilePda) as UserProfile;
          profileExists = true;
        } catch (error) {
          decodingErrors.push(`Failed to decode profile data: ${error instanceof Error ? error.message : String(error)}`);
          profileExists = false;
        }
      }

      return {
        profileExists,
        profilePda: profilePda.toString(),
        accountInfo,
        decodedData,
        rawDataHex,
        accountOwner: accountInfo?.owner?.toString(),
        accountLamports: accountInfo?.lamports,
        accountExecutable: accountInfo?.executable,
        accountRentEpoch: accountInfo?.rentEpoch,
        decodingErrors,
      };
    } catch (error) {
      decodingErrors.push(`On-chain inspection failed: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        profileExists: false,
        profilePda: 'unknown',
        accountInfo: null,
        decodedData: null,
        rawDataHex: '',
        decodingErrors,
      };
    }
  }

  /**
   * Inspect localStorage cache entries
   */
  inspectCache(): CacheInspection {
    const licenseEntries: LicenseCacheEntry[] = [];
    let totalSizeBytes = 0;
    let expiredEntries = 0;
    let corruptedEntries = 0;
    const now = Date.now();

    try {
      // Scan all localStorage entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('solairus_license_')) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              totalSizeBytes += value.length * 2; // Rough estimate (UTF-16)
              
              const cachedData = JSON.parse(value);
              const userPubkey = key.replace('solairus_license_', '');
              
              // Validate cache entry structure
              let isCorrupted = false;
              if (!cachedData.licenseInfo || !cachedData.timestamp || !cachedData.expiresAt) {
                isCorrupted = true;
                corruptedEntries++;
              }

              const isExpired = now > cachedData.expiresAt;
              if (isExpired) {
                expiredEntries++;
              }

              // Restore Date objects for inspection
              if (cachedData.licenseInfo?.expirationDate) {
                try {
                  cachedData.licenseInfo.expirationDate = new Date(cachedData.licenseInfo.expirationDate);
                } catch {
                  isCorrupted = true;
                }
              }

              licenseEntries.push({
                userPubkey,
                licenseInfo: cachedData.licenseInfo,
                timestamp: cachedData.timestamp,
                expiresAt: cachedData.expiresAt,
                validationHash: cachedData.validationHash,
                isExpired,
                isCorrupted,
              });
            }
          } catch (error) {
            corruptedEntries++;
            console.debug('Failed to parse cache entry:', key, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to inspect cache:', error);
    }

    // Sort entries by timestamp
    licenseEntries.sort((a, b) => a.timestamp - b.timestamp);

    return {
      totalEntries: licenseEntries.length,
      licenseEntries,
      expiredEntries,
      corruptedEntries,
      totalSizeBytes,
      oldestEntry: licenseEntries[0],
      newestEntry: licenseEntries[licenseEntries.length - 1],
    };
  }

  /**
   * Generate comprehensive debug report
   */
  async generateDebugReport(userPubkey: PublicKey): Promise<DebugReport> {
    const timestamp = new Date().toISOString();
    const issues: Issue[] = [];
    const recommendations: string[] = [];

    try {
      // Perform inspections
      const onChainInspection = await this.inspectOnChainData(userPubkey);
      const cacheInspection = this.inspectCache();
      const validationResult = await this.validator.validateOnChain(userPubkey);
      const cacheValidationResult = this.validator.validateCache(userPubkey);
      
      // Get current status
      const currentStatus = getLicenseInfo(onChainInspection.decodedData);

      // Analyze issues
      this.analyzeIssues(onChainInspection, cacheInspection, validationResult, cacheValidationResult, issues, recommendations);

      // System info
      const systemInfo = {
        programId: this.program.programId.toString(),
        providerEndpoint: this.provider.connection.rpcEndpoint,
        hasProvider: !!this.provider,
        localStorageAvailable: typeof localStorage !== 'undefined',
      };

      return {
        timestamp,
        userPubkey: userPubkey.toString(),
        onChainInspection,
        cacheInspection,
        currentStatus,
        validationResult,
        cacheValidationResult,
        issues,
        recommendations,
        systemInfo,
      };
    } catch (error) {
      issues.push({
        severity: 'error',
        category: 'validation',
        message: 'Failed to generate debug report',
        details: error instanceof Error ? error.message : String(error),
        suggestedAction: 'Check network connection and try again',
      });

      return {
        timestamp,
        userPubkey: userPubkey.toString(),
        onChainInspection: {
          profileExists: false,
          profilePda: 'unknown',
          accountInfo: null,
          decodedData: null,
          rawDataHex: '',
          decodingErrors: ['Debug report generation failed'],
        },
        cacheInspection: {
          totalEntries: 0,
          licenseEntries: [],
          expiredEntries: 0,
          corruptedEntries: 0,
          totalSizeBytes: 0,
        },
        currentStatus: { status: 'none', isValid: false },
        validationResult: {
          hasProfile: false,
          profileData: null,
          licenseInfo: { status: 'none', isValid: false },
          validationTimestamp: Date.now(),
          errors: ['Debug report generation failed'],
        },
        cacheValidationResult: {
          isValid: false,
          isExpired: false,
          cachedInfo: null,
          shouldRefresh: true,
          issues: ['Debug report generation failed'],
        },
        issues,
        recommendations,
        systemInfo: {
          programId: 'unknown',
          providerEndpoint: 'unknown',
          hasProvider: false,
          localStorageAvailable: false,
        },
      };
    }
  }

  /**
   * Analyze issues and generate recommendations
   */
  private analyzeIssues(
    onChain: OnChainInspection,
    cache: CacheInspection,
    validation: LicenseValidationResult,
    cacheValidation: CacheValidationResult,
    issues: Issue[],
    recommendations: string[]
  ): void {
    // On-chain issues
    if (!onChain.profileExists) {
      issues.push({
        severity: 'info',
        category: 'onchain',
        message: 'User profile does not exist on-chain',
        details: 'This is expected for new users who have not registered yet',
        suggestedAction: 'Register user profile before activating license',
      });
      recommendations.push('User needs to register before activating a license');
    }

    if (onChain.decodingErrors.length > 0) {
      issues.push({
        severity: 'error',
        category: 'onchain',
        message: 'Failed to decode on-chain data',
        details: onChain.decodingErrors.join('; '),
        suggestedAction: 'Check network connection and program deployment',
      });
      recommendations.push('Verify smart contract is properly deployed and accessible');
    }

    // Cache issues
    if (cache.corruptedEntries > 0) {
      issues.push({
        severity: 'warning',
        category: 'cache',
        message: `Found ${cache.corruptedEntries} corrupted cache entries`,
        suggestedAction: 'Clear corrupted cache entries',
      });
      recommendations.push('Clear browser cache to remove corrupted entries');
    }

    if (cache.expiredEntries > 0) {
      issues.push({
        severity: 'info',
        category: 'cache',
        message: `Found ${cache.expiredEntries} expired cache entries`,
        suggestedAction: 'Clean up expired cache entries',
      });
      recommendations.push('Expired cache entries will be cleaned up automatically');
    }

    // Validation issues
    if (validation.errors.length > 0) {
      issues.push({
        severity: 'error',
        category: 'validation',
        message: 'On-chain validation errors',
        details: validation.errors.join('; '),
        suggestedAction: 'Check network connection and retry',
      });
      recommendations.push('Retry license status check with stable network connection');
    }

    if (cacheValidation.issues.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'cache',
        message: 'Cache validation issues',
        details: cacheValidation.issues.join('; '),
        suggestedAction: 'Clear cache and refresh license status',
      });
      recommendations.push('Clear license cache to resolve validation issues');
    }

    // Status consistency issues
    if (onChain.profileExists && validation.licenseInfo.status === 'loading') {
      issues.push({
        severity: 'error',
        category: 'validation',
        message: 'License status stuck in loading state',
        details: 'Profile exists but status determination failed',
        suggestedAction: 'Force refresh license status',
      });
      recommendations.push('Use force refresh to bypass cache and re-validate status');
    }

    // Performance recommendations
    if (cache.totalSizeBytes > 100000) { // 100KB
      recommendations.push('Consider clearing old cache entries to improve performance');
    }

    if (cache.totalEntries > 10) {
      recommendations.push('Large number of cached entries detected - periodic cleanup recommended');
    }
  }

  /**
   * Clear all license cache data
   */
  clearAllLicenseData(): { cleared: number; errors: string[] } {
    let cleared = 0;
    const errors: string[] = [];

    try {
      const keysToRemove: string[] = [];
      
      // Find all license cache keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('solairus_license_')) {
          keysToRemove.push(key);
        }
      }

      // Remove each key
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          cleared++;
        } catch (error) {
          errors.push(`Failed to remove ${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } catch (error) {
      errors.push(`Failed to clear license data: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { cleared, errors };
  }

  /**
   * Get cache health summary
   */
  getCacheHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    totalEntries: number;
    issues: string[];
    recommendations: string[];
  } {
    const cache = this.inspectCache();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (cache.corruptedEntries > 0) {
      status = 'critical';
      issues.push(`${cache.corruptedEntries} corrupted entries found`);
      recommendations.push('Clear corrupted cache entries immediately');
    }

    if (cache.expiredEntries > cache.totalEntries * 0.5) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`High number of expired entries (${cache.expiredEntries}/${cache.totalEntries})`);
      recommendations.push('Run cache cleanup to remove expired entries');
    }

    if (cache.totalSizeBytes > 500000) { // 500KB
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`Large cache size (${Math.round(cache.totalSizeBytes / 1024)}KB)`);
      recommendations.push('Consider clearing old cache entries');
    }

    if (issues.length === 0) {
      recommendations.push('Cache is healthy - no action needed');
    }

    return {
      status,
      totalEntries: cache.totalEntries,
      issues,
      recommendations,
    };
  }

  /**
   * Export debug data for support
   */
  async exportDebugData(userPubkey: PublicKey): Promise<string> {
    try {
      const report = await this.generateDebugReport(userPubkey);
      
      // Remove sensitive data
      const sanitizedReport = {
        ...report,
        userPubkey: `${userPubkey.toString().slice(0, 8)}...${userPubkey.toString().slice(-8)}`,
        onChainInspection: {
          ...report.onChainInspection,
          rawDataHex: report.onChainInspection.rawDataHex ? `[${report.onChainInspection.rawDataHex.length} bytes]` : '',
        },
      };

      return JSON.stringify(sanitizedReport, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Failed to export debug data',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }, null, 2);
    }
  }
}