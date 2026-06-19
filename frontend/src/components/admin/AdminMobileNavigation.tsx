import React from 'react';
import { useAdmin } from './AdminProvider';
import { Button } from '../ui/button';
import {
  Settings,
  Wallet,
  CreditCard,
  UserCheck,
  Key,
  Home,
  MoreHorizontal,
  Menu
} from 'lucide-react';

interface AdminMobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMenuToggle: () => void;
}

/**
 * Mobile bottom navigation component for admin interface.
 * - Compact layout to prevent overflow
 * - Only shows the most essential items; everything else via the hamburger drawer
 * - "More" button opens the hamburger drawer for full navigation
 */
export const AdminMobileNavigation: React.FC<AdminMobileNavigationProps> = ({
  activeTab,
  onTabChange,
  onMenuToggle
}) => {
  const { context } = useAdmin();

  // Get the most important navigation items for mobile — keep to 2-3 max
  const getMobileNavigationItems = () => {
    const items: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }>; available: boolean }> = [
      {
        id: 'overview',
        label: 'Overview',
        icon: Home,
        available: true
      }
    ];

    // Buckets is the most-used admin feature
    if (context.accessibleBuckets.length > 0) {
      items.push({
        id: 'buckets',
        label: 'Buckets',
        icon: Wallet,
        available: true
      });
    }

    // Config for those who can access it
    if (context.canAccessConfig && items.length < 3) {
      items.push({
        id: 'config',
        label: 'Config',
        icon: Settings,
        available: true
      });
    }

    return items;
  };

  const navigationItems = getMobileNavigationItems();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-800 border-t border-gray-700 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between px-1 py-1 max-w-lg mx-auto">
        {navigationItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center gap-0.5 p-1.5 h-auto min-w-0 flex-1 ${
              activeTab === item.id
                ? 'text-blue-400 bg-blue-900/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="text-[10px] font-medium truncate leading-tight">{item.label}</span>
          </Button>
        ))}

        {/* "More" button — opens the hamburger drawer for full navigation */}
        <Button
          variant="ghost"
          onClick={onMenuToggle}
          className="flex flex-col items-center gap-0.5 p-1.5 h-auto min-w-0 flex-1 text-gray-400 hover:text-white hover:bg-gray-700"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="text-[10px] font-medium truncate leading-tight">More</span>
        </Button>
      </div>
    </div>
  );
};
