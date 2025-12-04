/**
 * Agent Error Handler
 * 
 * Purpose: Centralized error handling for AI agent operations with comprehensive error parsing
 * 
 * Key Features:
 * - Contract error parsing with specific agent error codes
 * - User-friendly error messages for agent operations
 * - Timing-specific error handling with countdown guidance
 * - Retry mechanisms with appropriate delays
 * - Context-aware error messages based on agent state
 * 
 * Error Categories:
 * - network: Connection/RPC issues (retryable)
 * - contract: Smart contract errors including agent-specific errors
 * - timing: 24-hour delay violations (retryable with delay)
 * - limits: Yield cap and withdrawal limit errors (not retryable)
 * - validation: Input validation and agent state errors
 * - transaction: Transaction-specific errors (retryable)
 * - unknown: Unexpected errors (retryable with caution)
 */

import { toast } from 'sonner';
import { AgentData } from '@/services/agent/agent-service';
import { AGENT_ERROR_CONFIG, getAgentUIConfig } from '@/config/agent-config';

export interface AgentError {
  type: 'network' | 'contract' | 'timing' | 'limits' | 'validation' | 'transaction' | 'unknown';
  code?: string | number;
  message: string;
  originalError: unknown;
  suggestedAction?: string;
  context?: string;
  isRetryable: boolean;
  retryDelay?: number; // in seconds
  agent?: AgentData;
}

// Agent-specific error codes from the smart contract
export const AGENT_ERROR_CODES = {
  // Agent system errors
  INVALID_TIER: 6015, // InvalidTier
  AGENT_RETIRED: 6016, // AgentRetired
  WITHDRAWAL_TOO_EARLY: 6017, // WithdrawalTooEarly
  GLOBAL_WITHDRAWAL_LIMIT_REACHED: 6018, // GlobalWithdrawalLimitReached
  AGENT_NOT_FOUND: 6019, // AgentNotFound
  INSUFFICIENT_SYSTEM_RESERVE: 6020, // InsufficientSystemReserve

  // Common Anchor errors
  UNAUTHORIZED: 6000,
  MATH_OVERFLOW: 6003,
  INVALID_AMOUNT: 6004,
  INSUFFICIENT_FUNDS: 6006,
  SEEDS_CONSTRAINT: 2006,
} as const;

export class AgentErrorHandler {
  /**
   * Parse and categorize agent-related errors
   */
  static parseError(error: unknown, context?: string, agent?: AgentData): AgentError {
    let errorMessage = '';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = String((error as Record<string, unknown>).message);
    } else if (typeof error === 'object' && error !== null && 'error' in error) {
      errorMessage = String((error as Record<string, unknown>).error);
    } else {
      errorMessage = String(error);
    }
    const lowerMessage = errorMessage.toLowerCase();

    // Extract error codes from Anchor errors
    const errorCode = this.extractErrorCode(errorMessage);

    // Network errors
    if (lowerMessage.includes('network') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('fetch') ||
      lowerMessage.includes('rpc')) {
      return {
        type: 'network',
        message: 'Network connection error. Please check your internet connection.',
        originalError: error,
        suggestedAction: 'Check your internet connection and retry',
        context,
        isRetryable: true,
        agent,
      };
    }

    // RPC rate limiting
    if (lowerMessage.includes('429') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')) {
      return {
        type: 'network',
        code: 429,
        message: 'Network is busy. Please wait a moment and try again.',
        originalError: error,
        suggestedAction: 'Wait 30 seconds and retry',
        context,
        isRetryable: true,
        retryDelay: 30,
        agent,
      };
    }

    // Agent-specific errors

    // Invalid tier (Anchor Error Code 6015)
    if (errorCode === AGENT_ERROR_CODES.INVALID_TIER ||
      lowerMessage.includes('invalid tier') ||
      lowerMessage.includes('invalidtier')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Invalid agent tier selected. Please choose a valid tier (NOVA, VEGA, ORION, or PRIME).',
        originalError: error,
        suggestedAction: 'Select a valid agent tier and try again',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Agent retired (Anchor Error Code 6016)
    if (errorCode === AGENT_ERROR_CODES.AGENT_RETIRED ||
      lowerMessage.includes('agent retired') ||
      lowerMessage.includes('agentretired') ||
      lowerMessage.includes('yield cap')) {
      const tierName = agent?.tierConfig?.name || 'agent';
      const yieldCap = agent?.tierConfig?.yieldCapPct || '175-250';
      return {
        type: 'limits',
        code: errorCode,
        message: `This ${tierName} agent has reached its ${yieldCap}% yield cap and cannot generate more ROI.`,
        originalError: error,
        suggestedAction: 'Consider activating a new agent to continue earning',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Withdrawal too early (Anchor Error Code 6017)
    if (errorCode === AGENT_ERROR_CODES.WITHDRAWAL_TOO_EARLY ||
      lowerMessage.includes('withdrawal too early') ||
      lowerMessage.includes('withdrawaltooearly') ||
      lowerMessage.includes('24 hour') ||
      lowerMessage.includes('cooldown')) {
      const isFirstWithdrawal = !agent?.lastRoiWithdrawal;
      const baseMessage = isFirstWithdrawal
        ? 'New agents must wait 24 hours after activation before the first ROI withdrawal.'
        : 'Each agent has a 24-hour cooldown between ROI withdrawals.';

      let retryDelay = 0;
      if (agent?.nextWithdrawalAt) {
        retryDelay = Math.max(0, Math.ceil((agent.nextWithdrawalAt.getTime() - Date.now()) / 1000));
      }

      return {
        type: 'timing',
        code: errorCode,
        message: baseMessage,
        originalError: error,
        suggestedAction: retryDelay > 0
          ? `Wait ${Math.ceil(retryDelay / 60)} minutes and try again`
          : 'Check the withdrawal timer and try again when available',
        context,
        isRetryable: true,
        retryDelay,
        agent,
      };
    }

    // Global withdrawal limit reached (Anchor Error Code 6018)
    if (errorCode === AGENT_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED ||
      lowerMessage.includes('global withdrawal limit') ||
      lowerMessage.includes('globalwithdrawallimitreached') ||
      lowerMessage.includes('200x deposits')) {
      return {
        type: 'limits',
        code: errorCode,
        message: 'You have reached your maximum withdrawal limit (200x your total deposits).',
        originalError: error,
        suggestedAction: 'Activate new agents to increase your deposit total and withdrawal limit',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Agent not found (Anchor Error Code 6019)
    if (errorCode === AGENT_ERROR_CODES.AGENT_NOT_FOUND ||
      lowerMessage.includes('agent not found') ||
      lowerMessage.includes('agentnotfound')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Agent activation record not found. This may be a temporary sync issue.',
        originalError: error,
        suggestedAction: 'Refresh the page and try again',
        context,
        isRetryable: true,
        agent,
      };
    }

    // Insufficient system reserve (Anchor Error Code 6020)
    if (errorCode === AGENT_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE ||
      lowerMessage.includes('insufficient system reserve') ||
      lowerMessage.includes('insufficientsystemreserve')) {
      return {
        type: 'contract',
        code: errorCode,
        message: 'System reserves are temporarily low due to high withdrawal volume.',
        originalError: error,
        suggestedAction: 'Wait a few minutes and try again',
        context,
        isRetryable: true,
        retryDelay: 300, // 5 minutes
        agent,
      };
    }

    // Common Anchor errors

    // Unauthorized (Anchor Error Code 6000)
    if (errorCode === AGENT_ERROR_CODES.UNAUTHORIZED ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('access denied')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'You do not have permission to perform this action on this agent.',
        originalError: error,
        suggestedAction: 'Ensure you are connected with the correct wallet',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Math overflow (Anchor Error Code 6003)
    if (errorCode === AGENT_ERROR_CODES.MATH_OVERFLOW ||
      lowerMessage.includes('math overflow')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Calculation overflow. The amount is too large.',
        originalError: error,
        suggestedAction: 'Use a smaller activation amount',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Invalid amount (Anchor Error Code 6004)
    if (errorCode === AGENT_ERROR_CODES.INVALID_AMOUNT ||
      lowerMessage.includes('invalid amount')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Invalid activation amount. Must be greater than zero.',
        originalError: error,
        suggestedAction: 'Enter a valid positive amount',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Insufficient funds
    if (errorCode === AGENT_ERROR_CODES.INSUFFICIENT_FUNDS ||
      lowerMessage.includes('insufficient') ||
      lowerMessage.includes('not enough') ||
      lowerMessage.includes('balance')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Insufficient USDT balance for agent activation.',
        originalError: error,
        suggestedAction: 'Add more USDT to your wallet',
        context,
        isRetryable: false,
        agent,
      };
    }

    // User rejection
    if (lowerMessage.includes('user rejected') ||
      lowerMessage.includes('user denied') ||
      lowerMessage.includes('cancelled') ||
      lowerMessage.includes('rejected by user')) {
      return {
        type: 'transaction',
        message: 'Transaction was cancelled by user.',
        originalError: error,
        suggestedAction: 'Try again and approve the transaction',
        context,
        isRetryable: true,
        agent,
      };
    }

    // Seeds constraint violation (Anchor Error Code 2006)
    if (errorCode === AGENT_ERROR_CODES.SEEDS_CONSTRAINT ||
      lowerMessage.includes('constraintseeds') ||
      lowerMessage.includes('seeds constraint')) {
      return {
        type: 'contract',
        code: errorCode,
        message: 'Account verification failed. Please ensure your wallet is connected.',
        originalError: error,
        suggestedAction: 'Check wallet connection and retry',
        context,
        isRetryable: true,
        agent,
      };
    }

    // Transaction errors
    if (lowerMessage.includes('transaction') ||
      lowerMessage.includes('signature') ||
      lowerMessage.includes('blockhash')) {
      return {
        type: 'transaction',
        message: 'Transaction failed. This may be a temporary network issue.',
        originalError: error,
        suggestedAction: 'Try again in a few moments',
        context,
        isRetryable: true,
        agent,
      };
    }

    // Smart contract errors
    if (lowerMessage.includes('program') ||
      lowerMessage.includes('instruction') ||
      lowerMessage.includes('account') ||
      lowerMessage.includes('anchor')) {
      return {
        type: 'contract',
        code: errorCode,
        message: 'Smart contract error. This may be a temporary issue.',
        originalError: error,
        suggestedAction: 'Try again in a few moments',
        context,
        isRetryable: true,
        agent,
      };
    }

    // Account restricted/banned (Generic message)
    if (lowerMessage.includes('withdrawal unavailable') ||
      lowerMessage.includes('withdrawals are disabled') ||
      lowerMessage.includes('unable to process withdrawal')) {
      return {
        type: 'validation',
        message: 'Unable to process withdrawal.',
        originalError: error,
        suggestedAction: 'Please contact support',
        context,
        isRetryable: false,
        agent,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: errorMessage || 'An unexpected error occurred.',
      originalError: error,
      suggestedAction: 'Try again or contact support if the issue persists',
      context,
      isRetryable: true,
      agent,
    };
  }

  /**
   * Extract error code from Anchor error messages
   */
  private static extractErrorCode(errorMessage: string): number | undefined {
    // Look for patterns like "Error Number: 6000" or "error code: 6000"
    const codeMatch = errorMessage.match(/(?:error\s+(?:number|code):\s*|Error\s+Number:\s*)(\d+)/i);
    if (codeMatch) {
      return parseInt(codeMatch[1], 10);
    }

    // Look for hex error codes
    const hexMatch = errorMessage.match(/0x([0-9a-f]+)/i);
    if (hexMatch) {
      return parseInt(hexMatch[1], 16);
    }

    return undefined;
  }

  /**
   * Get user-friendly error message with context
   */
  static getDisplayMessage(error: AgentError): string {
    const contextPrefix = error.context ? `${error.context}: ` : '';
    return `${contextPrefix}${error.message}`;
  }

  /**
   * Get suggested retry action for user
   */
  static getRetryGuidance(error: AgentError): string {
    if (!error.isRetryable) {
      return error.suggestedAction || 'This error cannot be retried';
    }

    if (error.retryDelay && error.retryDelay > 0) {
      const minutes = Math.ceil(error.retryDelay / 60);
      return `${error.suggestedAction || 'Try again'} (wait ${minutes} minute${minutes > 1 ? 's' : ''})`;
    }

    return error.suggestedAction || 'Try again';
  }

  /**
   * Get retry button text based on error type and delay
   */
  static getRetryButtonText(error: AgentError): string {
    if (!error.isRetryable) {
      return 'Cannot retry';
    }

    if (error.type === 'timing' && error.retryDelay && error.retryDelay > 0) {
      const minutes = Math.ceil(error.retryDelay / 60);
      return `Retry in ${minutes}m`;
    }

    if (error.type === 'contract' && error.code === AGENT_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE) {
      return 'Retry in 5m';
    }

    switch (error.type) {
      case 'network':
        return 'Retry';
      case 'transaction':
        return 'Try again';
      case 'contract':
        return 'Retry';
      case 'validation':
        return error.code === AGENT_ERROR_CODES.AGENT_NOT_FOUND ? 'Refresh & retry' : 'Cannot retry';
      default:
        return 'Retry';
    }
  }

  /**
   * Show error toast with appropriate styling and actions
   */
  static showErrorToast(error: AgentError, options?: {
    showRetry?: boolean;
    onRetry?: () => void;
    duration?: number;
  }) {
    const message = this.getDisplayMessage(error);
    const description = this.getRetryGuidance(error);
    const uiConfig = getAgentUIConfig();

    // Determine toast duration based on error type using configuration
    let duration = options?.duration;
    if (!duration) {
      switch (error.type) {
        case 'timing':
          duration = uiConfig.toastDurations.timing;
          break;
        case 'limits':
          duration = uiConfig.toastDurations.limits;
          break;
        case 'network':
          duration = uiConfig.toastDurations.error;
          break;
        default:
          duration = uiConfig.toastDurations.error;
      }
    }

    toast.error(message, {
      description,
      duration,
      action: options?.showRetry && options.onRetry && error.isRetryable ? {
        label: this.getRetryButtonText(error),
        onClick: options.onRetry,
      } : undefined,
    });
  }

  /**
   * Show success toast for agent operations
   */
  static showSuccessToast(message: string, options?: {
    description?: string;
    duration?: number;
    agent?: AgentData;
  }) {
    let description = options?.description;
    const uiConfig = getAgentUIConfig();

    // Add agent context to success messages
    if (options?.agent && !description) {
      const tierName = options.agent.tierConfig?.name || 'Agent';
      description = `${tierName} agent operation completed successfully`;
    }

    toast.success(message, {
      description,
      duration: options?.duration || uiConfig.toastDurations.success,
    });
  }

  /**
   * Show info toast for agent timing information
   */
  static showTimingInfo(message: string, options?: {
    description?: string;
    duration?: number;
  }) {
    const uiConfig = getAgentUIConfig();

    toast.info(message, {
      description: options?.description,
      duration: options?.duration || uiConfig.toastDurations.info,
    });
  }
}

/**
 * Hook for handling agent errors in components
 */
export function useAgentErrorHandler() {
  const handleError = (error: unknown, context?: string, agent?: AgentData): AgentError => {
    const agentError = AgentErrorHandler.parseError(error, context, agent);
    console.error(`Agent error (${context || 'unknown'}):`, agentError);
    return agentError;
  };

  const showError = (error: unknown, context?: string, agent?: AgentData, options?: {
    showRetry?: boolean;
    onRetry?: () => void;
    duration?: number;
  }) => {
    const agentError = handleError(error, context, agent);
    AgentErrorHandler.showErrorToast(agentError, options);
    return agentError;
  };

  const showSuccess = (message: string, options?: {
    description?: string;
    duration?: number;
    agent?: AgentData;
  }) => {
    AgentErrorHandler.showSuccessToast(message, options);
  };

  const showTimingInfo = (message: string, options?: {
    description?: string;
    duration?: number;
  }) => {
    AgentErrorHandler.showTimingInfo(message, options);
  };

  const getErrorMessage = (error: unknown, context?: string, agent?: AgentData): string => {
    const agentError = AgentErrorHandler.parseError(error, context, agent);
    return AgentErrorHandler.getDisplayMessage(agentError);
  };

  const getRetryGuidance = (error: unknown, agent?: AgentData): string => {
    const agentError = AgentErrorHandler.parseError(error, undefined, agent);
    return AgentErrorHandler.getRetryGuidance(agentError);
  };

  const isRetryable = (error: unknown, agent?: AgentData): boolean => {
    const agentError = AgentErrorHandler.parseError(error, undefined, agent);
    return agentError.isRetryable;
  };

  const getRetryDelay = (error: unknown, agent?: AgentData): number => {
    const agentError = AgentErrorHandler.parseError(error, undefined, agent);
    return agentError.retryDelay || 0;
  };

  const getErrorType = (error: unknown, agent?: AgentData): AgentError['type'] => {
    const agentError = AgentErrorHandler.parseError(error, undefined, agent);
    return agentError.type;
  };

  const getErrorCode = (error: unknown, agent?: AgentData): string | number | undefined => {
    const agentError = AgentErrorHandler.parseError(error, undefined, agent);
    return agentError.code;
  };

  const formatErrorForUI = (error: unknown, context?: string, agent?: AgentData) => {
    const agentError = AgentErrorHandler.parseError(error, context, agent);
    return {
      title: getErrorTitle(agentError),
      message: agentError.message,
      description: agentError.suggestedAction,
      type: agentError.type,
      isRetryable: agentError.isRetryable,
      retryDelay: agentError.retryDelay,
      retryButtonText: AgentErrorHandler.getRetryButtonText(agentError),
      severity: getErrorSeverity(agentError),
      icon: getErrorIcon(agentError),
      color: getErrorColor(agentError)
    };
  };

  return {
    handleError,
    showError,
    showSuccess,
    showTimingInfo,
    getErrorMessage,
    getRetryGuidance,
    isRetryable,
    getRetryDelay,
    getErrorType,
    getErrorCode,
    formatErrorForUI,
    parseError: AgentErrorHandler.parseError,
  };
}

/**
 * Get user-friendly error title based on error type and code
 */
function getErrorTitle(error: AgentError): string {
  switch (error.type) {
    case 'timing':
      if (error.code === AGENT_ERROR_CODES.WITHDRAWAL_TOO_EARLY) {
        return 'Withdrawal Cooldown Active';
      }
      return 'Timing Restriction';

    case 'limits':
      if (error.code === AGENT_ERROR_CODES.AGENT_RETIRED) {
        return 'Agent Retired';
      }
      if (error.code === AGENT_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED) {
        return 'Withdrawal Limit Reached';
      }
      return 'Limit Exceeded';

    case 'network':
      if (error.code === 429) {
        return 'Network Busy';
      }
      return 'Connection Error';

    case 'contract':
      if (error.code === AGENT_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE) {
        return 'System Reserves Low';
      }
      if (error.code === AGENT_ERROR_CODES.SEEDS_CONSTRAINT) {
        return 'Account Verification Failed';
      }
      return 'Smart Contract Error';

    case 'transaction':
      return 'Transaction Failed';

    case 'validation':
      if (error.code === AGENT_ERROR_CODES.INVALID_TIER) {
        return 'Invalid Tier';
      }
      if (error.code === AGENT_ERROR_CODES.INVALID_AMOUNT) {
        return 'Invalid Amount';
      }
      if (error.code === AGENT_ERROR_CODES.INSUFFICIENT_FUNDS) {
        return 'Insufficient Balance';
      }
      if (error.code === AGENT_ERROR_CODES.UNAUTHORIZED) {
        return 'Access Denied';
      }
      return 'Validation Error';

    default:
      return 'Unexpected Error';
  }
}

/**
 * Get error severity level for UI styling
 */
function getErrorSeverity(error: AgentError): 'low' | 'medium' | 'high' | 'critical' {
  switch (error.type) {
    case 'timing':
      return 'low'; // Expected behavior, just need to wait

    case 'limits':
      if (error.code === AGENT_ERROR_CODES.AGENT_RETIRED) {
        return 'medium'; // Expected end-of-life
      }
      return 'high'; // Limit reached, needs action

    case 'network':
      return 'medium'; // Usually temporary

    case 'contract':
      if (error.code === AGENT_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE) {
        return 'medium'; // Temporary system issue
      }
      return 'high'; // Contract issues need attention

    case 'transaction':
      return 'medium'; // Usually retryable

    case 'validation':
      if (error.code === AGENT_ERROR_CODES.UNAUTHORIZED) {
        return 'high'; // Security issue
      }
      return 'medium'; // User input issue

    default:
      return 'critical'; // Unknown errors are concerning
  }
}

/**
 * Get appropriate icon name for error type
 */
function getErrorIcon(error: AgentError): string {
  switch (error.type) {
    case 'timing':
      return 'Clock';
    case 'limits':
      return error.code === AGENT_ERROR_CODES.AGENT_RETIRED ? 'Ban' : 'AlertTriangle';
    case 'network':
      return 'Wifi';
    case 'contract':
      return 'AlertCircle';
    case 'transaction':
      return 'RefreshCw';
    case 'validation':
      return error.code === AGENT_ERROR_CODES.UNAUTHORIZED ? 'Shield' : 'AlertCircle';
    default:
      return 'AlertTriangle';
  }
}

/**
 * Get appropriate color scheme for error type
 */
function getErrorColor(error: AgentError): {
  primary: string;
  secondary: string;
  background: string;
  border: string;
} {
  switch (error.type) {
    case 'timing':
      return {
        primary: 'text-amber-500',
        secondary: 'text-amber-300',
        background: 'bg-amber-500/10',
        border: 'border-amber-500/30'
      };

    case 'limits':
      return {
        primary: 'text-red-500',
        secondary: 'text-red-300',
        background: 'bg-red-500/10',
        border: 'border-red-500/30'
      };

    case 'network':
      return {
        primary: 'text-orange-500',
        secondary: 'text-orange-300',
        background: 'bg-orange-500/10',
        border: 'border-orange-500/30'
      };

    case 'contract':
      return {
        primary: 'text-blue-500',
        secondary: 'text-blue-300',
        background: 'bg-blue-500/10',
        border: 'border-blue-500/30'
      };

    case 'transaction':
      return {
        primary: 'text-purple-500',
        secondary: 'text-purple-300',
        background: 'bg-purple-500/10',
        border: 'border-purple-500/30'
      };

    case 'validation':
      return {
        primary: 'text-red-500',
        secondary: 'text-red-300',
        background: 'bg-red-500/10',
        border: 'border-red-500/30'
      };

    default:
      return {
        primary: 'text-gray-500',
        secondary: 'text-gray-300',
        background: 'bg-gray-500/10',
        border: 'border-gray-500/30'
      };
  }
}