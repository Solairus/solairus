import { PublicKey } from '@solana/web3.js';

export type UserRole = 'admin' | 'dev' | 'marketer1' | 'marketer2' | null;

export interface AdminContext {
  role: UserRole;
  canAccessConfig: boolean;
  canManageUsers: boolean;
  canViewAllBuckets: boolean;
  // Buckets the role may SEE (view-only + withdrawable).
  accessibleBuckets: string[];
  // Subset of accessibleBuckets the role may actually WITHDRAW from.
  // Admin can view `dev` but not withdraw it, so this is narrower for admin.
  withdrawableBuckets: string[];
}

/**
 * Get admin role addresses from environment variables
 */
export const getAdminAddresses = () => {
  return {
    admin: import.meta.env.VITE_ADMIN_ADDRESS?.trim(),
    dev: import.meta.env.VITE_DEV_ADDRESS?.trim(),
    marketer1: import.meta.env.VITE_MARKETER1_ADDRESS?.trim(),
    marketer2: import.meta.env.VITE_MARKETER2_ADDRESS?.trim(),
  };
};

/**
 * Validate that all required admin addresses are configured
 */
export const validateAdminAddresses = (): boolean => {
  const addresses = getAdminAddresses();

  return !!(
    addresses.admin &&
    addresses.dev &&
    addresses.marketer1 &&
    addresses.marketer2
  );
};

/**
 * Detect user role based on connected wallet address
 */
export const detectUserRole = (walletAddress: PublicKey | null): UserRole => {
  if (!walletAddress) return null;

  const addresses = getAdminAddresses();
  const walletString = walletAddress.toString();

  if (addresses.admin && walletString === addresses.admin) {
    return 'admin';
  }

  if (addresses.dev && walletString === addresses.dev) {
    return 'dev';
  }

  if (addresses.marketer1 && walletString === addresses.marketer1) {
    return 'marketer1';
  }

  if (addresses.marketer2 && walletString === addresses.marketer2) {
    return 'marketer2';
  }

  return null;
};

/**
 * Get admin context based on user role
 */
export const getAdminContext = (role: UserRole): AdminContext => {
  switch (role) {
    case 'admin':
      return {
        role,
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: false,
        // Admin sees `dev` (view-only for the audit board) but cannot withdraw it.
        accessibleBuckets: ['admin', 'dev', 'trader', 'systemreserve'],
        withdrawableBuckets: ['admin', 'trader', 'systemreserve'],
      };

    case 'dev':
      return {
        role,
        canAccessConfig: true,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'],
        withdrawableBuckets: ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'],
      };

    case 'marketer1':
      return {
        role,
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
        withdrawableBuckets: ['marketer1'],
      };

    case 'marketer2':
      return {
        role,
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer2'],
        withdrawableBuckets: ['marketer2'],
      };

    default:
      return {
        role: null,
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: [],
        withdrawableBuckets: [],
      };
  }
};

/**
 * Check if a user has permission to access admin interface
 */
export const hasAdminAccess = (role: UserRole): boolean => {
  return role !== null;
};

/**
 * Check if a user can perform specific admin actions
 */
export const canPerformAction = (role: UserRole, action: string): boolean => {
  const context = getAdminContext(role);

  switch (action) {
    case 'config':
      return context.canAccessConfig;
    case 'users':
      return context.canManageUsers;
    case 'buckets':
      return context.accessibleBuckets.length > 0;
    case 'all-buckets':
      return context.canViewAllBuckets;
    default:
      return false;
  }
};

/**
 * Check if a wallet address is a special account (admin/dev/marketer)
 * that should bypass license validation
 */
export const isSpecialAccount = (walletAddress: PublicKey | null): boolean => {
  const role = detectUserRole(walletAddress);
  return hasAdminAccess(role);
};