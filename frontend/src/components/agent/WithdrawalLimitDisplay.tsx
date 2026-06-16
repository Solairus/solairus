import React from 'react';
import { WithdrawalLimitDisplay as WithdrawalLimitStatus } from '@/services/agent/withdrawal-limit-service';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  Crown, 
  DollarSign, 
  TrendingUp,
  Info,
  Target,
  BarChart3
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WithdrawalLimitDisplayProps {
  status: WithdrawalLimitStatus;
  className?: string;
}

export const WithdrawalLimitDisplay: React.FC<WithdrawalLimitDisplayProps> = ({ 
  status, 
  className 
}) => {
  // Get warning level styling
  const getWarningLevelStyling = (level: WithdrawalLimitStatus['warningLevel']) => {
    switch (level) {
      case 'critical':
        return {
          icon: AlertTriangle,
          iconColor: 'text-destructive',
          progressColor: 'bg-destructive',
          badgeVariant: 'destructive' as const,
          borderColor: 'border-destructive/30',
          bgGradient: 'from-destructive/10 to-destructive/5'
        };
      case 'high':
        return {
          icon: AlertTriangle,
          iconColor: 'text-orange-500',
          progressColor: 'bg-orange-500',
          badgeVariant: 'secondary' as const,
          borderColor: 'border-orange-500/30',
          bgGradient: 'from-orange-500/10 to-orange-500/5'
        };
      case 'medium':
        return {
          icon: Info,
          iconColor: 'text-amber-500',
          progressColor: 'bg-amber-500',
          badgeVariant: 'secondary' as const,
          borderColor: 'border-amber-500/30',
          bgGradient: 'from-amber-500/10 to-amber-500/5'
        };
      case 'low':
        return {
          icon: TrendingUp,
          iconColor: 'text-blue-500',
          progressColor: 'bg-blue-500',
          badgeVariant: 'secondary' as const,
          borderColor: 'border-blue-500/30',
          bgGradient: 'from-blue-500/10 to-blue-500/5'
        };
      default:
        return {
          icon: CheckCircle,
          iconColor: 'text-green-500',
          progressColor: 'bg-green-500',
          badgeVariant: 'secondary' as const,
          borderColor: 'border-green-500/30',
          bgGradient: 'from-green-500/10 to-green-500/5'
        };
    }
  };

  const styling = getWarningLevelStyling(status.warningLevel);
  const IconComponent = styling.icon;

  // Format large numbers for display
  const formatLargeNumber = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return value;
  };

  return (
    <div className={cn(
      "glass rounded-xl p-4 transition-all duration-300",
      "bg-gradient-to-br", styling.bgGradient,
      styling.borderColor, "border",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconComponent className={cn("h-5 w-5", styling.iconColor)} />
          <h3 className="font-semibold text-sm">Global Agent's Power & PnL</h3>
          {status.isPrivileged && (
            <Crown className="h-4 w-4 text-amber-500" />
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Withdrawal limit is 2x your total agent deposits. Current usage: {status.usagePercentage.toFixed(1)}%
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <Badge variant={styling.badgeVariant} className="text-xs">
          {status.isPrivileged ? 'Unlimited' : `${status.usagePercentage.toFixed(0)}% Used`}
        </Badge>
      </div>

      {/* Status Message */}
      <div className="mb-4">
        <p className={cn(
          "text-sm font-medium",
          styling.iconColor
        )}>
          {status.statusMessage.replace('Withdrawal limit', 'PnL capacity')}
        </p>
      </div>

      {/* Progress Bar (only for non-privileged users) */}
      {!status.isPrivileged && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Usage Progress</span>
            <span className="text-xs font-medium">
              {status.usagePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={Math.min(status.usagePercentage, 100)} 
              className="h-3"
            />
          </div>
        </div>
      )}

      {/* Detailed Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Liquidity */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>Total Liquidity</span>
          </div>
          <p className="font-semibold text-sm">
            ${formatLargeNumber(status.totalDeposits)}
          </p>
        </div>

        {/* Total PnL */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Total PnL</span>
          </div>
          <p className="font-semibold text-sm">
            ${formatLargeNumber(status.totalWithdrawn)}
          </p>
        </div>

        {/* Target PnL */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>Target PnL</span>
          </div>
          <p className="font-semibold text-sm">
            {status.maxWithdrawable === 'Unlimited' ? status.maxWithdrawable : `$${formatLargeNumber(status.maxWithdrawable)}`}
          </p>
        </div>

        {/* PnL Estimation */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span>PnL Estimation</span>
          </div>
          <p className={cn(
            "font-semibold text-sm",
            status.limitReached ? "text-destructive" : "text-green-500"
          )}>
            {status.remainingWithdrawable === 'Unlimited' ? status.remainingWithdrawable : `$${formatLargeNumber(status.remainingWithdrawable)}`}
          </p>
        </div>
      </div>

      {/* Additional Info - Only for privileged accounts */}
      {status.isPrivileged && (
        <div className="mt-4 pt-3 border-t border-border/30">
          <div className="flex items-start gap-2">
            <Crown className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p>
                <span className="text-amber-500 font-medium">Privileged Account:</span> You have unlimited PnL access.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};