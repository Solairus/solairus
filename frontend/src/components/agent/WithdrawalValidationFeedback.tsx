import React from 'react';
import { AlertCircle, Clock, Timer, Ban, TrendingUp, Info, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentData } from '@/services/agent/agent-service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAgentErrorHandler, AgentError } from '@/utils/agent-error-handler';
import { AgentErrorDisplay } from './AgentErrorDisplay';

interface WithdrawalValidationFeedbackProps {
  agent: AgentData;
  error?: string | null;
  className?: string;
  onRetry?: () => void;
}

export const WithdrawalValidationFeedback: React.FC<WithdrawalValidationFeedbackProps> = ({
  agent,
  error,
  className,
  onRetry
}) => {
  const { parseError } = useAgentErrorHandler();
  // If no error, show success state or validation info
  if (!error) {
    // Show helpful info about withdrawal status
    if (agent.yieldCapReached) {
      return (
        <Alert className={cn("border-amber-500/30 bg-amber-500/10", className)}>
          <Ban className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-200">
            <div className="font-medium mb-1">Agent Retired</div>
            <div className="text-sm text-amber-300">
              This {agent.tierConfig.name} agent has reached its {agent.tierConfig.yieldCapPct}% yield cap 
              and has generated ${agent.totalRoiWithdrawn.toLocaleString('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })} in total ROI.
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    
    if (!agent.canWithdraw && agent.nextWithdrawalAt) {
      const timeUntil = agent.nextWithdrawalAt.getTime() - Date.now();
      const isActivationDelay = !agent.lastRoiWithdrawal;
      
      return (
        <Alert className={cn("border-blue-500/30 bg-blue-500/10", className)}>
          <Clock className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200">
            <div className="font-medium mb-1">
              {isActivationDelay ? 'Activation Delay' : 'Withdrawal Cooldown'}
            </div>
            <div className="text-sm text-blue-300">
              {isActivationDelay 
                ? 'New agents must wait for the activation delay before the first ROI withdrawal.'
                : 'Each agent has a cooldown period between ROI withdrawals.'
              }
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    
    if (agent.canWithdraw) {
      return (
        <Alert className={cn("border-green-500/30 bg-green-500/10", className)}>
          <TrendingUp className="h-4 w-4 text-green-400" />
          <AlertDescription className="text-green-200">
            <div className="font-medium mb-1">Ready for Withdrawal</div>
            <div className="text-sm text-green-300">
              This agent can generate ROI now. Monthly target: {agent.tierConfig.dailyRange}
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    
    return null;
  }

  // Use the enhanced error display component for better UX
  return (
    <AgentErrorDisplay
      error={error}
      context="ROI withdrawal"
      agent={agent}
      onRetry={onRetry}
      className={className}
      compact={true}
      showRetryButton={true}
    />
  );
};

// Hook for managing withdrawal validation state
export function useWithdrawalValidation(agent: AgentData) {
  const [error, setError] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  const validateWithdrawal = React.useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    setError(null);

    try {
      // Client-side validation
      if (agent.yieldCapReached) {
        setError('Agent has reached its yield cap and is retired');
        return false;
      }

      if (!agent.canWithdraw) {
        if (!agent.lastRoiWithdrawal) {
          setError('Withdrawal too early - activation delay required');
        } else {
          setError('Withdrawal too early - cooldown period required');
        }
        return false;
      }

      // Additional validations can be added here
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [agent]);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    isValidating,
    validateWithdrawal,
    clearError,
    setError
  };
}