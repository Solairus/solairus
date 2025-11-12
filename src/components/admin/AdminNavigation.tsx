import React from 'react';
import { useAdmin } from './AdminProvider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Settings,
  Users,
  Wallet,
  Shield,
  CreditCard,
  UserCheck,
  Key,
  Home,
  ArrowLeft,
  LogOut,
  Bot
} from 'lucide-react';

interface AdminNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobile?: boolean;
}

/**
 * Navigation component for admin interface
 */
export const AdminNavigation: React.FC<AdminNavigationProps> = ({ 
  activeTab, 
  onTabChange,
  isMobile = false
}) => {
  const { role, context } = useAdmin();

  const navigationItems = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: Home, 
      available: true,
      description: 'Dashboard overview'
    }
  ];

  if (context.canAccessConfig) {
    navigationItems.push(
      {
        id: 'agent-tiers',
        label: 'Agent Tiers',
        icon: Bot,
        available: true,
        description: 'Configure agent tiers'
      },
      {
        id: 'config',
        label: 'Configuration',
        icon: Settings,
        available: true,
        description: 'System settings'
      }
    );
  }

  if (context.accessibleBuckets.length > 0) {
    navigationItems.push({
      id: 'buckets',
      label: 'Bucket Management',
      icon: Wallet,
      available: true,
      description: 'Manage system buckets'
    });
  }

  if (context.canManageUsers) {
    navigationItems.push(
      {
        id: 'users',
        label: 'User Management',
        icon: Users,
        available: true,
        description: 'Manage user profiles'
      },
      {
        id: 'credits',
        label: 'User Credits',
        icon: CreditCard,
        available: true,
        description: 'Credit operations'
      },
      {
        id: 'sponsors',
        label: 'User Sponsors',
        icon: UserCheck,
        available: true,
        description: 'Sponsor management'
      },
      {
        id: 'licenses',
        label: 'License Activation',
        icon: Key,
        available: true,
        description: 'Manual license activation'
      }
    );
  }

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64'} bg-gray-800 ${!isMobile && 'border-r border-gray-700'} flex flex-col h-full`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-6 w-6 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Admin Panel</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Role:</span>
          <Badge variant="secondary" className="capitalize text-xs">
            {role}
          </Badge>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            onClick={() => onTabChange(item.id)}
            className={`w-full justify-start gap-3 h-auto p-3 ${
              activeTab === item.id 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'hover:bg-gray-700'
            }`}
          >
            <item.icon className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs opacity-70">{item.description}</div>
            </div>
          </Button>
        ))}
      </div>

      <Separator />

      {/* Footer Actions */}
      <div className="p-4 space-y-2">
        {!isMobile && (
          <Button
            variant="outline"
            onClick={() => window.location.href = '/dapp'}
            className="w-full justify-start gap-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Button>
        )}
        
        <Button
          variant="ghost"
          onClick={() => {
            // This would trigger wallet disconnect in a real implementation
            window.location.href = '/';
          }}
          className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    </div>
  );
};