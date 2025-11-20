import React, { useState } from 'react';
import { useAdmin } from './AdminProvider';
import { AdminLayout } from './AdminLayout';
import { BucketManagement } from './BucketManagement';
import { UserCreditManagement } from './UserCreditManagement';
import { UserSponsorManagement } from './UserSponsorManagement';
import { ManualLicenseActivation } from './ManualLicenseActivation';
import { ConfigManagement } from './ConfigManagement';
import { AgentTiersManagement } from './AgentTiersManagement';
import { AdminUsersTable } from './AdminUsersTable';
import { MarketerDashboard } from './MarketerDashboard';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { ResponsiveCard, InfoCard, ActionCard } from './ResponsiveCard';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  Settings,
  Users,
  Wallet,
  Shield,
  CreditCard,
  UserCheck,
  Key,
  BarChart3,
  Activity,
  Zap,
  TrendingUp,
  Bot
} from 'lucide-react';

/**
 * Main admin dashboard component with role-based rendering
 */
export const AdminDashboard: React.FC = () => {
  const { role, context } = useAdmin();
  const [activeTab, setActiveTab] = useState('overview');

  // Render marketer-specific dashboard for marketer roles
  if (role === 'marketer1' || role === 'marketer2') {
    return <MarketerDashboard />;
  }

  const renderOverviewContent = () => (
    <div className="space-y-6">
      {/* Welcome Header */}
      <ResponsiveCard
        title="Admin Dashboard"
        description="Welcome to the Solairus admin interface"
        icon={Shield}
        badge={{
          text: role?.toUpperCase() || 'UNKNOWN',
          variant: 'default',
          className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }}
        variant="elevated"
      >
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Zap className="h-4 w-4 text-green-400" />
          <span>System operational and ready for administration</span>
        </div>
      </ResponsiveCard>

      {/* Role and Permissions Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <InfoCard
          title="Current Role"
          value={role?.charAt(0).toUpperCase() + role?.slice(1) || 'Unknown'}
          description="Your administrative role"
          icon={Shield}
          variant="info"
        />

        <InfoCard
          title="Bucket Access"
          value={context.accessibleBuckets.length}
          description={`${context.accessibleBuckets.length} bucket${context.accessibleBuckets.length !== 1 ? 's' : ''} available`}
          icon={Wallet}
          variant={context.accessibleBuckets.length > 0 ? 'success' : 'default'}
        />

        <InfoCard
          title="Permissions"
          value={
            <div className="flex flex-wrap gap-1">
              {context.canAccessConfig && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                  Config
                </Badge>
              )}
              {context.canManageUsers && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                  Users
                </Badge>
              )}
              {context.accessibleBuckets.length > 0 && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  Buckets
                </Badge>
              )}
            </div>
          }
          description="Available permissions"
          icon={Key}
        />
      </div>

      {/* Quick Actions */}
      <ResponsiveCard
        title="Quick Actions"
        description="Common administrative tasks"
        icon={Activity}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {context.accessibleBuckets.length > 0 && (
            <ActionCard
              title="Manage Buckets"
              description="View balances and withdraw funds"
              icon={Wallet}
              onClick={() => setActiveTab('buckets')}
              variant="primary"
            />
          )}

          {context.canManageUsers && (
            <>
              <ActionCard
                title="Activate License"
                description="Manual license activation"
                icon={Key}
                onClick={() => setActiveTab('licenses')}
                variant="default"
              />

              <ActionCard
                title="Manage Credits"
                description="User credit operations"
                icon={CreditCard}
                onClick={() => setActiveTab('credits')}
                variant="default"
              />

              <ActionCard
                title="Update Sponsors"
                description="Manage user sponsors"
                icon={UserCheck}
                onClick={() => setActiveTab('sponsors')}
                variant="default"
              />
            </>
          )}

          {context.canAccessConfig && (
            <>
              <ActionCard
                title="Agent Tiers"
                description="Configure agent investment tiers"
                icon={Bot}
                onClick={() => setActiveTab('agent-tiers')}
                variant="default"
              />

              <ActionCard
                title="Configuration"
                description="System settings"
                icon={Settings}
                onClick={() => setActiveTab('config')}
                variant="secondary"
              />
            </>
          )}
        </div>
      </ResponsiveCard>

      {/* Accessible Buckets */}
      {context.accessibleBuckets.length > 0 && (
        <ResponsiveCard
          title="Accessible Buckets"
          description="Buckets you can manage and withdraw from"
          icon={TrendingUp}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {context.accessibleBuckets.map((bucket) => (
              <div
                key={bucket}
                className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="text-sm font-medium text-white capitalize mb-1">
                  {bucket}
                </div>
                <Badge variant="outline" className="text-xs">
                  Active
                </Badge>
              </div>
            ))}
          </div>
        </ResponsiveCard>
      )}

      {/* System Status */}
      <ResponsiveCard
        title="System Status"
        description="Current development and feature status"
        icon={BarChart3}
        variant="outlined"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-green-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              Completed Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                Role-based authentication
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                Responsive admin dashboard
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                Navigation and layout system
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                Permission management
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                Bucket balance management
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              Active Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                Manual license activation
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                User credit management
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                User sponsor management
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                System configuration
              </li>
            </ul>
          </div>
        </div>
      </ResponsiveCard>
    </div>
  );

  const renderConfigContent = () => (
    <AdminErrorBoundary>
      <ConfigManagement />
    </AdminErrorBoundary>
  );

  const renderBucketsContent = () => (
    <AdminErrorBoundary>
      <BucketManagement />
    </AdminErrorBoundary>
  );

  const renderUsersContent = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400">Search and view registered users</p>
        </div>
      </div>
      <AdminUsersTable />
    </div>
  );  
const renderCreditsContent = () => (
    <AdminErrorBoundary>
      <UserCreditManagement />
    </AdminErrorBoundary>
  );

  const renderSponsorsContent = () => (
    <AdminErrorBoundary>
      <UserSponsorManagement />
    </AdminErrorBoundary>
  );

  const renderLicensesContent = () => (
    <AdminErrorBoundary>
      <ManualLicenseActivation />
    </AdminErrorBoundary>
  );

  const renderAgentTiersContent = () => (
    <AdminErrorBoundary>
      <AgentTiersManagement />
    </AdminErrorBoundary>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewContent();
      case 'config':
        return renderConfigContent();
      case 'agent-tiers':
        return renderAgentTiersContent();
      case 'buckets':
        return renderBucketsContent();
      case 'users':
        return renderUsersContent();
      case 'credits':
        return renderCreditsContent();
      case 'sponsors':
        return renderSponsorsContent();
      case 'licenses':
        return renderLicensesContent();
      default:
        return renderOverviewContent();
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AdminLayout>
  );
};