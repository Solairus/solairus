import { LicenseInfo } from "@/lib/solairus-main";
import { PublicKey } from "@solana/web3.js";

/**
 * License Cache Utility
 * Purpose: Efficient caching and background refresh for license data
 * Features:
 * - localStorage persistence
 * - TTL-based expiration
 * - Background refresh
 * - Request deduplication
 */

interface CachedLicenseData {
  licenseInfo: LicenseInfo;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest {
  promise: Promise<LicenseInfo>;
  timestamp: number;
}

export class LicenseCache {
  private static readonly CACHE_PREFIX = 'solairus_license_';
  private static readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes (longer cache)
  private static readonly BACKGROUND_REFRESH_THRESHOLD = 25 * 60 * 1000; // 25 minutes (less frequent refresh)
  private static pendingRequests = new Map<string, PendingRequest>();

  /**
   * Get cache key for a user
   */
  private static getCacheKey(userPubkey: PublicKey): string {
    return `${this.CACHE_PREFIX}${userPubkey.toString()}`;
  }

  /**
   * Get cached license data
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
        this.removeCached(userPubkey);
        return null;
      }

      // Restore Date objects
      if (data.licenseInfo.expirationDate) {
        data.licenseInfo.expirationDate = new Date(data.licenseInfo.expirationDate);
      }

      return data.licenseInfo;
    } catch (error) {
      console.debug('Failed to get cached license data:', error);
      return null;
    }
  }

  /**
   * Cache license data
   */
  static setCached(userPubkey: PublicKey, licenseInfo: LicenseInfo, ttl: number = this.DEFAULT_TTL): void {
    try {
      const cacheKey = this.getCacheKey(userPubkey);
      const now = Date.now();
      
      const data: CachedLicenseData = {
        licenseInfo,
        timestamp: now,
        expiresAt: now + ttl,
      };

      localStorage.setItem(cacheKey, JSON.stringify(data));
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
   * Check if cached data needs background refresh
   */
  static needsBackgroundRefresh(userPubkey: PublicKey): boolean {
    try {
      const cacheKey = this.getCacheKey(userPubkey);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return true;

      const data: CachedLicenseData = JSON.parse(cached);
      const now = Date.now();
      const age = now - data.timestamp;

      return age > this.BACKGROUND_REFRESH_THRESHOLD;
    } catch (error) {
      return true;
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
 * Hook for optimized license caching
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

  const needsRefresh = () => {
    if (!userPubkey) return true;
    return LicenseCache.needsBackgroundRefresh(userPubkey);
  };

  const deduplicateRequest = <T>(requestFn: () => Promise<T>) => {
    if (!userPubkey) return requestFn();
    return LicenseCache.deduplicateRequest(userPubkey, requestFn);
  };

  return {
    getCached,
    setCached,
    needsRefresh,
    deduplicateRequest,
  };
}

// Periodic cleanup
if (typeof window !== 'undefined') {
  // Clean up expired entries every 10 minutes
  setInterval(() => {
    LicenseCache.cleanupExpired();
  }, 10 * 60 * 1000);
}