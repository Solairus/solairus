import { AgentData } from '@/services/agent/agent-service';

export interface WithdrawalError {
  code: string;
  message: string;
  type: 'timing' | 'limit' | 'system' | 'validation';
}

// Common withdrawal error codes from the smart contract
export const WITHDRAWAL_ERROR_CODES = {
  WITHDRAWAL_TOO_EARLY: 'WithdrawalTooEarly',
  AGENT_RETIRED: 'AgentRetired',
  GLOBAL_WITHDRAWAL_LIMIT_REACHED: 'GlobalWithdrawalLimitReached',
  INSUFFICIENT_SYSTEM_RESERVE: 'InsufficientSystemReserve',
  AGENT_NOT_FOUND: 'AgentNotFound',
  INVALID_TIER: 'InvalidTier',
} as const;

/**
 * Parse error message and extract error code if possible
 */
export function parseWithdrawalError(error: string): WithdrawalError {
  const errorStr = error.toLowerCase();
  
  // Check for specific error codes
  if (errorStr.includes('withdrawal too early') || errorStr.includes('withdrawaltooearly')) {
    return {
      code: WITHDRAWAL_ERROR_CODES.WITHDRAWAL_TOO_EARLY,
      message: 'Withdrawal cooldown period has not elapsed yet',
      type: 'timing'
    };
  }
  
  if (errorStr.includes('agent retired') || errorStr.includes('agentretired') || errorStr.includes('yield cap')) {
    return {
      code: WITHDRAWAL_ERROR_CODES.AGENT_RETIRED,
      message: 'This agent has reached its yield cap and cannot generate more ROI',
      type: 'validation'
    };
  }
  
  if (errorStr.includes('global withdrawal limit') || errorStr.includes('globalwithdrawallimitreached')) {
    return {
      code: WITHDRAWAL_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED,
      message: 'You have reached your maximum withdrawal limit (200x deposits)',
      type: 'limit'
    };
  }
  
  if (errorStr.includes('insufficient system reserve') || errorStr.includes('insufficientsystemreserve')) {
    return {
      code: WITHDRAWAL_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE,
      message: 'System reserves are temporarily low. Please try again later',
      type: 'system'
    };
  }
  
  if (errorStr.includes('agent not found') || errorStr.includes('agentnotfound')) {
    return {
      code: WITHDRAWAL_ERROR_CODES.AGENT_NOT_FOUND,
      message: 'Agent activation record not found',
      type: 'validation'
    };
  }
  
  // Generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: error,
    type: 'system'
  };
}

/**
 * Get actionable guidance for withdrawal errors
 */
export function getWithdrawalGuidance(error: WithdrawalError, agent: AgentData): string {
  switch (error.code) {
    case WITHDRAWAL_ERROR_CODES.WITHDRAWAL_TOO_EARLY:
      if (!agent.lastRoiWithdrawal) {
        return 'New agents must wait for the activation delay before the first ROI withdrawal.';
      }
      return 'Each agent has a cooldown period between ROI withdrawals. Check the timer above for the exact time remaining.';
    
    case WITHDRAWAL_ERROR_CODES.AGENT_RETIRED:
      return `This ${agent.tierConfig.name} agent has reached its ${agent.tierConfig.yieldCapPct}% yield cap. Consider activating a new agent to continue earning.`;
    
    case WITHDRAWAL_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED:
      return 'You have withdrawn 200x your total deposits. This limit ensures system sustainability. You can still activate new agents to increase your limit.';
    
    case WITHDRAWAL_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE:
      return 'The system is temporarily processing high withdrawal volume. Please wait a few minutes and try again.';
    
    case WITHDRAWAL_ERROR_CODES.AGENT_NOT_FOUND:
      return 'There was an issue finding your agent record. Please refresh the page and try again.';
    
    default:
      return 'Please check your wallet connection and try again. If the problem persists, contact support.';
  }
}

/**
 * Get retry suggestion for withdrawal errors
 */
export function getRetryAction(error: WithdrawalError, agent: AgentData): {
  canRetry: boolean;
  retryText: string;
  retryDelay?: number; // in seconds
} {
  switch (error.code) {
    case WITHDRAWAL_ERROR_CODES.WITHDRAWAL_TOO_EARLY: {
      const nextWithdrawal = agent.nextWithdrawalAt;
      if (nextWithdrawal) {
        const delay = Math.max(0, Math.ceil((nextWithdrawal.getTime() - Date.now()) / 1000));
        return {
          canRetry: true,
          retryText: delay > 0 ? `Retry in ${Math.ceil(delay / 60)} minutes` : 'Retry now',
          retryDelay: delay
        };
      }
      return { canRetry: false, retryText: 'Check timer above' };
    }
    
    case WITHDRAWAL_ERROR_CODES.AGENT_RETIRED:
      return { canRetry: false, retryText: 'Agent permanently retired' };
    
    case WITHDRAWAL_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED:
      return { canRetry: false, retryText: 'Limit reached - activate new agents' };
    
    case WITHDRAWAL_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE:
      return { canRetry: true, retryText: 'Retry in 5 minutes', retryDelay: 300 };
    
    case WITHDRAWAL_ERROR_CODES.AGENT_NOT_FOUND:
      return { canRetry: true, retryText: 'Refresh and retry' };
    
    default:
      return { canRetry: true, retryText: 'Try again' };
  }
}