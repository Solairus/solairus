import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface ResponsiveCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
  };
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

/**
 * Responsive card component with consistent styling
 */
export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  title,
  description,
  icon: Icon,
  badge,
  children,
  className = '',
  headerActions,
  variant = 'default'
}) => {
  const getCardClasses = () => {
    const baseClasses = 'transition-all duration-200';
    
    switch (variant) {
      case 'elevated':
        return `${baseClasses} bg-gray-900/70 border-gray-700 shadow-lg hover:shadow-xl hover:bg-gray-900/80`;
      case 'outlined':
        return `${baseClasses} bg-gray-900/30 border-gray-600 hover:border-gray-500`;
      default:
        return `${baseClasses} bg-gray-900/50 border-gray-800 hover:bg-gray-900/60`;
    }
  };

  return (
    <Card className={`${getCardClasses()} ${className}`}>
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              {Icon && (
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 flex-shrink-0" />
              )}
              <CardTitle className="text-lg sm:text-xl font-bold text-white truncate">
                {title}
              </CardTitle>
              {badge && (
                <Badge 
                  variant={badge.variant || 'secondary'} 
                  className={`flex-shrink-0 ${badge.className || ''}`}
                >
                  {badge.text}
                </Badge>
              )}
            </div>
            {description && (
              <CardDescription className="text-gray-400 text-sm">
                {description}
              </CardDescription>
            )}
          </div>
          
          {headerActions && (
            <div className="flex-shrink-0">
              {headerActions}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6">
        {children}
      </CardContent>
    </Card>
  );
};

interface InfoCardProps {
  title: string;
  value: string | React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

/**
 * Information display card component
 */
export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  className = ''
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-900/20 border-green-800 text-green-400';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-800 text-yellow-400';
      case 'error':
        return 'bg-red-900/20 border-red-800 text-red-400';
      case 'info':
        return 'bg-blue-900/20 border-blue-800 text-blue-400';
      default:
        return 'bg-gray-800/50 border-gray-700 text-gray-300';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${getVariantClasses()} ${className}`}>
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        {Icon && (
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${getIconColor()} flex-shrink-0`} />
        )}
        <div className="text-sm font-medium text-white truncate">
          {title}
        </div>
      </div>
      
      <div className="text-base sm:text-lg font-semibold text-white mb-1">
        {value}
      </div>
      
      {description && (
        <div className="text-xs sm:text-sm opacity-80">
          {description}
        </div>
      )}
    </div>
  );
};

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive';
  className?: string;
}

/**
 * Action card component for quick actions
 */
export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  variant = 'default',
  className = ''
}) => {
  const getVariantClasses = () => {
    if (disabled) {
      return 'bg-gray-800/30 border-gray-700 text-gray-500 cursor-not-allowed';
    }
    
    switch (variant) {
      case 'primary':
        return 'bg-blue-900/30 border-blue-700 text-blue-300 hover:bg-blue-900/50 hover:border-blue-600 cursor-pointer';
      case 'secondary':
        return 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-800/70 hover:border-gray-500 cursor-pointer';
      case 'destructive':
        return 'bg-red-900/30 border-red-700 text-red-300 hover:bg-red-900/50 hover:border-red-600 cursor-pointer';
      default:
        return 'bg-gray-800/30 border-gray-700 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600 cursor-pointer';
    }
  };

  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  return (
    <div 
      className={`rounded-lg border p-3 sm:p-4 transition-all duration-200 ${getVariantClasses()} ${className}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
        <div className="font-medium text-sm sm:text-base text-white">
          {title}
        </div>
      </div>
      
      <div className="text-xs sm:text-sm opacity-80">
        {description}
      </div>
    </div>
  );
};