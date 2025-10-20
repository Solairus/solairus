import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
};

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

/**
 * Skeleton loading component
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  variant = 'rectangular' 
}) => {
  const baseClasses = 'animate-pulse bg-gray-700/50';
  
  const variantClasses = {
    text: 'h-4 rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full'
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
};

interface LoadingCardProps {
  title?: string;
  message?: string;
  progress?: number;
  steps?: Array<{ id: string; label: string; status?: 'pending' | 'active' | 'completed' | 'error' }>;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

/**
 * Loading card with progress indication
 */
export const LoadingCard: React.FC<LoadingCardProps> = ({
  title = 'Loading...',
  message,
  progress,
  steps = [],
  variant = 'default',
  className = ''
}) => {
  if (variant === 'compact') {
    return (
      <div className={`bg-blue-900/20 border border-blue-800 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-3">
          <LoadingSpinner size="sm" className="text-blue-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-blue-300">{title}</div>
            {message && (
              <div className="text-xs text-blue-400/80 truncate">{message}</div>
            )}
          </div>
          {progress !== undefined && (
            <Badge variant="outline" className="text-blue-400 border-blue-500/30">
              {Math.round(progress)}%
            </Badge>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="mt-2 bg-gray-800 rounded-full h-1.5">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={`bg-gray-900/50 border-gray-800 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <LoadingSpinner className="text-blue-400" />
          <div className="flex-1">
            <div className="font-semibold text-white">{title}</div>
            {message && (
              <div className="text-sm text-gray-400">{message}</div>
            )}
          </div>
          {progress !== undefined && (
            <Badge variant="outline" className="text-blue-400 border-blue-500/30">
              {Math.round(progress)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {progress !== undefined && (
          <div className="mb-4">
            <div className="bg-gray-800 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}
        
        {steps.length > 0 && (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : step.status === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : step.status === 'active' ? (
                    <LoadingSpinner size="sm" className="text-blue-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <div className={`text-sm ${
                  step.status === 'completed' ? 'text-green-400' :
                  step.status === 'error' ? 'text-red-400' :
                  step.status === 'active' ? 'text-blue-400' :
                  'text-gray-500'
                }`}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Empty state component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  action,
  className = ''
}) => {
  return (
    <div className={`text-center py-8 px-4 ${className}`}>
      {Icon && (
        <Icon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-4 max-w-md mx-auto">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title: string;
  description: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state component
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  description,
  error,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`text-center py-8 px-4 ${className}`}>
      <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-4 max-w-md mx-auto">{description}</p>
      
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-md p-3 mb-4 max-w-md mx-auto">
          <p className="text-red-400 text-sm font-mono">{error}</p>
        </div>
      )}
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};