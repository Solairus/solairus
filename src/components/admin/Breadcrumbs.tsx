import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation component for admin interface
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ 
  items, 
  className = '' 
}) => {
  return (
    <nav className={`flex items-center space-x-1 text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-500 mx-1" />
            )}
            
            {item.active ? (
              <span className="text-white font-medium">
                {item.label}
              </span>
            ) : item.onClick ? (
              <button
                onClick={item.onClick}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ) : item.href ? (
              <a
                href={item.href}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-gray-400">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

interface AdminBreadcrumbsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

/**
 * Admin-specific breadcrumb component with predefined navigation
 */
export const AdminBreadcrumbs: React.FC<AdminBreadcrumbsProps> = ({
  activeTab,
  onTabChange,
  className = ''
}) => {
  const getTabLabel = (tab: string): string => {
    switch (tab) {
      case 'overview': return 'Dashboard';
      case 'config': return 'Configuration';
      case 'buckets': return 'Bucket Management';
      case 'users': return 'User Management';
      case 'credits': return 'User Credits';
      case 'sponsors': return 'User Sponsors';
      case 'licenses': return 'License Activation';
      default: return 'Unknown';
    }
  };

  const items: BreadcrumbItem[] = [
    {
      label: 'Admin',
      onClick: () => onTabChange('overview'),
      active: false
    },
    {
      label: getTabLabel(activeTab),
      active: true
    }
  ];

  return <Breadcrumbs items={items} className={className} />;
};

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Page header component with breadcrumbs and actions
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs = [],
  actions,
  className = ''
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white truncate">
            {title}
          </h1>
          {description && (
            <p className="text-gray-400 text-sm mt-1">
              {description}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};