import { useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { 
  detectUserRole, 
  getAdminContext, 
  hasAdminAccess, 
  validateAdminAddresses,
  type UserRole,
  type AdminContext 
} from '../utils/admin-roles';

export interface UseAdminRoleReturn {
  role: UserRole;
  context: AdminContext;
  hasAccess: boolean;
  isConfigured: boolean;
}

/**
 * Hook for detecting and managing admin role based on connected wallet
 */
export const useAdminRole = (): UseAdminRoleReturn => {
  const { publicKey } = useWallet();
  
  const role = useMemo(() => {
    return detectUserRole(publicKey);
  }, [publicKey]);
  
  const context = useMemo(() => {
    return getAdminContext(role);
  }, [role]);
  
  const hasAccess = useMemo(() => {
    return hasAdminAccess(role);
  }, [role]);
  
  const isConfigured = useMemo(() => {
    return validateAdminAddresses();
  }, []);
  
  return {
    role,
    context,
    hasAccess,
    isConfigured,
  };
};