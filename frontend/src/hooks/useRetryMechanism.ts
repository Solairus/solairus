/**
 * Retry Mechanism Hook
 * 
 * Purpose: Provide intelligent retry mechanisms for failed operations
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Circuit breaker pattern
 * - Retry history tracking
 * - User-controlled retry triggers
 */

import { useState, useCallback, useRef } from 'react';
import { AdminError, AdminErrorHandler } from '@/utils/admin-error-handler';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: AdminError, attempt: number) => boolean;
}

export interface RetryState {
  attempt: number;
  maxRetries: number;
  isRetrying: boolean;
  lastError?: AdminError;
  retryHistory: Array<{
    attempt: number;
    error: AdminError;
    timestamp: number;
    delay: number;
  }>;
  nextRetryIn?: number;
  canRetry: boolean;
}

export interface RetryOptions extends Partial<RetryConfig> {
  onRetryAttempt?: (attempt: number, error: AdminError) => void;
  onRetrySuccess?: (attempt: number) => void;
  onRetryFailed?: (finalError: AdminError, attempts: number) => void;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

export function useRetryMechanism(options: RetryOptions = {}) {
  const config: RetryConfig = { ...DEFAULT_CONFIG, ...options };
  
  const [state, setState] = useState<RetryState>({
    attempt: 0,
    maxRetries: config.maxRetries,
    isRetrying: false,
    retryHistory: [],
    canRetry: false,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const countdownIntervalRef = useRef<NodeJS.Timeout>();

  const calculateDelay = useCallback((attempt: number): number => {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }, [config]);

  const shouldRetry = useCallback((error: AdminError, attempt: number): boolean => {
    // Check custom retry condition first
    if (config.retryCondition) {
      return config.retryCondition(error, attempt);
    }

    // Default retry logic
    return (
      attempt < config.maxRetries &&
      !['authorization', 'validation'].includes(error.type)
    );
  }, [config]);

  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setState({
      attempt: 0,
      maxRetries: config.maxRetries,
      isRetrying: false,
      retryHistory: [],
      canRetry: false,
    });
  }, [config.maxRetries]);

  const startCountdown = useCallback((delay: number) => {
    let remaining = Math.ceil(delay / 1000);
    
    setState(prev => ({ ...prev, nextRetryIn: remaining }));
    
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        setState(prev => ({ ...prev, nextRetryIn: undefined }));
      } else {
        setState(prev => ({ ...prev, nextRetryIn: remaining }));
      }
    }, 1000);
  }, []);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> => {
    const attempt = state.attempt + 1;
    
    setState(prev => ({
      ...prev,
      attempt,
      isRetrying: attempt > 1,
    }));

    try {
      const result = await operation();
      
      // Success - reset state
      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: undefined,
        canRetry: false,
      }));

      options.onRetrySuccess?.(attempt);
      return result;

    } catch (error) {
      const adminError = AdminErrorHandler.parseError(error, context);
      
      // Add to retry history
      const historyEntry = {
        attempt,
        error: adminError,
        timestamp: Date.now(),
        delay: 0,
      };

      setState(prev => ({
        ...prev,
        lastError: adminError,
        retryHistory: [...prev.retryHistory, historyEntry],
      }));

      options.onRetryAttempt?.(attempt, adminError);

      // Check if we should retry
      if (shouldRetry(adminError, attempt)) {
        const delay = calculateDelay(attempt);
        
        // Update history with delay
        setState(prev => ({
          ...prev,
          canRetry: true,
          retryHistory: prev.retryHistory.map((entry, index) =>
            index === prev.retryHistory.length - 1 ? { ...entry, delay } : entry
          ),
        }));

        startCountdown(delay);

        // Schedule retry
        return new Promise((resolve, reject) => {
          retryTimeoutRef.current = setTimeout(async () => {
            try {
              const result = await executeWithRetry(operation, context);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          }, delay);
        });
      } else {
        // No more retries
        setState(prev => ({
          ...prev,
          isRetrying: false,
          canRetry: false,
        }));

        options.onRetryFailed?.(adminError, attempt);
        throw adminError;
      }
    }
  }, [
    state.attempt,
    shouldRetry,
    calculateDelay,
    startCountdown,
    options,
  ]);

  const manualRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> => {
    if (!state.canRetry || !state.lastError) {
      throw new Error('No retryable operation available');
    }

    return executeWithRetry(operation, context);
  }, [state.canRetry, state.lastError, executeWithRetry]);

  const forceRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> => {
    // Reset attempt counter for forced retry
    setState(prev => ({ ...prev, attempt: 0 }));
    return executeWithRetry(operation, context);
  }, [executeWithRetry]);

  return {
    state,
    executeWithRetry,
    manualRetry,
    forceRetry,
    reset,
    
    // Computed values
    hasRetryHistory: state.retryHistory.length > 0,
    totalAttempts: state.retryHistory.length,
    lastAttemptTime: state.retryHistory[state.retryHistory.length - 1]?.timestamp,
    averageDelay: state.retryHistory.length > 0
      ? state.retryHistory.reduce((sum, entry) => sum + entry.delay, 0) / state.retryHistory.length
      : 0,
    
    // Utility functions
    getRetryGuidance: () => state.lastError ? AdminErrorHandler.getRetryGuidance(state.lastError) : '',
    isRetryRecommended: () => state.lastError ? !['authorization', 'validation'].includes(state.lastError.type) : false,
  };
}

/**
 * Specialized hook for network operations with circuit breaker
 */
export function useNetworkRetry(options: RetryOptions = {}) {
  const [circuitState, setCircuitState] = useState<'closed' | 'open' | 'half-open'>('closed');
  const [failureCount, setFailureCount] = useState(0);
  const circuitTimeoutRef = useRef<NodeJS.Timeout>();

  const FAILURE_THRESHOLD = 5;
  const CIRCUIT_TIMEOUT = 60000; // 1 minute

  const networkConfig: RetryConfig = {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    jitter: true,
    retryCondition: (error, attempt) => {
      return error.type === 'network' && attempt < 5;
    },
    ...options,
  };

  const retry = useRetryMechanism({
    ...options,
    ...networkConfig,
    onRetryFailed: (error, attempts) => {
      setFailureCount(prev => prev + 1);
      
      if (failureCount >= FAILURE_THRESHOLD) {
        setCircuitState('open');
        
        // Auto-reset circuit after timeout
        circuitTimeoutRef.current = setTimeout(() => {
          setCircuitState('half-open');
          setFailureCount(0);
        }, CIRCUIT_TIMEOUT);
      }
      
      options.onRetryFailed?.(error, attempts);
    },
    onRetrySuccess: (attempt) => {
      setFailureCount(0);
      setCircuitState('closed');
      
      if (circuitTimeoutRef.current) {
        clearTimeout(circuitTimeoutRef.current);
      }
      
      options.onRetrySuccess?.(attempt);
    },
  });

  const executeWithCircuitBreaker = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> => {
    if (circuitState === 'open') {
      throw AdminErrorHandler.parseError(
        new Error('Circuit breaker is open. Network operations are temporarily disabled.'),
        context
      );
    }

    return retry.executeWithRetry(operation, context);
  }, [circuitState, retry]);

  return {
    ...retry,
    executeWithCircuitBreaker,
    circuitState,
    failureCount,
    isCircuitOpen: circuitState === 'open',
  };
}