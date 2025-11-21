import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Timer, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentData } from '@/services/agent/agent-service';

interface WithdrawalTimerProps {
  agent: AgentData;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export const WithdrawalTimer: React.FC<WithdrawalTimerProps> = ({
  agent,
  className,
  showIcon = true,
  compact = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [timerType, setTimerType] = useState<'activation' | 'withdrawal' | 'ready' | 'retired'>('ready');
  
  // No contract timing; server provides cooldown via claimed_at + 24h

  // Calculate time remaining using backend-provided nextWithdrawalAt
  const calculateTimeRemaining = useCallback((): TimeRemaining | null => {
    const now = new Date();
    const targetTime: Date | null = agent.nextWithdrawalAt ?? (agent.lastRoiWithdrawal ? new Date(agent.lastRoiWithdrawal.getTime() + 24 * 60 * 60 * 1000) : null);
    let type: 'activation' | 'withdrawal' | 'ready' | 'retired' = 'ready';

    if (agent.yieldCapReached) {
      setTimerType('retired');
      return null;
    }

    if (targetTime && now < targetTime) {
      // If lastRoiWithdrawal exists and target equals claimed_at+24h, treat as withdrawal cooldown
      type = agent.lastRoiWithdrawal ? 'withdrawal' : 'activation';
    }

    setTimerType(type);

    if (!targetTime) return null;

    const diff = targetTime.getTime() - now.getTime();
    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, totalMs: diff };
  }, [agent.yieldCapReached, agent.nextWithdrawalAt, agent.lastRoiWithdrawal]);

  // Update timer every second
  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);
    };

    // Initial calculation
    updateTimer();

    // Set up interval to update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeRemaining]);

  // Format time for display with proper hh:mm:ss format
  const formatTime = (time: TimeRemaining): string => {
    if (compact) {
      // For compact mode, show live countdown in hh:mm:ss format
      const hours = String(time.hours).padStart(2, '0');
      const minutes = String(time.minutes).padStart(2, '0');
      const seconds = String(time.seconds).padStart(2, '0');
      
      if (time.hours > 0) {
        return `${hours}:${minutes}:${seconds}`;
      }
      return `${minutes}:${seconds}`;
    }

    // For full mode, show detailed countdown
    const hours = String(time.hours).padStart(2, '0');
    const minutes = String(time.minutes).padStart(2, '0');
    const seconds = String(time.seconds).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  };

  // Get status message with dynamic timing
  const getStatusMessage = (): string => {
    const displayName = '24 hours';
    
    switch (timerType) {
      case 'activation':
        return compact ? 'Activation delay' : `Waiting for ${displayName} activation delay`;
      case 'withdrawal':
        return compact ? 'Withdrawal cooldown' : `Waiting for ${displayName} withdrawal cooldown`;
      case 'retired':
        return 'Agent retired';
      case 'ready':
      default:
        return 'Ready to withdraw';
    }
  };

  // Get styling based on timer type
  const getStyling = () => {
    switch (timerType) {
      case 'activation':
        return {
          color: 'text-blue-400',
          icon: Clock,
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30'
        };
      case 'withdrawal':
        return {
          color: 'text-amber-400',
          icon: Timer,
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30'
        };
      case 'retired':
        return {
          color: 'text-red-400',
          icon: AlertCircle,
          bg: 'bg-red-500/10',
          border: 'border-red-500/30'
        };
      case 'ready':
      default:
        return {
          color: 'text-green-400',
          icon: CheckCircle,
          bg: 'bg-green-500/10',
          border: 'border-green-500/30'
        };
    }
  };

  const styling = getStyling();
  const IconComponent = styling.icon;

  // Compact version for use in cards
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2",
        className
      )}>
        {showIcon && <IconComponent className={cn("h-4 w-4", styling.color)} />}
        {timeRemaining ? (
          <div className={cn(
            "font-mono text-lg font-bold tracking-wider transition-all duration-300",
            styling.color,
            // Add pulsing animation when time is running low (less than 1 hour or 5 minutes in debug)
            timeRemaining.totalMs < 3600000 && "animate-pulse"
          )}>
            {formatTime(timeRemaining)}
          </div>
        ) : (
          <span className={cn("text-sm", styling.color)}>
            {getStatusMessage()}
          </span>
        )}
      </div>
    );
  }

  // Full version for detailed displays
  return (
    <div className={cn(
      "rounded-lg p-3 border transition-all duration-300",
      styling.bg,
      styling.border,
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        {showIcon && <IconComponent className={cn("h-4 w-4", styling.color)} />}
        <span className={cn("font-medium text-sm", styling.color)}>
          Withdrawal Status
        </span>
      </div>
      
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          {getStatusMessage()}
        </div>
        
        {timeRemaining && (
          <div className={cn("font-mono text-lg font-semibold", styling.color)}>
            {formatTime(timeRemaining)}
          </div>
        )}
        
        {timerType === 'ready' && (
          <div className="text-xs text-muted-foreground">
            You can withdraw ROI from this agent now
          </div>
        )}
        
        {timerType === 'activation' && (
          <div className="text-xs text-muted-foreground">
            Agents must wait 24 hours after activation before first withdrawal
          </div>
        )}
        
        {timerType === 'withdrawal' && (
          <div className="text-xs text-muted-foreground">
            Each agent has a 24 hours cooldown between ROI withdrawals
          </div>
        )}
        
        {timerType === 'retired' && (
          <div className="text-xs text-muted-foreground">
            This agent has reached its yield cap and cannot generate more ROI
          </div>
        )}
      </div>
    </div>
  );
};

// Multi-agent timer component for dashboard overview
interface MultiAgentTimerProps {
  agents: AgentData[];
  className?: string;
}

export const MultiAgentTimer: React.FC<MultiAgentTimerProps> = ({
  agents,
  className
}) => {
  const [nextAvailable, setNextAvailable] = useState<{
    agent: AgentData;
    timeRemaining: TimeRemaining;
  } | null>(null);
  // No contract timing; rely exclusively on backend nextWithdrawalAt

  useEffect(() => {

    const findNextAvailable = () => {
      let earliest: { agent: AgentData; time: Date } | null = null;

      for (const agent of agents) {
        if (agent.yieldCapReached) continue;

        const nextTime: Date | null = agent.nextWithdrawalAt ?? null;
        if (nextTime && (!earliest || nextTime < earliest.time)) {
          earliest = { agent, time: nextTime };
        }
      }

      if (earliest) {
        const now = new Date();
        const diff = earliest.time.getTime() - now.getTime();
        
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          setNextAvailable({
            agent: earliest.agent,
            timeRemaining: { hours, minutes, seconds, totalMs: diff }
          });
          return;
        }
      }

      setNextAvailable(null);
    };

    findNextAvailable();
    const interval = setInterval(findNextAvailable, 1000);
    return () => clearInterval(interval);
  }, [agents]);

  if (!nextAvailable) {
    const readyAgents = agents.filter(agent => agent.canWithdraw && !agent.yieldCapReached);
    
    if (readyAgents.length === 0) {
      return (
        <div className={cn(
          "rounded-lg p-3 bg-gray-500/10 border border-gray-500/30",
          className
        )}>
          <div className="flex items-center gap-2 text-gray-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">No agents available for withdrawal</span>
          </div>
        </div>
      );
    }

    return (
      <div className={cn(
        "rounded-lg p-3 bg-green-500/10 border border-green-500/30",
        className
      )}>
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">
            {readyAgents.length} agent{readyAgents.length !== 1 ? 's' : ''} ready for withdrawal
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg p-3 bg-amber-500/10 border border-amber-500/30",
      className
    )}>
      <div className="flex items-center gap-2 mb-1">
        <Timer className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-400">
          Next Available Withdrawal
        </span>
      </div>
      <div className="text-xs text-muted-foreground mb-1">
        Agent #{nextAvailable.agent.activationId} ({nextAvailable.agent.tierConfig.name})
      </div>
      <div className="font-mono text-lg font-semibold text-amber-400 tracking-wider">
        {String(nextAvailable.timeRemaining.hours).padStart(2, '0')}:
        {String(nextAvailable.timeRemaining.minutes).padStart(2, '0')}:
        {String(nextAvailable.timeRemaining.seconds).padStart(2, '0')}
      </div>
    </div>
  );
};