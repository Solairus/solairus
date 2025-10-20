import { PublicKey } from '@solana/web3.js';
import { detectUserRole, hasAdminAccess, validateAdminAddresses } from './admin-roles';

/**
 * Navigation guard utilities for role-based access control
 */

/**
 * Check if a user can access the admin interface
 */
export const canAccessAdmin = (publicKey: PublicKey | null): boolean => {
  if (!publicKey) return false;
  if (!validateAdminAddresses()) return false;
  
  const role = detectUserRole(publicKey);
  return hasAdminAccess(role);
};

/**
 * Get the appropriate redirect path for unauthorized users
 */
export const getUnauthorizedRedirect = (): string => {
  return '/dapp';
};

/**
 * Check if the current route requires admin access
 */
export const isAdminRoute = (pathname: string): boolean => {
  return pathname.startsWith('/dapp/special');
};

/**
 * Navigation guard hook for programmatic navigation
 */
export const useNavigationGuard = () => {
  const checkAdminAccess = (publicKey: PublicKey | null): boolean => {
    return canAccessAdmin(publicKey);
  };

  const getRedirectPath = (hasAccess: boolean): string => {
    return hasAccess ? '/dapp/special' : getUnauthorizedRedirect();
  };

  return {
    checkAdminAccess,
    getRedirectPath,
    isAdminRoute,
  };
};