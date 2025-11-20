/**
 * Admin Error Handler
 * 
 * Purpose: Centralized error handling for admin operations with comprehensive error parsing
 * 
 * Key Features:
 * - Contract error parsing with specific error codes
 * - User-friendly error messages for admin operations
 * - Transaction status tracking and retry mechanisms
 * - Loading states and progress indicators
 * - Specific handling for admin-related errors
 * 
 * Error Categories:
 * - network: Connection/RPC issues
 * - contract: Smart contract errors including authorization
 * - validation: Input validation errors
 * - transaction: Transaction-specific errors
 * - authorization: Permission/role-based errors
 * - unknown: Unexpected errors
 */

import { toast } from 'sonner';

export interface AdminError {
  type: 'network' | 'contract' | 'validation' | 'transaction' | 'authorization' | 'unknown';
  code?: string | number;
  message: string;
  originalError: unknown;
  suggestedAction?: string;
  context?: string;
}

export interface TransactionStatus {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  signature?: string;
  error?: AdminError;
  progress?: number;
  message?: string;
}

export class AdminErrorHandler {
  /**
   * Parse and categorize admin-related errors
   */
  static parseError(error: unknown, context?: string): AdminError {
    const errorMessage = error instanceof Error ? error.message : String(error);
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
      };
    }

    // RPC rate limiting
    if (lowerMessage.includes('429') || 
        lowerMessage.includes('rate limit') ||
        lowerMessage.includes('too many requests')) {
      return {
        type: 'network',
        message: 'Network is busy. Please wait a moment and try again.',
        originalError: error,
        suggestedAction: 'Wait 30 seconds and retry',
        context,
      };
    }

    // Authorization errors (Anchor Error Code 6000)
    if (errorCode === 6000 || 
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('access denied') ||
        lowerMessage.includes('permission')) {
      return {
        type: 'authorization',
        code: errorCode,
        message: 'You do not have permission to perform this action.',
        originalError: error,
        suggestedAction: 'Ensure you are connected with an authorized admin wallet',
        context,
      };
    }

    // Invalid percentage errors (Anchor Error Code 6001)
    if (errorCode === 6001 || lowerMessage.includes('invalid percent')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Invalid percentage value. Must be between 0 and 100.',
        originalError: error,
        suggestedAction: 'Check your percentage values and try again',
        context,
      };
    }

    // Invalid config sum errors (Anchor Error Code 6002)
    if (errorCode === 6002 || lowerMessage.includes('invalid config sum')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Configuration percentages must sum to 100%.',
        originalError: error,
        suggestedAction: 'Adjust percentages so they total 100%',
        context,
      };
    }

    // Math overflow errors (Anchor Error Code 6003)
    if (errorCode === 6003 || lowerMessage.includes('math overflow')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Calculation overflow. The value is too large.',
        originalError: error,
        suggestedAction: 'Use a smaller value',
        context,
      };
    }

    // Invalid amount errors (Anchor Error Code 6004)
    if (errorCode === 6004 || lowerMessage.includes('invalid amount')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Invalid amount. Must be greater than zero.',
        originalError: error,
        suggestedAction: 'Enter a valid positive amount',
        context,
      };
    }

    // Insufficient funds
    if (lowerMessage.includes('insufficient') ||
        lowerMessage.includes('not enough') ||
        lowerMessage.includes('balance')) {
      return {
        type: 'validation',
        code: errorCode,
        message: 'Insufficient balance for this operation.',
        originalError: error,
        suggestedAction: 'Check the available balance and try a smaller amount',
        context,
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
      };
    }

    // Seeds constraint violation (Anchor Error Code 2006)
    if (lowerMessage.includes('constraintseeds') ||
        lowerMessage.includes('seeds constraint') ||
        lowerMessage.includes('error number: 2006')) {
      return {
        type: 'contract',
        code: 2006,
        message: 'Account verification failed. Please ensure your wallet is connected.',
        originalError: error,
        suggestedAction: 'Check wallet connection and retry',
        context,
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
        message: 'Smart contract error. Please check your inputs and try again.',
        originalError: error,
        suggestedAction: 'Check your inputs and try again',
        context,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: errorMessage || 'An unexpected error occurred.',
      originalError: error,
      suggestedAction: 'Try again or contact support if the issue persists',
      context,
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
  static getDisplayMessage(error: AdminError): string {
    const contextPrefix = error.context ? `${error.context}: ` : '';
    return `${contextPrefix}${error.message}`;
  }



  /**
   * Get suggested retry action for user
   */
  static getRetryGuidance(error: AdminError): string {
    return error.suggestedAction || 'Try again or contact support if the issue persists';
  }

  /**
   * Show error toast with appropriate styling and actions
   */
  static showErrorToast(error: AdminError, options?: { 
    showRetry?: boolean; 
    onRetry?: () => void;
    duration?: number;
  }) {
    const message = this.getDisplayMessage(error);
    const description = error.suggestedAction;

    toast.error(message, {
      description,
      duration: options?.duration || 5000,
      // No actions for backend-only admin operations
    });
  }

  /**
   * Show success toast for admin operations
   */
  static showSuccessToast(message: string, options?: {
    description?: string;
    duration?: number;
  }) {
    toast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
    });
  }
}

/**
 * Hook for handling admin errors in components
 */
export function useAdminErrorHandler() {
  const handleError = (error: unknown, context?: string): AdminError => {
    const adminError = AdminErrorHandler.parseError(error, context);
    console.error(`Admin error (${context || 'unknown'}):`, adminError);
    return adminError;
  };

  const showError = (error: unknown, context?: string, options?: {
    showRetry?: boolean;
    onRetry?: () => void;
    duration?: number;
  }) => {
    const adminError = handleError(error, context);
    AdminErrorHandler.showErrorToast(adminError, options);
    return adminError;
  };

  const showSuccess = (message: string, options?: {
    description?: string;
    duration?: number;
  }) => {
    AdminErrorHandler.showSuccessToast(message, options);
  };

  const getErrorMessage = (error: unknown, context?: string): string => {
    const adminError = AdminErrorHandler.parseError(error, context);
    return AdminErrorHandler.getDisplayMessage(adminError);
  };



  const getRetryGuidance = (error: unknown): string => {
    const adminError = AdminErrorHandler.parseError(error);
    return AdminErrorHandler.getRetryGuidance(adminError);
  };

  return {
    handleError,
    showError,
    showSuccess,
    getErrorMessage,
    getRetryGuidance,
    parseError: AdminErrorHandler.parseError,
  };
}