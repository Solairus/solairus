/**
 * Progress Indicator Component
 * 
 * Purpose: Display progress for admin operations with customizable styles
 * 
 * Features:
 * - Multiple progress indicator types
 * - Step-based progress tracking
 * - Animated progress bars
 * - Loading states with messages
 * - Error and success states
 */

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  AlertCircle,
  ArrowRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransactionStep } from '@/hooks/useTransactionStatus';

interface ProgressIndicatorProps {
  progress: number;
  message?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressIndicator({
  progress,
  message,
  variant = 'default',
  size = 'md',
  showPercentage = true,
  animated = true,
  className,
}: ProgressIndicatorProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      default:
        return 'text-blue-400';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-2';
      case 'lg':
        return 'h-4';
      default:
        return 'h-3';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {message && (
        <div className={cn('text-sm font-medium', getVariantStyles())}>
          {message}
        </div>
      )}
      
      <div className="relative">
        <Progress 
          value={progress} 
          className={cn(getSizeStyles(), animated && 'transition-all duration-300')}
        />
        
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white mix-blend-difference">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepProgressProps {
  steps: TransactionStep[];
  currentStep?: string;
  variant?: 'horizontal' | 'vertical';
  showMessages?: boolean;
  className?: string;
}

export function StepProgress({
  steps,
  currentStep,
  variant = 'horizontal',
  showMessages = true,
  className,
}: StepProgressProps) {
  const getStepIcon = (step: TransactionStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'active':
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStepStyles = (step: TransactionStep) => {
    switch (step.status) {
      case 'completed':
        return 'border-green-400 bg-green-400/10';
      case 'error':
        return 'border-red-400 bg-red-400/10';
      case 'active':
        return 'border-blue-400 bg-blue-400/10';
      default:
        return 'border-gray-600 bg-gray-800/50';
    }
  };

  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-4', className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start space-x-3">
            <div className={cn(
              'flex items-center justify-center w-10 h-10 rounded-full border-2',
              getStepStyles(step)
            )}>
              {getStepIcon(step)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className={cn(
                  'text-sm font-medium',
                  step.status === 'completed' ? 'text-green-400' :
                  step.status === 'error' ? 'text-red-400' :
                  step.status === 'active' ? 'text-blue-400' :
                  'text-gray-400'
                )}>
                  {step.label}
                </span>
                
                <Badge variant={
                  step.status === 'completed' ? 'default' :
                  step.status === 'error' ? 'destructive' :
                  step.status === 'active' ? 'secondary' :
                  'outline'
                }>
                  {step.status}
                </Badge>
              </div>
              
              {showMessages && step.message && (
                <p className="text-xs text-gray-500 mt-1">
                  {step.message}
                </p>
              )}
            </div>
            
            {index < steps.length - 1 && (
              <div className="absolute left-5 mt-10 w-px h-6 bg-gray-600" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center space-y-2">
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full border-2',
              getStepStyles(step)
            )}>
              {getStepIcon(step)}
            </div>
            
            <div className="text-center">
              <div className={cn(
                'text-xs font-medium',
                step.status === 'completed' ? 'text-green-400' :
                step.status === 'error' ? 'text-red-400' :
                step.status === 'active' ? 'text-blue-400' :
                'text-gray-400'
              )}>
                {step.label}
              </div>
              
              {showMessages && step.message && (
                <div className="text-xs text-gray-500 mt-1 max-w-20 truncate">
                  {step.message}
                </div>
              )}
            </div>
          </div>
          
          {index < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface LoadingCardProps {
  title: string;
  message?: string;
  progress?: number;
  steps?: TransactionStep[];
  variant?: 'default' | 'compact';
  showCancel?: boolean;
  onCancel?: () => void;
  className?: string;
}

export function LoadingCard({
  title,
  message,
  progress,
  steps,
  variant = 'default',
  showCancel = false,
  onCancel,
  className,
}: LoadingCardProps) {
  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center space-x-3 p-3 bg-gray-900/50 border border-gray-800 rounded-lg',
        className
      )}>
        <Loader2 className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {title}
          </div>
          {message && (
            <div className="text-xs text-gray-400 truncate">
              {message}
            </div>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="text-xs text-gray-400 flex-shrink-0">
            {Math.round(progress)}%
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          
          {showCancel && onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          )}
        </div>
        
        {message && (
          <p className="text-gray-300">{message}</p>
        )}
        
        {progress !== undefined && (
          <ProgressIndicator 
            progress={progress} 
            showPercentage={true}
            animated={true}
          />
        )}
        
        {steps && steps.length > 0 && (
          <StepProgress 
            steps={steps} 
            variant="vertical"
            showMessages={true}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface ErrorIndicatorProps {
  error: string;
  canRetry?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function ErrorIndicator({
  error,
  canRetry = false,
  onRetry,
  className,
}: ErrorIndicatorProps) {
  return (
    <div className={cn(
      'flex items-center space-x-3 p-3 bg-red-900/20 border border-red-800 rounded-lg',
      className
    )}>
      <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm text-red-300">
          {error}
        </div>
      </div>
      
      {canRetry && onRetry && (
        <button
          onClick={onRetry}
          className="text-red-400 hover:text-red-300 text-sm font-medium flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}