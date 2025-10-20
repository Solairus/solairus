import React, { createContext, useContext, ReactNode } from 'react';
import { useAdminRole, type UseAdminRoleReturn } from '../../hooks/useAdminRole';

interface AdminProviderProps {
  children: ReactNode;
}

const AdminContext = createContext<UseAdminRoleReturn | null>(null);

/**
 * Provider component for admin context
 */
export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const adminRole = useAdminRole();
  
  return (
    <AdminContext.Provider value={adminRole}>
      {children}
    </AdminContext.Provider>
  );
};

/**
 * Hook to access admin context
 */
export const useAdmin = (): UseAdminRoleReturn => {
  const context = useContext(AdminContext);
  
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  
  return context;
};