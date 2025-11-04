import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/wallet-context";
import { useAuth } from "@/contexts/auth-context";
import { LicenseBackendService, type BackendLicenseStatus } from "@/services/license/license-backend";
import type { LicenseService } from "@/services/license/license-service";

export interface LicenseInfo {
  status: BackendLicenseStatus | 'none' | 'near-expiry' | 'expired' | 'active';
  isValid: boolean;
  daysRemaining?: number;
}

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
 * Purpose: Backend-only license status management tied to AuthContext
 * Features:
 * - Reads license status from backend user session
 * - Refreshes via backend service and updates session
 * - Provides activation hook (backend-driven)
 */
export function useLicenseStatus(): UseLicenseStatusReturn {
  const { publicKey, isConnected } = useWallet();
  const { user, refreshSession } = useAuth();
  
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo>({
    status: 'none',
    isValid: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Initialize from current backend user session
  useEffect(() => {
    if (!user) return;
    const status = (user.license_status || 'none') as BackendLicenseStatus;
    let daysRemaining = 0;
    let isValid = status === 'active';

    try {
      if (user.license_expiration) {
        const exp = new Date(user.license_expiration).getTime();
        const now = Date.now();
        const diffDays = Math.max(0, Math.floor((exp - now) / (1000 * 60 * 60 * 24)));
        daysRemaining = diffDays;
        if (diffDays <= 0) {
          isValid = false;
        } else if (diffDays <= 7 && isValid) {
          // Mark as near-expiry if within 7 days
          setLicenseInfo({ status: 'near-expiry', isValid, daysRemaining: diffDays });
          return;
        }
      }
    } catch {
      // ignore parse errors
    }

    setLicenseInfo({ status, isValid, daysRemaining });
  }, [user]);

  const refreshLicenseStatus = useCallback(async () => {
    if (isLoading || !isConnected || !publicKey) return;
    try {
      setIsLoading(true);
      setError(null);
      const info = await LicenseBackendService.getInfo();
      const status = (info.license_status || 'none') as BackendLicenseStatus;
      let daysRemaining = 0;
      let isValid = status === 'active';
      if (info.license_expiration) {
        const exp = new Date(info.license_expiration).getTime();
        const now = Date.now();
        const diffDays = Math.max(0, Math.floor((exp - now) / (1000 * 60 * 60 * 24)));
        daysRemaining = diffDays;
        if (diffDays <= 0) {
          isValid = false;
        }
      }
      setLicenseInfo({ status, isValid, daysRemaining });
      setHasCheckedOnce(true);
    } catch (err) {
      console.error('Failed to refresh license status (backend):', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh license status');
      setLicenseInfo({ status: 'none', isValid: false });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isConnected, publicKey]);

  const activateLicense = useCallback(async () => {
    try {
      setIsActivating(true);
      setError(null);
      // Backend-only activation; transaction verification handled in page flow
      const result = await LicenseBackendService.activate();
      await refreshSession();
      const status = (result.license_status || 'active') as BackendLicenseStatus;
      let daysRemaining = 0;
      if (result.license_expiration) {
        const exp = new Date(result.license_expiration).getTime();
        const now = Date.now();
        daysRemaining = Math.max(0, Math.floor((exp - now) / (1000 * 60 * 60 * 24)));
      }
      setLicenseInfo({ status, isValid: status === 'active', daysRemaining });
    } catch (err) {
      console.error('License activation failed (backend):', err);
      const errorMessage = err instanceof Error ? err.message : 'License activation failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsActivating(false);
    }
  }, [refreshSession]);

  // One-time refresh when connected
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (isConnected && publicKey && !isLoading && !hasCheckedOnce && mounted) {
        await refreshLicenseStatus();
        setHasCheckedOnce(true);
      }
    };
    check();
    return () => { mounted = false; };
  }, [isConnected, publicKey, isLoading, hasCheckedOnce, refreshLicenseStatus]);

  return {
    licenseInfo,
    isLoading,
    error,
    refreshLicenseStatus,
    activateLicense,
    isActivating,
    licenseService: null,
  };
}