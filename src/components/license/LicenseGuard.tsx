import React, { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useLicense } from "@/contexts/license-context";
import { Card, CardContent } from "@/components/ui/card";
import LicenseExpiryNotification from "./LicenseExpiryNotification";

interface LicenseGuardProps {
  children: ReactNode;
}

/**
 * LicenseGuard
 * 
 * Purpose: Higher-order component that enforces license validation for protected dApp routes
 * 
 * Key Features:
 * - Environment-controlled license enforcement (VITE_ENABLE_LICENSE_GUARD)
 * - Automatic redirection to license activation for unlicensed users
 * - Proper React Hook usage (no conditional calling)
 * - Loading states during license validation
 * - Error handling with retry options
 * - License expiry notifications for near-expiry licenses
 * 
 * Behavior:
 * - If license guard disabled: Always allows access
 * - If user not connected: Lets WalletGate handle wallet connection
 * - If on license activation page: Always allows access (prevents redirect loops)
 * - If user has valid license: Renders children with optional expiry warning
 * - If user has invalid/no license: Redirects to /dapp/license-activation
 * 
 * Fixed Issues:
 * - Removed early return that bypassed license checking
 * - Fixed React Hook conditional usage error
 * - Proper useEffect dependency management for redirection
 */
export default function LicenseGuard({ children }: LicenseGuardProps) {
  const { isConnected } = useWalletConnection();
  const {
    licenseInfo,
    isLoading,
    error,
    refreshLicenseStatus
  } = useLicense();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if license guard is enabled
  const licenseGuardEnabled = (
    (import.meta.env.VITE_ENABLE_LICENSE_GUARD ?? "true")
      .toString()
      .toLowerCase()
      .trim() === "true"
  );

  // Don't guard the license activation page itself
  const isLicenseActivationPage = location.pathname === '/dapp/license-activation';

  // Redirect to license activation if no valid license and not already on that page
  // Only check once per session, not continuously
  React.useEffect(() => {
    if (licenseGuardEnabled && isConnected && !licenseInfo.isValid && !isLoading && !isLicenseActivationPage) {
      navigate('/dapp/license-activation', { replace: true });
    }
  }, [licenseGuardEnabled, isConnected, licenseInfo.isValid, isLoading, isLicenseActivationPage, navigate]);

  // If license guard is disabled, always allow access
  if (!licenseGuardEnabled) {
    return <>{children}</>;
  }

  // If not connected, let WalletGate handle it
  if (!isConnected) {
    return <>{children}</>;
  }

  // If on license activation page, always allow access
  if (isLicenseActivationPage) {
    return <>{children}</>;
  }

  // Show loading state while checking license
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <h3 className="text-lg font-semibold">Checking License Status</h3>
            <p className="text-sm text-muted-foreground">
              Validating your Solairus license...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-red-600">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-800">License Check Failed</h3>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={refreshLicenseStatus}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If license is valid, render children with optional expiry notification
  if (licenseInfo.isValid) {
    return (
      <>
        {/* Show expiry notification for near-expiry licenses */}
        {licenseInfo.status === 'near-expiry' && (
          <div className="mb-4">
            <LicenseExpiryNotification
              licenseInfo={licenseInfo}
              onRenew={() => navigate('/dapp/license-activation')}
            />
          </div>
        )}
        {children}
      </>
    );
  }

  // If license is invalid, this should have triggered a redirect
  // But show a fallback message just in case
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md border-yellow-200 bg-yellow-50">
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-yellow-600">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-yellow-800">License Required</h3>
          <p className="text-sm text-yellow-600">
            You need an active license to access this feature.
          </p>
          <button
            onClick={() => navigate('/dapp/license-activation')}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
          >
            Activate License
          </button>
        </CardContent>
      </Card>
    </div>
  );
}