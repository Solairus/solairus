/**
 * LicenseService
 * 
 * Purpose: Service layer for managing license operations with backend-first architecture
 * 
 * Key Features:
 * - License status validation via backend APIs
 * - User profile management via backend APIs
 * - License activation via backend APIs
 * - Error handling with user-friendly messages
 * 
 * Architecture Notes:
 * - All license data comes from backend APIs, not on-chain calls
 * - No smart contract dependencies
 * - Backend handles all blockchain interactions
 */

import { API_CONFIG, LICENSE_ENDPOINTS, ApiClient } from '@/config/service-endpoints';

export interface UserProfile {
  pubkey: string;
  isRegistered: boolean;
  licenseExpiry?: number;
  licenseTier?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface LicenseInfo {
  isActive: boolean;
  tier: string;
  expiryDate: Date | null;
  daysRemaining: number;
}

export interface LicenseActivationParams {
  userPubkey: string;
  tier: string;
  paymentMethod: 'usdt' | 'credit';
  amount: number;
}

export interface LicenseActivationResult {
  success: boolean;
  txSignature?: string;
  licenseExpiry?: number;
  error?: string;
  userFriendlyMessage?: string;
}

export class LicenseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.getBaseUrl();
  }

  /**
   * Check if user has a profile via backend API
   */
  async checkUserProfile(userPubkey: string): Promise<UserProfile | null> {
    try {
      const url = `${this.baseUrl}${LICENSE_ENDPOINTS.getProfile(userPubkey)}`;
      const response = await ApiClient.get(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // User not found
        }
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      }
      
      const profile = await response.json();
      return profile as UserProfile;
    } catch (error) {
      console.error('Error checking user profile:', error);
      throw new Error('Failed to check user profile. Please try again.');
    }
  }

  /**
   * Check if user is registered
   */
  async isUserRegistered(userPubkey: string): Promise<boolean> {
    try {
      const profile = await this.checkUserProfile(userPubkey);
      return profile?.isRegistered || false;
    } catch (error) {
      console.error('Error checking registration status:', error);
      return false;
    }
  }

  /**
   * Get license info for user
   */
  async getLicenseInfo(userPubkey: string): Promise<LicenseInfo> {
    try {
      const profile = await this.checkUserProfile(userPubkey);
      
      if (!profile || !profile.licenseExpiry) {
        return {
          isActive: false,
          tier: 'NONE',
          expiryDate: null,
          daysRemaining: 0
        };
      }

      const expiryDate = new Date(profile.licenseExpiry * 1000);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        isActive: daysRemaining > 0,
        tier: profile.licenseTier || 'NONE',
        expiryDate,
        daysRemaining
      };
    } catch (error) {
      console.error('Error getting license info:', error);
      throw new Error('Failed to get license information. Please try again.');
    }
  }

  /**
   * Check if license is active
   */
  async isLicenseActive(userPubkey: string): Promise<boolean> {
    try {
      const licenseInfo = await this.getLicenseInfo(userPubkey);
      return licenseInfo.isActive;
    } catch (error) {
      console.error('Error checking license status:', error);
      return false;
    }
  }

  /**
   * Get license expiry date
   */
  async getLicenseExpiryDate(userPubkey: string): Promise<Date | null> {
    try {
      const licenseInfo = await this.getLicenseInfo(userPubkey);
      return licenseInfo.expiryDate;
    } catch (error) {
      console.error('Error getting license expiry:', error);
      return null;
    }
  }

  /**
   * Get days remaining until license expiry
   */
  async getDaysRemaining(userPubkey: string): Promise<number> {
    try {
      const licenseInfo = await this.getLicenseInfo(userPubkey);
      return licenseInfo.daysRemaining;
    } catch (error) {
      console.error('Error calculating days remaining:', error);
      return 0;
    }
  }

  /**
   * Check if license is near expiry (within 7 days)
   */
  async isNearExpiry(userPubkey: string): Promise<boolean> {
    try {
      const daysRemaining = await this.getDaysRemaining(userPubkey);
      return daysRemaining <= 7 && daysRemaining > 0;
    } catch (error) {
      console.error('Error checking near expiry:', error);
      return false;
    }
  }

  /**
   * Get license fee for a tier
   */
  async getLicenseFee(tier: string): Promise<number> {
    try {
      const url = `${this.baseUrl}${LICENSE_ENDPOINTS.getLicenseFee(tier)}`;
      const response = await ApiClient.get(url);
      
      if (!response.ok) {
        throw new Error(`Failed to get license fee: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.fee || 0;
    } catch (error) {
      console.error('Error getting license fee:', error);
      throw new Error('Failed to get license fee. Please try again.');
    }
  }

  /**
   * Get license duration for a tier
   */
  async getLicenseDuration(tier: string): Promise<number> {
    try {
      const url = `${this.baseUrl}${LICENSE_ENDPOINTS.getLicenseDuration(tier)}`;
      const response = await ApiClient.get(url);
      
      if (!response.ok) {
        throw new Error(`Failed to get license duration: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.duration || 0;
    } catch (error) {
      console.error('Error getting license duration:', error);
      throw new Error('Failed to get license duration. Please try again.');
    }
  }

  /**
   * Activate license via backend API
   */
  async activateLicense(params: LicenseActivationParams): Promise<LicenseActivationResult> {
    try {
      console.log('🚀 Starting license activation via backend:', {
        userPubkey: params.userPubkey,
        tier: params.tier,
        paymentMethod: params.paymentMethod,
        amount: params.amount
      });

      const url = `${this.baseUrl}${LICENSE_ENDPOINTS.activateLicense}`;
      const response = await ApiClient.post(url, {
        userPubkey: params.userPubkey,
        tier: params.tier,
        paymentMethod: params.paymentMethod,
        amount: params.amount
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'License activation failed');
      }

      const result = await response.json();
      
      console.log('✅ License activation successful:', result);
      return {
        success: true,
        txSignature: result.txSignature,
        licenseExpiry: result.licenseExpiry,
        userFriendlyMessage: `Successfully activated ${params.tier} license!`
      };

    } catch (error) {
      console.error('❌ License activation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'License activation failed';
      
      return {
        success: false,
        error: errorMessage,
        userFriendlyMessage: errorMessage
      };
    }
  }

  /**
   * Register user via backend API
   */
  async registerUser(userPubkey: string, referrer?: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚀 Starting user registration via backend:', { userPubkey, referrer });

      const url = `${this.baseUrl}${LICENSE_ENDPOINTS.registerUser}`;
      const response = await ApiClient.post(url, {
        userPubkey,
        referrer
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'User registration failed');
      }

      const result = await response.json();
      
      console.log('✅ User registration successful:', result);
      return {
        success: true
      };

    } catch (error) {
      console.error('❌ User registration failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'User registration failed';
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

// Export singleton instance
export const licenseService = new LicenseService();