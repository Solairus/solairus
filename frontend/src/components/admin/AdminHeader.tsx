import React from 'react';
import { useAdmin } from './AdminProvider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Shield, Menu, X, ArrowLeft } from 'lucide-react';

interface AdminHeaderProps {
  activeTab: string;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

/**
 * Mobile header component for admin interface
 */
export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  onMenuToggle,
  isMenuOpen
}) => {
  const { role } = useAdmin();

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'overview': return 'Dashboard Overview';
      case 'config': return 'Configuration';
      case 'buckets': return 'Bucket Management';
      case 'users': return 'User Management';
      case 'credits': return 'User Credits';
      case 'sponsors': return 'User Sponsors';
      case 'licenses': return 'License Activation';
      default: return 'Admin Panel';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Menu button and title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuToggle}
            className="p-2 hover:bg-gray-700"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Menu className="h-5 w-5 text-white" />
            )}
          </Button>
          
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <div>
              <h1 className="text-sm font-semibold text-white">
                {getTabTitle(activeTab)}
              </h1>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Role:</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {role}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Back button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = '/dapp'}
          className="flex items-center gap-2 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      </div>
    </div>
  );
};