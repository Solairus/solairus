import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Timer, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentData } from '@/services/agent/agent-service';
import { getContractSecondsPerDay, getContractTimingInfo } from '@/services/agent/contract-timing-service';
import { Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

interface WithdrawalTimerProps {
  agent: AgentData;
  connection?: Connection | anchor.AnchorProvider;
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
  connection,
  className,
  showIcon = true,
  compact = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [timerType, setTimerType] = useState<'activation' | 'withdrawal' | 'ready' | 'retired'>('ready');
  const [contractTiming, setContractTiming] = useState<{
    secondsPerDay: number;
    isDebugMode: boolean;
    displayName: string;
  } | null>(null);

  // Load contract timing information
  useEffect(() => {
    const loadContractTiming = async () => {
      if (!connection) {
        // Fallback to production timing if no connection
        setContractTiming({
          secondsPerDay: 86400,
          isDebugMode: false,
          displayName: '24 hours'
        });
        return;
      }

      try {
        const timingInfo = await getContractTimingInfo(connection);
        setContractTiming({
          secondsPerDay: timingInfo.secondsPerDay,
          isDebugMode: timingInfo.isDebugMode,
          displayName: timingInfo.displayName
        });
      } catch (error) {
        console.warn('Could not load contract timing, using fallback:', error);
        setContractTiming({
          secondsPerDay: 86400,
          isDebugMode: false,
          displayName: '24 hours'
        });
      }
    };

    loadContractTiming();
  }, [connection]);

  // Calculate time remaining until next withdrawal using contract timing
  const calculateTimeRemaining = useCallback((): TimeRemaining | null => {
    if (!contractTiming) return null;

    const now = new Date();
    let targetTime: Date | null = null;
    let type: 'activation' | 'withdrawal' | 'ready' | 'retired' = 'ready';

    // If agent is retired, no withdrawals possible
    if (agent.yieldCapReached) {
      setTimerType('retired');
      return null;
    }

    // Use contract timing instead of hardcoded 24 hours
    const millisecondsPerDay = contractTiming.secondsPerDay * 1000;

    // Check if contract time has passed since activation
    const activationDelay = new Date(agent.activatedAt.getTime() + millisecondsPerDay);
    if (now < activationDelay) {
      targetTime = activationDelay;
      type = 'activation';
    }
    // Check if contract time has passed since last withdrawal
    else if (agent.lastRoiWithdrawal) {
      const withdrawalDelay = new Date(agent.lastRoiWithdrawal.getTime() + millisecondsPerDay);
      if (now < withdrawalDelay) {
        targetTime = withdrawalDelay;
        type = 'withdrawal';
      }
    }

    setTimerType(type);

    if (!targetTime) {
      return null; // Ready to withdraw
    }

    const diff = targetTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      return null; // Time has passed
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      hours,
      minutes,
      seconds,
      totalMs: diff
    };
  }, [agent.yieldCapReached, agent.activatedAt, agent.lastRoiWithdrawal, contractTiming]);

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
    const timingDisplay = contractTiming?.displayName || '24 hours';
    
    switch (timerType) {
      case 'activation':
        return compact ? 'Activation delay' : `Waiting for ${timingDisplay} activation delay`;
      case 'withdrawal':
        return compact ? 'Withdrawal cooldown' : `Waiting for ${timingDisplay} withdrawal cooldown`;
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
            timeRemaining.totalMs < (contractTiming?.isDebugMode ? 60000 : 3600000) && "animate-pulse"
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
            Agents must wait {contractTiming?.displayName || '24 hours'} after activation before first withdrawal
            {contractTiming?.isDebugMode && (
              <span className="text-amber-400 ml-1">(Debug Mode)</span>
            )}
          </div>
        )}
        
        {timerType === 'withdrawal' && (
          <div className="text-xs text-muted-foreground">
            Each agent has a {contractTiming?.displayName || '24 hours'} cooldown between ROI withdrawals
            {contractTiming?.isDebugMode && (
              <span className="text-amber-400 ml-1">(Debug Mode)</span>
            )}
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
  connection?: Connection | anchor.AnchorProvider;
  className?: string;
}

export const MultiAgentTimer: React.FC<MultiAgentTimerProps> = ({
  agents,
  connection,
  className
}) => {
  const [nextAvailable, setNextAvailable] = useState<{
    agent: AgentData;
    timeRemaining: TimeRemaining;
  } | null>(null);
  const [contractTiming, setContractTiming] = useState<{
    secondsPerDay: number;
    isDebugMode: boolean;
  } | null>(null);

  // Load contract timing
  useEffect(() => {
    const loadContractTiming = async () => {
      if (!connection) {
        setContractTiming({ secondsPerDay: 86400, isDebugMode: false });
        return;
      }

      try {
        const timingInfo = await getContractTimingInfo(connection);
        setContractTiming({
          secondsPerDay: timingInfo.secondsPerDay,
          isDebugMode: timingInfo.isDebugMode
        });
      } catch (error) {
        console.warn('Could not load contract timing for multi-agent timer:', error);
        setContractTiming({ secondsPerDay: 86400, isDebugMode: false });
      }
    };

    loadContractTiming();
  }, [connection]);

  useEffect(() => {
    if (!contractTiming) return;

    const findNextAvailable = () => {
      let earliest: { agent: AgentData; time: Date } | null = null;
      const millisecondsPerDay = contractTiming.secondsPerDay * 1000;

      for (const agent of agents) {
        if (agent.yieldCapReached) continue;

        const now = new Date();
        let nextTime: Date | null = null;

        // Check activation delay using contract timing
        const activationDelay = new Date(agent.activatedAt.getTime() + millisecondsPerDay);
        if (now < activationDelay) {
          nextTime = activationDelay;
        }
        // Check withdrawal delay using contract timing
        else if (agent.lastRoiWithdrawal) {
          const withdrawalDelay = new Date(agent.lastRoiWithdrawal.getTime() + millisecondsPerDay);
          if (now < withdrawalDelay) {
            nextTime = withdrawalDelay;
          }
        }

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
  }, [agents, contractTiming]);

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