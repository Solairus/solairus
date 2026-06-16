import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Clock, 
  Ban, 
  AlertTriangle, 
  Wifi, 
  RefreshCw, 
  Shield,
  CheckCircle,
  Info,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentData } from '@/services/agent/agent-service';
import { useAgentErrorHandler } from '@/utils/agent-error-handler';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface AgentErrorDisplayProps {
  error: unknown;
  context?: string;
  agent?: AgentData;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
  showRetryButton?: boolean;
  autoRetryCountdown?: boolean;
}

const iconMap = {
  Clock,
  Ban,
  AlertTriangle,
  Wifi,
  AlertCircle,
  RefreshCw,
  Shield,
  CheckCircle,
  Info
};

export const AgentErrorDisplay: React.FC<AgentErrorDisplayProps> = ({
  error,
  context,
  agent,
  onRetry,
  onDismiss,
  className,
  compact = false,
  showRetryButton = true,
  autoRetryCountdown = false
}) => {
  const { formatErrorForUI } = useAgentErrorHandler();
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const errorInfo = formatErrorForUI(error, context, agent);
  const IconComponent = iconMap[errorInfo.icon as keyof typeof iconMap] || AlertCircle;

  // Handle retry countdown
  useEffect(() => {
    if (autoRetryCountdown && errorInfo.retryDelay && errorInfo.retryDelay > 0) {
      setRetryCountdown(errorInfo.retryDelay);
      
      const interval = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [autoRetryCountdown, errorInfo.retryDelay]);

  const handleRetry = async () => {
    if (!onRetry || !errorInfo.isRetryable || retryCountdown > 0) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (compact) {
    return (
      <div 
        data-testid="error-display-compact"
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg text-sm",
          errorInfo.color.background,
          errorInfo.color.border,
          "border",
          className
        )}>
        <IconComponent className={cn("h-4 w-4 flex-shrink-0", errorInfo.color.primary)} />
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate", errorInfo.color.primary)}>
            {errorInfo.title}
          </p>
          {errorInfo.description && (
            <p className={cn("text-xs truncate", errorInfo.color.secondary)}>
              {errorInfo.description}
            </p>
          )}
        </div>
        
        {showRetryButton && errorInfo.isRetryable && onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={retryCountdown > 0 || isRetrying}
            className={cn(
              "h-6 px-2 text-xs",
              errorInfo.color.border,
              errorInfo.color.primary
            )}
          >
            {isRetrying ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : retryCountdown > 0 ? (
              formatCountdown(retryCountdown)
            ) : (
              'Retry'
            )}
          </Button>
        )}
        
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Alert 
      data-testid="error-display-full"
      className={cn(
        errorInfo.color.background,
        errorInfo.color.border,
        "border",
        className
      )}>
      <IconComponent className={cn("h-4 w-4", errorInfo.color.primary)} />
      <AlertDescription className={errorInfo.color.primary}>
        <div className="space-y-3">
          {/* Error Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium mb-1">{errorInfo.title}</div>
              <div className={cn("text-sm", errorInfo.color.secondary)}>
                {errorInfo.message}
              </div>
            </div>
            
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-6 w-6 p-0 ml-2"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Error Details */}
          {errorInfo.description && (
            <div className={cn("text-sm", errorInfo.color.secondary)}>
              {errorInfo.description}
            </div>
          )}

          {/* Timing Information */}
          {errorInfo.type === 'timing' && retryCountdown > 0 && (
            <div className="space-y-2">
              <div className={cn("text-xs flex items-center gap-2", errorInfo.color.secondary)}>
                <Clock className="w-3 h-3" />
                Next attempt available in {formatCountdown(retryCountdown)}
              </div>
              {autoRetryCountdown && (
                <Progress 
                  value={((errorInfo.retryDelay || 0) - retryCountdown) / (errorInfo.retryDelay || 1) * 100}
                  className="h-1"
                />
              )}
            </div>
          )}

          {/* Agent Context */}
          {agent && (
            <div className={cn(
              "text-xs pt-2 border-t border-current/20 flex items-center gap-2",
              errorInfo.color.secondary
            )}>
              <span>{agent.tierConfig.emoji}</span>
              <span>
                Agent #{agent.activationId} • {agent.tierConfig.name} Tier • 
                ${agent.activationAmount.toLocaleString('en-US', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2 
                })} Investment
              </span>
            </div>
          )}

          {/* Error Severity Badge */}
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                errorInfo.color.border,
                errorInfo.color.primary
              )}
            >
              {errorInfo.severity === 'critical' && '🚨 Critical'}
              {errorInfo.severity === 'high' && '⚠️ High Priority'}
              {errorInfo.severity === 'medium' && '📋 Attention Needed'}
              {errorInfo.severity === 'low' && 'ℹ️ Information'}
            </Badge>

            {/* Retry Button */}
            {showRetryButton && errorInfo.isRetryable && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retryCountdown > 0 || isRetrying}
                className={cn(
                  "text-xs h-7",
                  errorInfo.color.border,
                  errorInfo.color.primary,
                  "hover:bg-current/10"
                )}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Retrying...
                  </>
                ) : retryCountdown > 0 ? (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Retry in {formatCountdown(retryCountdown)}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {errorInfo.retryButtonText}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Additional Context for Specific Errors */}
          {errorInfo.type === 'limits' && errorInfo.code === 6016 && agent && (
            <div className={cn("text-xs p-2 rounded bg-current/5", errorInfo.color.secondary)}>
              <strong>Agent Lifecycle Complete:</strong> This agent has generated{' '}
              ${agent.totalRoiWithdrawn.toLocaleString('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })} in total ROI ({agent.yieldCapProgress.toFixed(1)}% of maximum).
              Consider activating a new agent to continue earning.
            </div>
          )}

          {errorInfo.type === 'limits' && errorInfo.code === 6018 && (
            <div className={cn("text-xs p-2 rounded bg-current/5", errorInfo.color.secondary)}>
              <strong>Withdrawal Limit Protection:</strong> You've reached the maximum withdrawal limit 
              (200x your total deposits). Activate new agents to increase your deposit total and unlock 
              higher withdrawal limits.
            </div>
          )}

          {errorInfo.type === 'contract' && errorInfo.code === 6020 && (
            <div className={cn("text-xs p-2 rounded bg-current/5", errorInfo.color.secondary)}>
              <strong>System Status:</strong> High withdrawal volume has temporarily reduced system reserves. 
              This is normal during peak activity and reserves replenish automatically.
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

/**
 * Hook for managing error display state
 */
export function useAgentErrorDisplay() {
  const [error, setError] = useState<unknown>(null);
  const [context, setContext] = useState<string>();
  const [agent, setAgent] = useState<AgentData>();
  const [isVisible, setIsVisible] = useState(false);

  const showError = (
    error: unknown, 
    context?: string, 
    agent?: AgentData
  ) => {
    setError(error);
    setContext(context);
    setAgent(agent);
    setIsVisible(true);
  };

  const hideError = () => {
    setIsVisible(false);
    // Clear error after animation
    setTimeout(() => {
      setError(null);
      setContext(undefined);
      setAgent(undefined);
    }, 300);
  };

  const clearError = () => {
    setError(null);
    setContext(undefined);
    setAgent(undefined);
    setIsVisible(false);
  };

  return {
    error,
    context,
    agent,
    isVisible,
    showError,
    hideError,
    clearError
  };
}