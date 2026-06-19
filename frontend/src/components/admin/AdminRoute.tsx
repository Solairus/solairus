import React, { ReactNode } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '../../hooks/useAdminRole';
import { AdminProvider } from './AdminProvider';
import { Card } from '../ui/card';
import { AlertTriangle, Settings, Wallet } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Protected route component for admin interface access
 * Validates wallet connection and admin role before allowing access
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isConnected, publicKey } = useWallet();
  const { hasAccess, isConfigured, role } = useAdminRole();

  // Check if admin addresses are configured
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 bg-gray-800 border-red-500/20">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            <h2 className="text-xl font-semibold text-white">Configuration Error</h2>
          </div>
          <p className="text-gray-300 mb-4">
            Admin addresses are not properly configured. Please check your environment variables:
          </p>
          <ul className="text-sm text-gray-400 space-y-1 mb-4">
            <li>• VITE_ADMIN_ADDRESS</li>
            <li>• VITE_DEV_ADDRESS</li>
            <li>• VITE_MARKETER1_ADDRESS</li>
            <li>• VITE_MARKETER2_ADDRESS</li>
          </ul>
          <p className="text-xs text-gray-500">
            Contact your system administrator to resolve this issue.
          </p>
        </Card>
      </div>
    );
  }

  // Check wallet connection
  if (!isConnected || !publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 bg-gray-800 border-yellow-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-6 w-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Wallet Required</h2>
          </div>
          <p className="text-gray-300 mb-4">
            Please connect your wallet to access the admin interface.
          </p>
          <button
            onClick={() => window.location.href = '/dapp'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go to Main App
          </button>
        </Card>
      </div>
    );
  }

  // Check admin access
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 bg-gray-800 border-red-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-6 w-6 text-red-400" />
            <h2 className="text-xl font-semibold text-white">Access Denied</h2>
          </div>
          <p className="text-gray-300 mb-4">
            Your wallet address is not authorized to access the admin interface.
          </p>
          <div className="text-sm text-gray-400 mb-4">
            <p>Connected wallet:</p>
            <p className="font-mono text-xs break-all bg-gray-700 p-2 rounded mt-1">
              {publicKey.toString()}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/dapp'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go to Main App
          </button>
        </Card>
      </div>
    );
  }

  // User has access, render admin interface with context
  return (
    <AdminProvider>
      {children}
    </AdminProvider>
  );
};