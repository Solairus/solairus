/**
 * License Error Handler
 * 
 * Purpose: Centralized error handling for license operations with cost-conscious design
 * 
 * Key Features:
 * - Specific error message parsing and categorization
 * - User-friendly error messages with actionable guidance
 * - Manual retry suggestions (NO automatic retries to protect user funds)
 * - Special handling for common Solana/Anchor errors
 * 
 * Cost Protection:
 * - All retries are manual/user-controlled to prevent unexpected gas costs
 * - Clear guidance on when retries are appropriate vs when user action is needed
 * - Specific handling for seeds constraint violations (Error 2006)
 * 
 * Error Categories:
 * - network: Connection/RPC issues (retryable)
 * - contract: Smart contract errors including PDA issues (retryable)
 * - user_rejected: User cancelled transaction (retryable)
 * - insufficient_funds: Not enough tokens (requires user action)
 * - unknown: Unexpected errors (retryable with caution)
 */

export interface LicenseError {
  type: 'network' | 'insufficient_funds' | 'user_rejected' | 'contract' | 'unknown';
  message: string;
  originalError: unknown;
  isRetryable: boolean;
  suggestedAction?: string;
}

export class LicenseErrorHandler {
  /**
   * Parse and categorize license-related errors
   */
  static parseError(error: unknown): LicenseError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Network errors
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('connection') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection error. Please check your internet connection and try again.',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Check your internet connection and retry',
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
        isRetryable: true,
        suggestedAction: 'Wait 30 seconds and retry',
      };
    }

    // Insufficient funds
    if (lowerMessage.includes('insufficient') ||
        lowerMessage.includes('not enough') ||
        lowerMessage.includes('balance')) {
      return {
        type: 'insufficient_funds',
        message: 'Insufficient USDT balance to activate license.',
        originalError: error,
        isRetryable: false,
        suggestedAction: 'Add more USDT to your wallet',
      };
    }

    // User rejection
    if (lowerMessage.includes('user rejected') ||
        lowerMessage.includes('user denied') ||
        lowerMessage.includes('cancelled') ||
        lowerMessage.includes('rejected by user')) {
      return {
        type: 'user_rejected',
        message: 'Transaction was cancelled by user.',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Try again and approve the transaction',
      };
    }

    // Seeds constraint violation (Anchor Error Code 2006)
    // 
    // This error occurs when the provided PDA doesn't match what the smart contract expects.
    // Common causes:
    // 1. User profile not found or corrupted
    // 2. Wallet connection issues causing stale data
    // 3. Incorrect account derivation
    // 
    // Fix: The simplified affiliate system should reduce PDA-related errors.
    if (lowerMessage.includes('constraintseeds') ||
        lowerMessage.includes('seeds constraint') ||
        lowerMessage.includes('error number: 2006')) {
      return {
        type: 'contract',
        message: 'Account verification failed. Please ensure your wallet is connected and try again.',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Check wallet connection and retry',
      };
    }

    // Smart contract errors
    if (lowerMessage.includes('program') ||
        lowerMessage.includes('instruction') ||
        lowerMessage.includes('account') ||
        lowerMessage.includes('anchor')) {
      return {
        type: 'contract',
        message: 'Smart contract error. This may be a temporary issue.',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Try again in a few moments',
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: errorMessage || 'An unexpected error occurred.',
      originalError: error,
      isRetryable: true,
      suggestedAction: 'Try again or contact support if the issue persists',
    };
  }

  /**
   * Get user-friendly error message with context
   */
  static getDisplayMessage(error: LicenseError, context?: string): string {
    const contextPrefix = context ? `${context}: ` : '';
    return `${contextPrefix}${error.message}`;
  }

  /**
   * Determine if error is retryable (for manual retry only)
   */
  static isManuallyRetryable(error: LicenseError): boolean {
    return error.isRetryable && error.type !== 'insufficient_funds';
  }

  /**
   * Get suggested retry action for user
   */
  static getRetryGuidance(error: LicenseError): string {
    switch (error.type) {
      case 'network':
        return 'Check your internet connection and try again';
      case 'contract':
        return 'This may be a temporary issue. Try again in a few moments';
      case 'user_rejected':
        return 'Try again and approve the transaction in your wallet';
      case 'insufficient_funds':
        return 'Add more USDT to your wallet before trying again';
      default:
        return 'Try again or contact support if the issue persists';
    }
  }
}

/**
 * Hook for handling license errors in components
 */
export function useLicenseErrorHandler() {
  const handleError = (error: unknown, context?: string): LicenseError => {
    const licenseError = LicenseErrorHandler.parseError(error);
    console.error(`License error (${context || 'unknown'}):`, licenseError);
    return licenseError;
  };

  const getErrorMessage = (error: unknown, context?: string): string => {
    const licenseError = LicenseErrorHandler.parseError(error);
    return LicenseErrorHandler.getDisplayMessage(licenseError, context);
  };

  const isRetryable = (error: unknown): boolean => {
    const licenseError = LicenseErrorHandler.parseError(error);
    return LicenseErrorHandler.isManuallyRetryable(licenseError);
  };

  const getRetryGuidance = (error: unknown): string => {
    const licenseError = LicenseErrorHandler.parseError(error);
    return LicenseErrorHandler.getRetryGuidance(licenseError);
  };

  return {
    handleError,
    getErrorMessage,
    isRetryable,
    getRetryGuidance,
    parseError: LicenseErrorHandler.parseError,
  };
}