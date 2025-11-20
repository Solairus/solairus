// Removed solairus-removed; license info is from backend only
import { PublicKey } from "@solana/web3.js";

/**
 * Smart License Cache Utility
 * Purpose: Intelligent caching for license data with contract change detection
 * Features:
 * - localStorage persistence with contract versioning
 * - Long TTL for stable license data (24 hours)
 * - Contract change detection and cache invalidation
 * - Page load validation
 * - Request deduplication
 */

interface CachedLicenseData {
  licenseInfo: LicenseInfo;
  timestamp: number;
  expiresAt: number;
  programId: string; // Track which contract version this cache is for
  pageLoadValidated: boolean; // Track if validated on current page load
}

interface PendingRequest {
  promise: Promise<LicenseInfo>;
  timestamp: number;
}

export class LicenseCache {
  private static readonly CACHE_PREFIX = 'solairus_license_';
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours (long cache for stable license data)
  private static readonly PAGE_LOAD_KEY = 'solairus_page_load_validation';
  private static pendingRequests = new Map<string, PendingRequest>();
  private static pageLoadValidated = false;

  /**
   * Get cache key for a user
   */
  private static getCacheKey(userPubkey: PublicKey): string {
    return `${this.CACHE_PREFIX}${userPubkey.toString()}`;
  }

  /**
   * Get cached license data with smart validation
   */
  static getCached(userPubkey: PublicKey): LicenseInfo | null {
    try {
      const cacheKey = this.getCacheKey(userPubkey);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;

      const data: CachedLicenseData = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (now > data.expiresAt) {
        console.log('🗑️ License cache expired, removing');
        this.removeCached(userPubkey);
        return null;
      }

      // Check if contract has changed (invalidate cache)
      const currentProgramId = PROGRAM_ID.toString();
      if (data.programId !== currentProgramId) {
        console.log('🔄 Contract changed, invalidating cache:', {
          cached: data.programId,
          current: currentProgramId
        });
        this.removeCached(userPubkey);
        return null;
      }

      // Check if page load validation is needed
      if (!this.pageLoadValidated && !data.pageLoadValidated) {
        console.log('📄 Page load validation needed, cache not validated yet');
        return null; // Force fresh validation on page load
      }

      // Restore Date objects
      if (data.licenseInfo.expirationDate) {
        data.licenseInfo.expirationDate = new Date(data.licenseInfo.expirationDate);
      }

      console.log('✅ Using valid cached license data');
      return data.licenseInfo;
    } catch (error) {
      console.debug('Failed to get cached license data:', error);
      return null;
    }
  }

  /**
   * Cache license data with contract version tracking
   */
  static setCached(userPubkey: PublicKey, licenseInfo: LicenseInfo, ttl: number = this.DEFAULT_TTL): void {
    try {
      const cacheKey = this.getCacheKey(userPubkey);
      const now = Date.now();
      
      const data: CachedLicenseData = {
        licenseInfo,
        timestamp: now,
        expiresAt: now + ttl,
        programId: PROGRAM_ID.toString(),
        pageLoadValidated: this.pageLoadValidated,
      };

      localStorage.setItem(cacheKey, JSON.stringify(data));
      console.log('💾 Cached license data with contract version:', PROGRAM_ID.toString());
    } catch (error) {
      console.debug('Failed to cache license data:', error);
    }
  }

  /**
   * Remove cached data
   */
  static removeCached(userPubkey: PublicKey): void {
    try {
      const cacheKey = this.getCacheKey(userPubkey);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.debug('Failed to remove cached license data:', error);
    }
  }

  /**
   * Check if fresh validation is needed (page load or contract change)
   */
  static needsFreshValidation(userPubkey: PublicKey): boolean {
    try {
      const cacheKey = this.getCacheKey(userPubkey);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return true;

      const data: CachedLicenseData = JSON.parse(cached);
      
      // Check if contract has changed
      const currentProgramId = PROGRAM_ID.toString();
      if (data.programId !== currentProgramId) {
        return true;
      }

      // Check if page load validation is needed
      if (!this.pageLoadValidated && !data.pageLoadValidated) {
        return true;
      }

      // Check if cache is expired
      const now = Date.now();
      if (now > data.expiresAt) {
        return true;
      }

      return false;
    } catch (error) {
      return true;
    }
  }

  // Alias used by validator; maintains backward compatibility
  static needsBackgroundRefresh(userPubkey: PublicKey): boolean {
    return this.needsFreshValidation(userPubkey);
  }

  /**
   * Mark page load validation as complete
   */
  static markPageLoadValidated(): void {
    this.pageLoadValidated = true;
    localStorage.setItem(this.PAGE_LOAD_KEY, Date.now().toString());
    console.log('✅ Page load validation marked complete');
  }

  /**
   * Check if page load validation was done in this session
   */
  static isPageLoadValidated(): boolean {
    return this.pageLoadValidated;
  }

  /**
   * Reset page load validation (for testing or manual refresh)
   */
  static resetPageLoadValidation(): void {
    this.pageLoadValidated = false;
    localStorage.removeItem(this.PAGE_LOAD_KEY);
    console.log('🔄 Page load validation reset');
  }

  /**
   * Clear all cache for contract change
   */
  static clearAllForContractChange(): void {
    try {
      const keysToRemove: string[] = [];
      
      // Find all license cache keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      // Remove all license cache entries
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Reset page load validation
      this.resetPageLoadValidation();
      
      console.log(`🗑️ Cleared ${keysToRemove.length} cache entries for contract change`);
    } catch (error) {
      console.debug('Failed to clear cache for contract change:', error);
    }
  }

  /**
   * Deduplicate requests for the same user
   */
  static async deduplicateRequest<T>(
    userPubkey: PublicKey,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const requestKey = userPubkey.toString();
    const now = Date.now();

    // Check for existing pending request
    const pending = this.pendingRequests.get(requestKey);
    if (pending && (now - pending.timestamp) < 30000) { // 30 second deduplication window
      return pending.promise as Promise<T>;
    }

    // Create new request
    const promise = requestFn();
    this.pendingRequests.set(requestKey, {
      promise: promise as Promise<LicenseInfo>,
      timestamp: now,
    });

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up after request completes
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Clean up expired cache entries
   */
  static cleanupExpired(): void {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      // Check all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const data: CachedLicenseData = JSON.parse(cached);
              if (now > data.expiresAt) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // Invalid data, mark for removal
            keysToRemove.push(key);
          }
        }
      }

      // Remove expired entries
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.debug('Failed to cleanup expired cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): { totalEntries: number; expiredEntries: number } {
    let totalEntries = 0;
    let expiredEntries = 0;
    const now = Date.now();

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          totalEntries++;
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const data: CachedLicenseData = JSON.parse(cached);
              if (now > data.expiresAt) {
                expiredEntries++;
              }
            }
          } catch {
            expiredEntries++;
          }
        }
      }
    } catch (error) {
      console.debug('Failed to get cache stats:', error);
    }

    return { totalEntries, expiredEntries };
  }
}

/**
 * Hook for smart license caching with contract change detection
 */
export function useLicenseCache(userPubkey: PublicKey | null) {
  const getCached = () => {
    if (!userPubkey) return null;
    return LicenseCache.getCached(userPubkey);
  };

  const setCached = (licenseInfo: LicenseInfo, ttl?: number) => {
    if (!userPubkey) return;
    LicenseCache.setCached(userPubkey, licenseInfo, ttl);
  };

  const needsFreshValidation = () => {
    if (!userPubkey) return true;
    return LicenseCache.needsFreshValidation(userPubkey);
  };

  const markPageLoadValidated = () => {
    LicenseCache.markPageLoadValidated();
  };

  const deduplicateRequest = <T>(requestFn: () => Promise<T>) => {
    if (!userPubkey) return requestFn();
    return LicenseCache.deduplicateRequest(userPubkey, requestFn);
  };

  return {
    getCached,
    setCached,
    needsFreshValidation,
    markPageLoadValidated,
    deduplicateRequest,
    isPageLoadValidated: LicenseCache.isPageLoadValidated(),
  };
}

// Periodic cleanup
if (typeof window !== 'undefined') {
  // Clean up expired entries every 10 minutes
  setInterval(() => {
    LicenseCache.cleanupExpired();
  }, 10 * 60 * 1000);
}