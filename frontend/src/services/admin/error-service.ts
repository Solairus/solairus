import { PublicKey } from '@solana/web3.js';
import { ServiceError, ErrorContext } from './types';

/**
 * Error Codes for Admin Operations
 */
export enum AdminErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_DURATION = 'INVALID_DURATION',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SPONSOR_NOT_REGISTERED = 'SPONSOR_NOT_REGISTERED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  MATH_OVERFLOW = 'MATH_OVERFLOW',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * User-Friendly Error Information
 */
export interface UserFriendlyError {
  title: string;
  message: string;
  severity: ErrorSeverity;
  canRetry: boolean;
  canRecover: boolean;
  suggestedActions: string[];
  technicalDetails?: string;
}

/**
 * Error Classification
 */
export interface ErrorClassification {
  code: AdminErrorCode;
  severity: ErrorSeverity;
  isRetryable: boolean;
  isRecoverable: boolean;
  requiresUserAction: boolean;
  category: 'validation' | 'authorization' | 'network' | 'contract' | 'system';
}

/**
 * Admin Error Service for handling and formatting errors
 */
export class AdminErrorService {
  private errorMappings: Map<string, ErrorClassification>;
  private userFriendlyMessages: Map<AdminErrorCode, UserFriendlyError>;

  constructor() {
    this.errorMappings = new Map();
    this.userFriendlyMessages = new Map();
    this.initializeErrorMappings();
    this.initializeUserFriendlyMessages();
  }

  /**
   * Create a service error from an unknown error
   */
  createServiceError(
    error: unknown,
    context: ErrorContext,
    code?: AdminErrorCode
  ): ServiceError {
    const errorCode = code || this.classifyError(error);
    const classification = this.getErrorClassification(errorCode);
    
    const serviceError: ServiceError = new Error(this.extractErrorMessage(error));
    serviceError.name = 'ServiceError';
    serviceError.code = errorCode;
    serviceError.context = context;
    serviceError.isRetryable = classification.isRetryable;
    serviceError.originalError = error;

    return serviceError;
  }

  /**
   * Format error for user display
   */
  formatErrorForUser(error: ServiceError | Error | unknown): UserFriendlyError {
    let errorCode: AdminErrorCode;
    
    if (this.isServiceError(error)) {
      errorCode = error.code as AdminErrorCode || AdminErrorCode.UNKNOWN_ERROR;
    } else {
      errorCode = this.classifyError(error);
    }

    const baseError = this.userFriendlyMessages.get(errorCode) || this.getDefaultUserFriendlyError();
    
    // Customize message based on context
    if (this.isServiceError(error) && error.context) {
      return this.customizeErrorMessage(baseError, error.context);
    }

    return baseError;
  }

  /**
   * Classify an unknown error
   */
  classifyError(error: unknown): AdminErrorCode {
    const message = this.extractErrorMessage(error).toLowerCase();

    // Check for specific error patterns
    if (message.includes('unauthorized') || message.includes('access denied')) {
      return AdminErrorCode.UNAUTHORIZED;
    }
    
    if (message.includes('invalid amount') || message.includes('amount must be')) {
      return AdminErrorCode.INVALID_AMOUNT;
    }
    
    if (message.includes('invalid duration') || message.includes('duration')) {
      return AdminErrorCode.INVALID_DURATION;
    }
    
    if (message.includes('invalid address') || message.includes('invalid public key')) {
      return AdminErrorCode.INVALID_ADDRESS;
    }
    
    if (message.includes('user not found') || message.includes('profile not found')) {
      return AdminErrorCode.USER_NOT_FOUND;
    }
    
    if (message.includes('sponsor not registered') || message.includes('sponsornotregistered')) {
      return AdminErrorCode.SPONSOR_NOT_REGISTERED;
    }
    
    if (message.includes('insufficient funds') || message.includes('insufficientfunds')) {
      return AdminErrorCode.INSUFFICIENT_FUNDS;
    }
    
    if (message.includes('math overflow') || message.includes('mathoverflow')) {
      return AdminErrorCode.MATH_OVERFLOW;
    }
    
    if (message.includes('transaction failed') || message.includes('tx failed')) {
      return AdminErrorCode.TRANSACTION_FAILED;
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('rpc')) {
      return AdminErrorCode.NETWORK_ERROR;
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return AdminErrorCode.TIMEOUT;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return AdminErrorCode.VALIDATION_ERROR;
    }

    return AdminErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Get error classification
   */
  getErrorClassification(code: AdminErrorCode): ErrorClassification {
    return this.errorMappings.get(code) || {
      code: AdminErrorCode.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: false,
      isRecoverable: false,
      requiresUserAction: true,
      category: 'system',
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: ServiceError | Error | unknown): boolean {
    if (this.isServiceError(error)) {
      return error.isRetryable || false;
    }
    
    const code = this.classifyError(error);
    const classification = this.getErrorClassification(code);
    return classification.isRetryable;
  }

  /**
   * Get suggested recovery actions
   */
  getSuggestedActions(error: ServiceError | Error | unknown): string[] {
    const userFriendlyError = this.formatErrorForUser(error);
    return userFriendlyError.suggestedActions;
  }

  /**
   * Log error with appropriate level
   */
  logError(error: ServiceError | Error | unknown, context?: ErrorContext): void {
    const errorCode = this.isServiceError(error) 
      ? (error.code as AdminErrorCode) 
      : this.classifyError(error);
    
    const classification = this.getErrorClassification(errorCode);
    const message = this.extractErrorMessage(error);
    
    const logData = {
      code: errorCode,
      message,
      severity: classification.severity,
      context,
      timestamp: new Date().toISOString(),
    };

    switch (classification.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('LOW SEVERITY ERROR:', logData);
        break;
    }
  }

  /**
   * Create validation error
   */
  createValidationError(
    field: string,
    value: unknown,
    expectedFormat: string,
    context: ErrorContext
  ): ServiceError {
    const message = `Invalid ${field}: expected ${expectedFormat}, got ${value}`;
    const error = new Error(message);
    return this.createServiceError(error, context, AdminErrorCode.VALIDATION_ERROR);
  }

  /**
   * Create authorization error
   */
  createAuthorizationError(
    requiredRole: string,
    currentRole: string | null,
    context: ErrorContext
  ): ServiceError {
    const message = `Unauthorized: requires ${requiredRole} role, current role: ${currentRole || 'none'}`;
    const error = new Error(message);
    return this.createServiceError(error, context, AdminErrorCode.UNAUTHORIZED);
  }

  /**
   * Create network error
   */
  createNetworkError(
    operation: string,
    originalError: unknown,
    context: ErrorContext
  ): ServiceError {
    const message = `Network error during ${operation}: ${this.extractErrorMessage(originalError)}`;
    const error = new Error(message);
    return this.createServiceError(error, context, AdminErrorCode.NETWORK_ERROR);
  }

  /**
   * Initialize error mappings
   */
  private initializeErrorMappings(): void {
    const mappings: Array<[AdminErrorCode, ErrorClassification]> = [
      [AdminErrorCode.UNAUTHORIZED, {
        code: AdminErrorCode.UNAUTHORIZED,
        severity: ErrorSeverity.HIGH,
        isRetryable: false,
        isRecoverable: false,
        requiresUserAction: true,
        category: 'authorization',
      }],
      [AdminErrorCode.INVALID_AMOUNT, {
        code: AdminErrorCode.INVALID_AMOUNT,
        severity: ErrorSeverity.LOW,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'validation',
      }],
      [AdminErrorCode.INVALID_DURATION, {
        code: AdminErrorCode.INVALID_DURATION,
        severity: ErrorSeverity.LOW,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'validation',
      }],
      [AdminErrorCode.INVALID_ADDRESS, {
        code: AdminErrorCode.INVALID_ADDRESS,
        severity: ErrorSeverity.LOW,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'validation',
      }],
      [AdminErrorCode.USER_NOT_FOUND, {
        code: AdminErrorCode.USER_NOT_FOUND,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'validation',
      }],
      [AdminErrorCode.SPONSOR_NOT_REGISTERED, {
        code: AdminErrorCode.SPONSOR_NOT_REGISTERED,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'validation',
      }],
      [AdminErrorCode.INSUFFICIENT_FUNDS, {
        code: AdminErrorCode.INSUFFICIENT_FUNDS,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'contract',
      }],
      [AdminErrorCode.MATH_OVERFLOW, {
        code: AdminErrorCode.MATH_OVERFLOW,
        severity: ErrorSeverity.HIGH,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'contract',
      }],
      [AdminErrorCode.TRANSACTION_FAILED, {
        code: AdminErrorCode.TRANSACTION_FAILED,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: true,
        isRecoverable: true,
        requiresUserAction: false,
        category: 'contract',
      }],
      [AdminErrorCode.NETWORK_ERROR, {
        code: AdminErrorCode.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: true,
        isRecoverable: true,
        requiresUserAction: false,
        category: 'network',
      }],
      [AdminErrorCode.TIMEOUT, {
        code: AdminErrorCode.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: true,
        isRecoverable: true,
        requiresUserAction: false,
        category: 'network',
      }],
      [AdminErrorCode.VALIDATION_ERROR, {
        code: AdminErrorCode.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        isRetryable: false,
        isRecoverable: true,
        requiresUserAction: true,
        category: 'validation',
      }],
      [AdminErrorCode.CONFIGURATION_ERROR, {
        code: AdminErrorCode.CONFIGURATION_ERROR,
        severity: ErrorSeverity.HIGH,
        isRetryable: false,
        isRecoverable: false,
        requiresUserAction: true,
        category: 'system',
      }],
      [AdminErrorCode.UNKNOWN_ERROR, {
        code: AdminErrorCode.UNKNOWN_ERROR,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: false,
        isRecoverable: false,
        requiresUserAction: true,
        category: 'system',
      }],
    ];

    mappings.forEach(([code, classification]) => {
      this.errorMappings.set(code, classification);
    });
  }

  /**
   * Initialize user-friendly messages
   */
  private initializeUserFriendlyMessages(): void {
    const messages: Array<[AdminErrorCode, UserFriendlyError]> = [
      [AdminErrorCode.UNAUTHORIZED, {
        title: 'Access Denied',
        message: 'You do not have permission to perform this action. Only admin or dev users can access administrative functions.',
        severity: ErrorSeverity.HIGH,
        canRetry: false,
        canRecover: false,
        suggestedActions: [
          'Ensure you are connected with an authorized wallet',
          'Contact an administrator if you believe this is an error',
          'Check that your wallet address is configured in the system',
        ],
      }],
      [AdminErrorCode.INVALID_AMOUNT, {
        title: 'Invalid Amount',
        message: 'The amount you entered is not valid. Please check your input and try again.',
        severity: ErrorSeverity.LOW,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Enter a positive number greater than 0',
          'Check that the amount is within acceptable limits',
          'Ensure you are using the correct decimal format',
        ],
      }],
      [AdminErrorCode.INVALID_DURATION, {
        title: 'Invalid Duration',
        message: 'The license duration you specified is not valid.',
        severity: ErrorSeverity.LOW,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Enter a duration between 1 and 3650 days',
          'Use whole numbers only',
          'Consider standard durations like 30, 90, or 365 days',
        ],
      }],
      [AdminErrorCode.INVALID_ADDRESS, {
        title: 'Invalid Address',
        message: 'The wallet address you provided is not in the correct format.',
        severity: ErrorSeverity.LOW,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Verify the address is a valid Solana public key',
          'Check for typos in the address',
          'Copy and paste the address to avoid errors',
        ],
      }],
      [AdminErrorCode.USER_NOT_FOUND, {
        title: 'User Not Found',
        message: 'The specified user does not exist in the system.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: false,
        canRecover: true,
        suggestedActions: [
          'Verify the user address is correct',
          'The user may need to register first',
          'Check if the user has completed the onboarding process',
        ],
      }],
      [AdminErrorCode.SPONSOR_NOT_REGISTERED, {
        title: 'Sponsor Not Registered',
        message: 'The sponsor you specified is not registered in the system.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: false,
        canRecover: true,
        suggestedActions: [
          'Verify the sponsor address is correct',
          'Ensure the sponsor has completed registration',
          'Use a different registered sponsor',
        ],
      }],
      [AdminErrorCode.INSUFFICIENT_FUNDS, {
        title: 'Insufficient Funds',
        message: 'There are not enough funds available for this operation.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: false,
        canRecover: true,
        suggestedActions: [
          'Check the available balance',
          'Reduce the amount being withdrawn or debited',
          'Ensure sufficient SOL for transaction fees',
        ],
      }],
      [AdminErrorCode.MATH_OVERFLOW, {
        title: 'Calculation Error',
        message: 'The calculation resulted in a number that is too large to process.',
        severity: ErrorSeverity.HIGH,
        canRetry: false,
        canRecover: true,
        suggestedActions: [
          'Use smaller amounts',
          'Check your input values for reasonableness',
          'Contact support if this persists',
        ],
      }],
      [AdminErrorCode.TRANSACTION_FAILED, {
        title: 'Transaction Failed',
        message: 'The blockchain transaction could not be completed.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Try the transaction again',
          'Check your network connection',
          'Ensure you have sufficient SOL for fees',
        ],
      }],
      [AdminErrorCode.NETWORK_ERROR, {
        title: 'Network Error',
        message: 'There was a problem connecting to the blockchain network.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Switch to a different RPC endpoint if available',
        ],
      }],
      [AdminErrorCode.TIMEOUT, {
        title: 'Request Timeout',
        message: 'The operation took too long to complete and was cancelled.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Try the operation again',
          'Check your network connection',
          'The network may be experiencing high traffic',
        ],
      }],
      [AdminErrorCode.VALIDATION_ERROR, {
        title: 'Validation Error',
        message: 'The information you provided did not pass validation checks.',
        severity: ErrorSeverity.LOW,
        canRetry: true,
        canRecover: true,
        suggestedActions: [
          'Review your input for errors',
          'Ensure all required fields are filled',
          'Check that values are in the correct format',
        ],
      }],
      [AdminErrorCode.CONFIGURATION_ERROR, {
        title: 'Configuration Error',
        message: 'There is a problem with the system configuration.',
        severity: ErrorSeverity.HIGH,
        canRetry: false,
        canRecover: false,
        suggestedActions: [
          'Contact a system administrator',
          'Check environment variables and settings',
          'This may require technical intervention',
        ],
      }],
      [AdminErrorCode.UNKNOWN_ERROR, {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again or contact support.',
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        canRecover: false,
        suggestedActions: [
          'Try the operation again',
          'Contact support if the problem persists',
          'Provide details about what you were trying to do',
        ],
      }],
    ];

    messages.forEach(([code, message]) => {
      this.userFriendlyMessages.set(code, message);
    });
  }

  /**
   * Extract error message from unknown error
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      // Try to extract message from common error object structures
      const errorObj = error as Record<string, unknown>;
      
      if (errorObj.message && typeof errorObj.message === 'string') {
        return errorObj.message;
      }
      
      if (errorObj.error && typeof errorObj.error === 'string') {
        return errorObj.error;
      }
      
      if (errorObj.msg && typeof errorObj.msg === 'string') {
        return errorObj.msg;
      }
    }
    
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  /**
   * Check if error is a ServiceError
   */
  private isServiceError(error: unknown): error is ServiceError {
    return error instanceof Error && 'code' in error && 'context' in error;
  }

  /**
   * Get default user-friendly error
   */
  private getDefaultUserFriendlyError(): UserFriendlyError {
    return {
      title: 'Error',
      message: 'An error occurred while processing your request.',
      severity: ErrorSeverity.MEDIUM,
      canRetry: true,
      canRecover: false,
      suggestedActions: [
        'Try the operation again',
        'Contact support if the problem persists',
      ],
    };
  }

  /**
   * Customize error message based on context
   */
  private customizeErrorMessage(
    baseError: UserFriendlyError,
    context: ErrorContext
  ): UserFriendlyError {
    const customized = { ...baseError };
    
    // Add context-specific information
    if (context.userPubkey) {
      customized.technicalDetails = `User: ${context.userPubkey}`;
    }
    
    if (context.operation) {
      customized.message = `${customized.message} (Operation: ${context.operation})`;
    }
    
    if (context.attemptCount > 1) {
      customized.message += ` This was attempt ${context.attemptCount}.`;
    }
    
    return customized;
  }
}

/**
 * Create error service instance
 */
export function createAdminErrorService(): AdminErrorService {
  return new AdminErrorService();
}

/**
 * Global error service instance
 */
export const adminErrorService = createAdminErrorService();