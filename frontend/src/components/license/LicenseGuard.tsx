import React, { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent } from "@/components/ui/card";
import { isSpecialAccount } from "@/utils/admin-roles";
import { useAuth } from '@/contexts/auth-context'

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
 * - Special account bypass (admin/dev/marketers skip license validation)
 * - Automatic redirection to license activation for unlicensed users
 * - Backend-only validation (no on-chain checks)
 * 
 * Behavior:
 * - If license guard disabled: Always allows access
 * - If user not connected: Lets WalletGate handle wallet connection
 * - If on license activation page: Always allows access (prevents redirect loops)
 * - If user is special account (admin/dev/marketer): Bypasses license check
 * - If user has valid backend license: Renders children
 * - If user has invalid/no license: Redirects to /dapp/license-activation
 */
export default function LicenseGuard({ children }: LicenseGuardProps) {
  const { isConnected } = useWalletConnection();
  const { publicKey } = useWallet();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if the connected wallet is a special account (admin/dev/marketer)
  const isSpecialWallet = isSpecialAccount(publicKey);

  // Debug logging for special wallet detection
  React.useEffect(() => {
    if (publicKey) {
      console.log('[LicenseGuard] Checking wallet:', publicKey.toString());
      console.log('[LicenseGuard] Is special wallet:', isSpecialWallet);
    }
  }, [publicKey, isSpecialWallet]);

  // Backend license status (JWT session)
  const backendHasValidLicense = user?.license_status === 'active';

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
  // Skip license check for special accounts (admin/dev/marketers)
  // Preserve current path to redirect back after license activation
  React.useEffect(() => {
    if (licenseGuardEnabled && isConnected && !isSpecialWallet && !backendHasValidLicense && !authLoading && !isLicenseActivationPage) {
      navigate('/dapp/license-activation', {
        replace: true,
        state: { returnPath: location.pathname }
      });
    }
  }, [backendHasValidLicense, licenseGuardEnabled, isConnected, isSpecialWallet, authLoading, isLicenseActivationPage, navigate, location.pathname]);

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

  // If user is a special account (admin/dev/marketer), bypass license check
  if (isSpecialWallet) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (authLoading) {
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

  // If license is valid (backend only), render children
  if (backendHasValidLicense) {
    return <>{children}</>;
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