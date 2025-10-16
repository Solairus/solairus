import React, { createContext, useContext, ReactNode } from "react";
import { useLicenseStatus } from "@/hooks/license/use-license-status";
import { LicenseInfo } from "@/lib/solairus-main";
import { LicenseService } from "@/services/license/license-service";

interface LicenseContextType {
  licenseInfo: LicenseInfo;
  isLoading: boolean;
  error: string | null;
  refreshLicenseStatus: () => Promise<void>;
  activateLicense: () => Promise<void>;
  isActivating: boolean;
  licenseService: LicenseService | null;
  // Convenience methods
  hasValidLicense: boolean;
  isNearExpiry: boolean;
  daysRemaining: number;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

interface LicenseContextProviderProps {
  children: ReactNode;
}

/**
 * LicenseContextProvider
 * Purpose: Provides license status and management throughout the app
 * Features:
 * - Centralized license state management
 * - Automatic status updates
 * - License activation functionality
 * - Convenience computed properties
 */
export function LicenseContextProvider({ children }: LicenseContextProviderProps) {
  const {
    licenseInfo,
    isLoading,
    error,
    refreshLicenseStatus,
    activateLicense,
    isActivating,
    licenseService,
  } = useLicenseStatus();

  // Convenience computed properties
  const hasValidLicense = licenseInfo.isValid;
  const isNearExpiry = licenseInfo.status === 'near-expiry';
  const daysRemaining = licenseInfo.daysRemaining || 0;

  const value: LicenseContextType = {
    licenseInfo,
    isLoading,
    error,
    refreshLicenseStatus,
    activateLicense,
    isActivating,
    licenseService,
    hasValidLicense,
    isNearExpiry,
    daysRemaining,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
}

/**
 * useLicense
 * Purpose: Hook to access license context
 * Usage: const { hasValidLicense, activateLicense } = useLicense();
 */
export function useLicense(): LicenseContextType {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseContextProvider');
  }
  return context;
}

/**
 * useLicenseGuard
 * Purpose: Hook for components that need license validation
 * Returns: boolean indicating if user has valid license
 */
export function useLicenseGuard(): boolean {
  const { hasValidLicense, isLoading } = useLicense();
  
  // Consider loading state as "not valid" to prevent access during checks
  return hasValidLicense && !isLoading;
}

/**
 * useLicenseActivation
 * Purpose: Hook specifically for license activation functionality
 * Returns: activation methods and state
 */
export function useLicenseActivation() {
  const {
    activateLicense,
    isActivating,
    error,
    refreshLicenseStatus,
    licenseService,
  } = useLicense();

  return {
    activateLicense,
    isActivating,
    error,
    refreshLicenseStatus,
    licenseService,
  };
}