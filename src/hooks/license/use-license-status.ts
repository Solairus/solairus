import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/wallet-context";
import { LicenseService, createLicenseService } from "@/services/license/license-service";
import { LicenseInfo, LicenseStatus } from "@/lib/solairus-main";

interface UseLicenseStatusReturn {
  licenseInfo: LicenseInfo;
  isLoading: boolean;
  error: string | null;
  refreshLicenseStatus: () => Promise<void>;
  activateLicense: () => Promise<void>;
  isActivating: boolean;
  licenseService: LicenseService | null;
}

/**
 * useLicenseStatus
 * Purpose: Hook for managing license status with wallet integration
 * Features:
 * - Automatic license status checking
 * - License activation functionality
 * - Error handling and retry logic
 * - Integration with wallet context
 */
export function useLicenseStatus(): UseLicenseStatusReturn {
  const { anchorProvider, publicKey, isConnected } = useWallet();
  
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo>({
    status: 'none',
    isValid: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [licenseService, setLicenseService] = useState<LicenseService | null>(null);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Initialize license service when anchor provider is available
  useEffect(() => {
    if (anchorProvider) {
      try {
        const service = createLicenseService(anchorProvider);
        setLicenseService(service);
      } catch (err) {
        console.error('Failed to create license service:', err);
        setLicenseService(null);
      }
    } else {
      setLicenseService(null);
    }
  }, [anchorProvider]);

  // Simple refresh function without dependencies that cause loops
  const refreshLicenseStatus = useCallback(async () => {
    // Don't check if already loading or no service
    if (isLoading || !licenseService || !publicKey || !isConnected) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Manual license status refresh');
      
      const info = await licenseService.getLicenseInfo(publicKey);
      setLicenseInfo(info);
      setHasCheckedOnce(true); // Mark as checked
    } catch (err) {
      console.error('Failed to check license status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check license status');
      
      // Set fallback state on error
      setLicenseInfo({
        status: 'none',
        isValid: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [licenseService, publicKey, isConnected]); // Removed isLoading to prevent loops

  // Activate license
  const activateLicense = useCallback(async () => {
    if (!publicKey || !licenseService) {
      throw new Error('Wallet not connected or license service not available');
    }

    try {
      setIsActivating(true);
      setError(null);

      const result = await licenseService.activateLicenseComplete(publicKey);
      console.log('License activation successful:', result);

      // Refresh license info after activation without causing loops
      setTimeout(async () => {
        try {
          const info = await licenseService.getLicenseInfo(publicKey);
          setLicenseInfo(info);
        } catch (err) {
          console.error('Failed to refresh license after activation:', err);
        }
      }, 2000);
    } catch (err) {
      console.error('License activation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'License activation failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsActivating(false);
    }
  }, [publicKey, licenseService]); // Removed refreshLicenseStatus dependency

  // Only check license once when service becomes available
  useEffect(() => {
    let mounted = true;
    
    const checkLicense = async () => {
      if (licenseService && publicKey && isConnected && !isLoading && !hasCheckedOnce && mounted) {
        console.log('🔍 Performing one-time license check');
        await refreshLicenseStatus();
        setHasCheckedOnce(true);
      }
    };
    
    checkLicense();
    
    return () => {
      mounted = false;
    };
  }, [licenseService, publicKey, isConnected, hasCheckedOnce, isLoading, refreshLicenseStatus]); // Check only once per session

  return {
    licenseInfo,
    isLoading,
    error,
    refreshLicenseStatus,
    activateLicense,
    isActivating,
    licenseService,
  };
}