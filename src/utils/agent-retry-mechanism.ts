/**
 * Agent Retry Mechanism
 * 
 * Purpose: Intelligent retry logic for agent operations with user-friendly controls
 * 
 * Key Features:
 * - Automatic retry with exponential backoff for appropriate errors
 * - Manual retry controls for user-initiated operations
 * - Context-aware retry strategies based on error type
 * - Rate limiting to prevent abuse
 * - User feedback and progress tracking
 */

import { AgentErrorHandler, AgentError, AGENT_ERROR_CODES } from './agent-error-handler';
import { AgentData } from '@/services/agent/agent-service';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  backoffMultiplier: number;
  retryableErrors: string[]; // Error codes that should be retried
  userConfirmationRequired?: boolean; // Whether user must confirm retries
}

export interface RetryState {
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  isRetrying: boolean;
  canRetry: boolean;
  userConfirmationRequired: boolean;
  lastError?: AgentError;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: AgentError;
  retryState: RetryState;
}

/**
 * Default retry configurations for different operation types
 */
export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  // Network operations - aggressive retry
  network: {
    maxAttempts: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableErrors: ['network', 'timeout', 'connection'],
    userConfirmationRequired: false
  },

  // ROI withdrawal - conservative retry
  withdrawal: {
    maxAttempts: 3,
    baseDelay: 2000, // 2 seconds
    maxDelay: 60000, // 1 minute
    backoffMultiplier: 2,
    retryableErrors: ['network', 'contract', 'transaction'],
    userConfirmationRequired: true // User must confirm financial operations
  },

  // Agent activation - very conservative
  activation: {
    maxAttempts: 2,
    baseDelay: 3000, // 3 seconds
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 1.5,
    retryableErrors: ['network', 'transaction'],
    userConfirmationRequired: true // Always require confirmation for activations
  },

  // Data queries - moderate retry
  query: {
    maxAttempts: 4,
    baseDelay: 500, // 0.5 seconds
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: ['network', 'timeout'],
    userConfirmationRequired: false
  }
};

export class AgentRetryMechanism {
  private retryState: RetryState;
  private config: RetryConfig;
  private operationType: string;

  constructor(operationType: string, customConfig?: Partial<RetryConfig>) {
    this.operationType = operationType;
    this.config = {
      ...RETRY_CONFIGS[operationType] || RETRY_CONFIGS.query,
      ...customConfig
    };
    
    this.retryState = {
      attempt: 0,
      maxAttempts: this.config.maxAttempts,
      nextRetryAt: null,
      isRetrying: false,
      canRetry: true,
      userConfirmationRequired: this.config.userConfirmationRequired || false
    };
  }

  /**
   * Execute operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: string,
    agent?: AgentData,
    onRetryAttempt?: (attempt: number, error: AgentError) => void,
    onUserConfirmation?: (error: AgentError) => Promise<boolean>
  ): Promise<RetryResult<T>> {
    this.retryState.isRetrying = true;

    while (this.retryState.attempt < this.config.maxAttempts) {
      try {
        this.retryState.attempt++;
        
        // Execute the operation
        const result = await operation();
        
        // Success - reset retry state
        this.resetRetryState();
        return {
          success: true,
          data: result,
          retryState: { ...this.retryState }
        };

      } catch (error) {
        const agentError = AgentErrorHandler.parseError(error, context, agent);
        this.retryState.lastError = agentError;

        console.log(`❌ Operation failed (attempt ${this.retryState.attempt}/${this.config.maxAttempts}):`, {
          type: agentError.type,
          code: agentError.code,
          message: agentError.message
        });

        // Check if error is retryable
        if (!this.shouldRetryError(agentError)) {
          console.log('🚫 Error is not retryable');
          this.retryState.canRetry = false;
          this.retryState.isRetrying = false;
          return {
            success: false,
            error: agentError,
            retryState: { ...this.retryState }
          };
        }

        // Check if we've exhausted retry attempts
        if (this.retryState.attempt >= this.config.maxAttempts) {
          console.log('🚫 Maximum retry attempts reached');
          this.retryState.canRetry = false;
          this.retryState.isRetrying = false;
          return {
            success: false,
            error: agentError,
            retryState: { ...this.retryState }
          };
        }

        // Calculate delay for next retry
        const delay = this.calculateRetryDelay(this.retryState.attempt);
        this.retryState.nextRetryAt = new Date(Date.now() + delay);

        // Notify about retry attempt
        onRetryAttempt?.(this.retryState.attempt, agentError);

        // Check if user confirmation is required
        if (this.config.userConfirmationRequired && onUserConfirmation) {
          const userConfirmed = await onUserConfirmation(agentError);
          if (!userConfirmed) {
            console.log('🚫 User cancelled retry');
            this.retryState.canRetry = false;
            this.retryState.isRetrying = false;
            return {
              success: false,
              error: agentError,
              retryState: { ...this.retryState }
            };
          }
        }

        // Wait before retry
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // Should not reach here, but handle gracefully
    this.retryState.isRetrying = false;
    return {
      success: false,
      error: this.retryState.lastError,
      retryState: { ...this.retryState }
    };
  }

  /**
   * Manual retry - for user-initiated retries
   */
  async manualRetry<T>(
    operation: () => Promise<T>,
    context?: string,
    agent?: AgentData
  ): Promise<RetryResult<T>> {
    if (!this.retryState.canRetry) {
      return {
        success: false,
        error: this.retryState.lastError,
        retryState: { ...this.retryState }
      };
    }

    // Reset attempt counter for manual retry
    this.retryState.attempt = 0;
    this.retryState.isRetrying = true;

    try {
      const result = await operation();
      this.resetRetryState();
      return {
        success: true,
        data: result,
        retryState: { ...this.retryState }
      };
    } catch (error) {
      const agentError = AgentErrorHandler.parseError(error, context, agent);
      this.retryState.lastError = agentError;
      this.retryState.isRetrying = false;
      
      return {
        success: false,
        error: agentError,
        retryState: { ...this.retryState }
      };
    }
  }

  /**
   * Check if error should be retried based on configuration
   */
  private shouldRetryError(error: AgentError): boolean {
    // Never retry non-retryable errors
    if (!error.isRetryable) {
      return false;
    }

    // Check specific error codes that should never be retried
    const nonRetryableCodes = [
      AGENT_ERROR_CODES.AGENT_RETIRED,
      AGENT_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED,
      AGENT_ERROR_CODES.INVALID_TIER,
      AGENT_ERROR_CODES.INVALID_AMOUNT,
      AGENT_ERROR_CODES.UNAUTHORIZED
    ];

    if (typeof error.code === 'number' && nonRetryableCodes.includes(error.code)) {
      return false;
    }

    // Check if error type is in retryable list
    return this.config.retryableErrors.includes(error.type);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset retry state
   */
  private resetRetryState(): void {
    this.retryState = {
      attempt: 0,
      maxAttempts: this.config.maxAttempts,
      nextRetryAt: null,
      isRetrying: false,
      canRetry: true,
      userConfirmationRequired: this.config.userConfirmationRequired || false
    };
  }

  /**
   * Get current retry state
   */
  getRetryState(): RetryState {
    return { ...this.retryState };
  }

  /**
   * Check if operation can be retried
   */
  canRetry(): boolean {
    return this.retryState.canRetry && this.retryState.attempt < this.config.maxAttempts;
  }

  /**
   * Get time until next retry is available
   */
  getTimeUntilNextRetry(): number {
    if (!this.retryState.nextRetryAt) return 0;
    return Math.max(0, this.retryState.nextRetryAt.getTime() - Date.now());
  }
}

/**
 * Hook for using retry mechanism in React components
 */
export function useAgentRetryMechanism(operationType: string, customConfig?: Partial<RetryConfig>) {
  const retryMechanism = new AgentRetryMechanism(operationType, customConfig);

  const executeWithRetry = async <T>(
    operation: () => Promise<T>,
    options?: {
      context?: string;
      agent?: AgentData;
      onRetryAttempt?: (attempt: number, error: AgentError) => void;
      onUserConfirmation?: (error: AgentError) => Promise<boolean>;
    }
  ): Promise<RetryResult<T>> => {
    return retryMechanism.executeWithRetry(
      operation,
      options?.context,
      options?.agent,
      options?.onRetryAttempt,
      options?.onUserConfirmation
    );
  };

  const manualRetry = async <T>(
    operation: () => Promise<T>,
    context?: string,
    agent?: AgentData
  ): Promise<RetryResult<T>> => {
    return retryMechanism.manualRetry(operation, context, agent);
  };

  return {
    executeWithRetry,
    manualRetry,
    getRetryState: () => retryMechanism.getRetryState(),
    canRetry: () => retryMechanism.canRetry(),
    getTimeUntilNextRetry: () => retryMechanism.getTimeUntilNextRetry()
  };
}

/**
 * Utility function to create operation-specific retry mechanisms
 */
export function createRetryMechanism(operationType: string, customConfig?: Partial<RetryConfig>) {
  return new AgentRetryMechanism(operationType, customConfig);
}