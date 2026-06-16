import React from 'react';
import { useAdmin } from './AdminProvider';
import { Button } from '../ui/button';
import { 
  Settings, 
  Users, 
  Wallet, 
  CreditCard,
  UserCheck,
  Key,
  Home
} from 'lucide-react';

interface AdminMobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Mobile bottom navigation component for admin interface
 */
export const AdminMobileNavigation: React.FC<AdminMobileNavigationProps> = ({ 
  activeTab, 
  onTabChange 
}) => {
  const { context } = useAdmin();

  // Get the most important navigation items for mobile
  const getMobileNavigationItems = () => {
    const items = [
      { 
        id: 'overview', 
        label: 'Overview', 
        icon: Home, 
        available: true
      }
    ];

    // Add the most commonly used features based on role
    if (context.accessibleBuckets.length > 0) {
      items.push({
        id: 'buckets',
        label: 'Buckets',
        icon: Wallet,
        available: true
      });
    }

    if (context.canManageUsers) {
      items.push(
        {
          id: 'licenses',
          label: 'Licenses',
          icon: Key,
          available: true
        },
        {
          id: 'credits',
          label: 'Credits',
          icon: CreditCard,
          available: true
        }
      );
    }

    if (context.canAccessConfig) {
      items.push({
        id: 'config',
        label: 'Config',
        icon: Settings,
        available: true
      });
    }

    // Limit to 5 items for mobile
    return items.slice(0, 5);
  };

  const navigationItems = getMobileNavigationItems();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-800 border-t border-gray-700">
      <div className="flex items-center justify-around px-2 py-2">
        {navigationItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center gap-1 p-2 h-auto min-w-0 flex-1 ${
              activeTab === item.id 
                ? 'text-blue-400 bg-blue-900/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium truncate">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};