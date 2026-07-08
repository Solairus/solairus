import React, { useState } from 'react';
import { Connection } from '@solana/web3.js';
import { AgentData } from '@/services/agent/agent-service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WithdrawalTimer } from './WithdrawalTimer';
import { WithdrawalValidationFeedback, useWithdrawalValidation } from './WithdrawalValidationFeedback';
import { useAgentErrorHandler } from '@/utils/agent-error-handler';
import { useAgentRetryMechanism } from '@/utils/agent-retry-mechanism';
import { AgentErrorDisplay } from './AgentErrorDisplay';
import { getTierStyling } from '@/services/agent/tiers-ui';
import { useLiveRoi } from '@/services/agent/live-roi-service';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: AgentData;
  onWithdraw: (activationId: number) => Promise<void>;
  connection?: Connection;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onWithdraw, connection }) => {
  const [withdrawing, setWithdrawing] = useState(false);
  const [lastError, setLastError] = useState<unknown>(null);
  const { error, validateWithdrawal, clearError, setError } = useWithdrawalValidation(agent);
  const { showError, showSuccess, formatErrorForUI } = useAgentErrorHandler();
  const { executeWithRetry } = useAgentRetryMechanism('withdrawal');

  // Live ROI tracking (updates every minute)
  const { liveRoi } = useLiveRoi();

  // Handle ROI withdrawal with enhanced error handling and retry logic
  const handleWithdraw = async () => {
    if (withdrawing) return;

    // Clear any previous errors
    clearError();
    setLastError(null);

    // Validate withdrawal before attempting
    const isValid = await validateWithdrawal();
    if (!isValid) return;

    setWithdrawing(true);

    try {
      // Use retry mechanism for withdrawal operation
      const result = await executeWithRetry(
        () => onWithdraw(agent.activationId),
        {
          context: 'ROI withdrawal',
          agent,
          onRetryAttempt: (attempt, error) => {
            console.log(`🔄 Retry attempt ${attempt} for agent ${agent.activationId}:`, error.message);
            showError(error, 'ROI withdrawal retry', agent, {
              showRetry: false,
              duration: 3000
            });
          },
          onUserConfirmation: async (error) => {
            // For now, auto-confirm retries for network/transaction errors
            // In a real app, you might show a confirmation dialog
            const errorInfo = formatErrorForUI(error, 'ROI withdrawal', agent);
            return errorInfo.type === 'network' || errorInfo.type === 'transaction';
          }
        }
      );

      if (result.success) {
        // Show success message
        showSuccess('ROI withdrawal successful!', {
          description: `Withdrew ROI from ${agent.tierConfig.name} agent`,
          agent
        });

        // Clear any previous errors
        clearError();
        setLastError(null);
      } else {
        // Handle failure after retries
        const errorInfo = formatErrorForUI(result.error || 'Withdrawal failed', 'ROI withdrawal', agent);
        setLastError(result.error);
        setError(errorInfo.message);

        // Show error toast for immediate feedback
        showError(result.error || 'Withdrawal failed', 'ROI withdrawal', agent, {
          showRetry: false,
          onRetry: handleWithdraw
        });
      }
    } catch (error) {
      console.error('❌ Error withdrawing ROI:', error);

      // Handle unexpected errors
      setLastError(error);
      const agentError = showError(error, 'ROI withdrawal', agent, {
        showRetry: false,
        onRetry: handleWithdraw
      });

      setError(agentError.message);
    } finally {
      setWithdrawing(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };



  // Get tier-specific styling from configuration
  const styling = getTierStyling(agent.tier);

  return (
    <div className={cn(
      "glass rounded-xl p-4 transition-all duration-300 hover:scale-[1.02]",
      "bg-gradient-to-br", styling.gradient,
      styling.border, "border"
    )}>
      {/* Header with Tier and Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{agent.tierConfig.emoji}</span>
          <div>
            <h3 className={cn("font-semibold text-sm", styling.accent)}>
              {agent.tierConfig.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {agent.tierConfig.description}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <Badge
          variant={agent.yieldCapReached ? "destructive" : "default"}
          className="text-xs"
        >
          {agent.yieldCapReached ? "Retired" : "Active"}
        </Badge>
      </div>

      {/* Trading Details */}
      <div className="space-y-3 mb-4">
        {/* Active Liquidity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>Active Liquidity</span>
          </div>
          <span className="font-semibold">
            ${agent.activationAmount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>

        {/* Activation Date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Activated</span>
          </div>
          <span className="text-sm">
            {formatDate(agent.activatedAt)}
          </span>
        </div>

        {/* Target Monthly Return */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Monthly Target</span>
          </div>
          <span className="text-sm font-medium">
            {agent.tierConfig.dailyRange}
          </span>
        </div>
      </div>

      {/* PnL Progress */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">PnL Progress</span>
          <span className="text-xs font-medium">
            {agent.yieldCapProgress.toFixed(1)}% / {agent.tierConfig.yieldCapPct}%
          </span>
        </div>
        <Progress
          value={Math.min(agent.yieldCapProgress, 100)}
          className="h-2"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Claimed: ${(agent.totalClaimed ?? agent.totalRoiWithdrawn).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
          {agent.yieldCapReached && (
            <span className="text-destructive font-medium">
              Cap Reached
            </span>
          )}
        </div>
      </div>

      {/* Withdrawal Section */}
      <div className="space-y-2">


        {/* Live Countdown Timer - show when agent is in cooldown */}
        {!agent.canWithdraw && !agent.yieldCapReached && (
          <WithdrawalTimer
            agent={agent}
            compact={true}
            className="justify-center"
          />
        )}

        {/* Withdrawal Button - only show when ready to claim or retired */}
        {(agent.canWithdraw || agent.yieldCapReached) && (
          <Button
            onClick={handleWithdraw}
            disabled={!agent.canWithdraw || withdrawing || agent.yieldCapReached}
            className={cn(
              "w-full text-xs h-8",
              agent.canWithdraw && !agent.yieldCapReached && "hover:shadow-lg"
            )}
            variant={agent.canWithdraw && !agent.yieldCapReached ? "default" : "outline"}
          >
            {withdrawing ? (
              <>
                <Zap className="h-3 w-3 mr-1 animate-pulse" />
                Processing...
              </>
            ) : agent.yieldCapReached ? (
              "Agent Retired"
            ) : (
              <>
                <TrendingUp className="h-3 w-3 mr-1" />
                Claim PnL Now {agent.unclaimedAmount !== undefined && agent.unclaimedAmount > 0
                  ? `$${agent.unclaimedAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}`
                  : ''
                }
              </>
            )}
          </Button>
        )}

        {/* Enhanced Error Display */}
        {lastError && (
          <div className="mt-2">
            <AgentErrorDisplay
              error={lastError}
              context="ROI withdrawal"
              agent={agent}
              onRetry={handleWithdraw}
              compact={true}
              className="text-xs"
            />
          </div>
        )}

        {/* Only show validation feedback for actual errors, not timing issues */}
        {!lastError && error && agent.yieldCapReached && (
          <div className="mt-2">
            <WithdrawalValidationFeedback
              agent={agent}
              error={error}
              onRetry={handleWithdraw}
              className="text-xs"
            />
          </div>
        )}
      </div>

      {/* Last Withdrawal Info */}
      {agent.lastRoiWithdrawal && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last Claimed at:</span>
            <span>{formatDate(agent.lastRoiWithdrawal)}</span>
          </div>
        </div>
      )}
    </div>
  );
};