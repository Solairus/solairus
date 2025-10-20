/**
 * Enhanced Profile Error Types and Messages
 * 
 * Comprehensive error classification system for profile account operations
 * with detailed technical information and user-friendly messages.
 * 
 * Requirements: 2.1, 2.2, 2.5
 */

import { PublicKey } from "@solana/web3.js";

/**
 * Base interface for all profile-related errors
 */
export interface ProfileError {
  type: ProfileErrorType;
  code: string;
  message: string;
  userMessage: string;
  technicalDetails: ProfileErrorTechnicalDetails;
  isRecoverable: boolean;
  retryable: boolean;
  severity: ErrorSeverity;
  timestamp: number;
  context?: ProfileErrorContext;
}

/**
 * Profile error types covering all possible failure scenarios
 */
export type ProfileErrorType = 
  | 'account_not_found'
  | 'deserialization_failed'
  | 'size_mismatch'
  | 'data_corruption'
  | 'owner_mismatch'
  | 'invalid_structure'
  | 'pda_derivation_failed'
  | 'network_error'
  | 'insufficient_funds'
  | 'program_error'
  | 'validation_failed'
  | 'recovery_failed'
  | 'timeout_error'
  | 'unknown_error';

/**
 * Error severity levels for prioritization and handling
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Technical details for debugging and diagnostics
 */
export interface ProfileErrorTechnicalDetails {
  accountAddress?: string;
  expectedStructure?: string;
  actualData?: string;
  suggestedFix: string;
  errorCode?: string;
  stackTrace?: string;
  programId?: string;
  transactionSignature?: string;
  blockHeight?: number;
  slot?: number;
  rpcEndpoint?: string;
}

/**
 * Additional context for error tracking and analysis
 */
export interface ProfileErrorContext {
  userPubkey?: string;
  sponsor?: string;
  operation: string;
  attemptCount: number;
  lastSuccessfulOperation?: string;
  environment: 'development' | 'staging' | 'production';
  clientVersion?: string;
  walletType?: string;
}

/**
 * Error classification for different failure types
 */
export interface ProfileErrorClassification {
  category: 'account' | 'network' | 'program' | 'validation' | 'system';
  subcategory: string;
  isTransient: boolean;
  requiresUserAction: boolean;
  canAutoRecover: boolean;
  estimatedRecoveryTime?: number;
}

/**
 * Suggested actions for error resolution
 */
export interface ProfileErrorAction {
  primary: string;
  secondary?: string[];
  preventive?: string[];
  escalation?: string;
}

/**
 * Complete error information with classification and actions
 */
export interface EnhancedProfileError extends ProfileError {
  classification: ProfileErrorClassification;
  suggestedActions: ProfileErrorAction;
  relatedErrors?: ProfileErrorType[];
  documentationUrl?: string;
}

/**
 * Error factory class for creating standardized profile errors
 */
export class ProfileErrorFactory {
  private static readonly ERROR_DEFINITIONS: Record<ProfileErrorType, {
    code: string;
    message: string;
    userMessage: string;
    severity: ErrorSeverity;
    isRecoverable: boolean;
    retryable: boolean;
    classification: ProfileErrorClassification;
    suggestedActions: ProfileErrorAction;
  }> = {
    account_not_found: {
      code: 'PROFILE_001',
      message: 'User profile account does not exist on the blockchain',
      userMessage: 'Your profile needs to be created. This is normal for new users.',
      severity: 'low',
      isRecoverable: true,
      retryable: false,
      classification: {
        category: 'account',
        subcategory: 'missing',
        isTransient: false,
        requiresUserAction: true,
        canAutoRecover: true,
        estimatedRecoveryTime: 30,
      },
      suggestedActions: {
        primary: 'Complete user registration to create profile account',
        secondary: ['Verify wallet connection', 'Check network connectivity'],
        preventive: ['Ensure registration process completes successfully'],
        escalation: 'Contact support if registration repeatedly fails',
      },
    },
    deserialization_failed: {
      code: 'PROFILE_002',
      message: 'Profile account data cannot be deserialized due to structure mismatch',
      userMessage: 'Your profile data is incompatible and needs to be updated.',
      severity: 'high',
      isRecoverable: true,
      retryable: false,
      classification: {
        category: 'account',
        subcategory: 'corruption',
        isTransient: false,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 60,
      },
      suggestedActions: {
        primary: 'Attempt automatic account recovery or recreation',
        secondary: ['Clear browser cache', 'Reconnect wallet'],
        preventive: ['Keep application updated', 'Avoid interrupting transactions'],
        escalation: 'Contact support if recovery fails multiple times',
      },
    },
    size_mismatch: {
      code: 'PROFILE_003',
      message: 'Profile account has incorrect size allocation',
      userMessage: 'Your profile needs to be updated for the latest version.',
      severity: 'high',
      isRecoverable: true,
      retryable: false,
      classification: {
        category: 'account',
        subcategory: 'structure',
        isTransient: false,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 90,
      },
      suggestedActions: {
        primary: 'Close existing account and recreate with correct size',
        secondary: ['Update application to latest version'],
        preventive: ['Keep application updated', 'Complete migrations when prompted'],
        escalation: 'Contact support for manual account migration',
      },
    },
    data_corruption: {
      code: 'PROFILE_004',
      message: 'Profile account data is corrupted or contains invalid values',
      userMessage: 'Your profile data is corrupted and needs to be restored.',
      severity: 'critical',
      isRecoverable: true,
      retryable: false,
      classification: {
        category: 'account',
        subcategory: 'corruption',
        isTransient: false,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 120,
      },
      suggestedActions: {
        primary: 'Attempt data migration or recreate profile account',
        secondary: ['Verify transaction history', 'Check for partial transactions'],
        preventive: ['Avoid interrupting transactions', 'Use stable network connection'],
        escalation: 'Contact support for data recovery assistance',
      },
    },
    owner_mismatch: {
      code: 'PROFILE_005',
      message: 'Profile account has incorrect program ownership',
      userMessage: 'Account ownership issue detected. Please contact support.',
      severity: 'critical',
      isRecoverable: false,
      retryable: false,
      classification: {
        category: 'account',
        subcategory: 'ownership',
        isTransient: false,
        requiresUserAction: true,
        canAutoRecover: false,
      },
      suggestedActions: {
        primary: 'Contact support for manual account ownership verification',
        secondary: ['Verify wallet ownership', 'Check transaction history'],
        preventive: ['Only use official application', 'Verify program addresses'],
        escalation: 'Immediate support escalation required',
      },
    },
    invalid_structure: {
      code: 'PROFILE_006',
      message: 'Profile account structure does not match expected format',
      userMessage: 'Your profile needs to be updated for compatibility.',
      severity: 'medium',
      isRecoverable: true,
      retryable: false,
      classification: {
        category: 'account',
        subcategory: 'structure',
        isTransient: false,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 45,
      },
      suggestedActions: {
        primary: 'Migrate account data to new structure format',
        secondary: ['Update application', 'Clear application cache'],
        preventive: ['Keep application updated', 'Complete migrations promptly'],
        escalation: 'Contact support if migration fails',
      },
    },
    pda_derivation_failed: {
      code: 'PROFILE_007',
      message: 'Failed to derive Program Derived Address for profile account',
      userMessage: 'Unable to generate your profile address. Please try again.',
      severity: 'medium',
      isRecoverable: true,
      retryable: true,
      classification: {
        category: 'system',
        subcategory: 'derivation',
        isTransient: true,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 5,
      },
      suggestedActions: {
        primary: 'Retry PDA derivation with correct parameters',
        secondary: ['Verify wallet connection', 'Check program configuration'],
        preventive: ['Ensure stable wallet connection'],
        escalation: 'Contact support if derivation consistently fails',
      },
    },
    network_error: {
      code: 'PROFILE_008',
      message: 'Network connectivity issue preventing profile operations',
      userMessage: 'Network connection issue. Please check your internet and try again.',
      severity: 'medium',
      isRecoverable: true,
      retryable: true,
      classification: {
        category: 'network',
        subcategory: 'connectivity',
        isTransient: true,
        requiresUserAction: true,
        canAutoRecover: false,
        estimatedRecoveryTime: 10,
      },
      suggestedActions: {
        primary: 'Check internet connection and retry operation',
        secondary: ['Switch to different RPC endpoint', 'Wait for network stability'],
        preventive: ['Use stable internet connection', 'Monitor network status'],
        escalation: 'Contact support if network issues persist',
      },
    },
    insufficient_funds: {
      code: 'PROFILE_009',
      message: 'Insufficient funds to complete profile account operation',
      userMessage: 'You need more SOL to complete this operation.',
      severity: 'medium',
      isRecoverable: true,
      retryable: true,
      classification: {
        category: 'account',
        subcategory: 'funding',
        isTransient: true,
        requiresUserAction: true,
        canAutoRecover: false,
        estimatedRecoveryTime: 300,
      },
      suggestedActions: {
        primary: 'Add SOL to your wallet and retry the operation',
        secondary: ['Check current SOL balance', 'Estimate transaction costs'],
        preventive: ['Maintain sufficient SOL balance', 'Monitor transaction fees'],
        escalation: 'Contact support for funding assistance if needed',
      },
    },
    program_error: {
      code: 'PROFILE_010',
      message: 'Smart contract program error during profile operation',
      userMessage: 'A program error occurred. Please try again or contact support.',
      severity: 'high',
      isRecoverable: true,
      retryable: true,
      classification: {
        category: 'program',
        subcategory: 'execution',
        isTransient: true,
        requiresUserAction: false,
        canAutoRecover: false,
        estimatedRecoveryTime: 30,
      },
      suggestedActions: {
        primary: 'Retry operation after brief delay',
        secondary: ['Check program status', 'Verify transaction parameters'],
        preventive: ['Use recommended transaction parameters', 'Monitor program updates'],
        escalation: 'Contact support with transaction details',
      },
    },
    validation_failed: {
      code: 'PROFILE_011',
      message: 'Profile account validation failed due to invalid data or structure',
      userMessage: 'Profile validation failed. Your account may need to be updated.',
      severity: 'medium',
      isRecoverable: true,
      retryable: false,
      classification: {
        category: 'validation',
        subcategory: 'integrity',
        isTransient: false,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 60,
      },
      suggestedActions: {
        primary: 'Attempt account validation and recovery',
        secondary: ['Update application', 'Clear cached data'],
        preventive: ['Keep application updated', 'Complete operations fully'],
        escalation: 'Contact support if validation consistently fails',
      },
    },
    recovery_failed: {
      code: 'PROFILE_012',
      message: 'Account recovery operation failed after multiple attempts',
      userMessage: 'Unable to recover your profile automatically. Support assistance needed.',
      severity: 'critical',
      isRecoverable: false,
      retryable: false,
      classification: {
        category: 'system',
        subcategory: 'recovery',
        isTransient: false,
        requiresUserAction: true,
        canAutoRecover: false,
      },
      suggestedActions: {
        primary: 'Contact support for manual account recovery',
        secondary: ['Provide transaction history', 'Document error details'],
        preventive: ['Backup important account information', 'Monitor account health'],
        escalation: 'Immediate support escalation with full error context',
      },
    },
    timeout_error: {
      code: 'PROFILE_013',
      message: 'Operation timed out while waiting for blockchain confirmation',
      userMessage: 'Operation timed out. Please check the transaction status and try again.',
      severity: 'medium',
      isRecoverable: true,
      retryable: true,
      classification: {
        category: 'network',
        subcategory: 'timeout',
        isTransient: true,
        requiresUserAction: false,
        canAutoRecover: true,
        estimatedRecoveryTime: 60,
      },
      suggestedActions: {
        primary: 'Check transaction status and retry if needed',
        secondary: ['Wait for network congestion to clear', 'Use higher priority fees'],
        preventive: ['Monitor network congestion', 'Use appropriate timeout values'],
        escalation: 'Contact support if timeouts persist',
      },
    },
    unknown_error: {
      code: 'PROFILE_999',
      message: 'An unknown error occurred during profile operation',
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      severity: 'medium',
      isRecoverable: true,
      retryable: true,
      classification: {
        category: 'system',
        subcategory: 'unknown',
        isTransient: true,
        requiresUserAction: false,
        canAutoRecover: false,
        estimatedRecoveryTime: 30,
      },
      suggestedActions: {
        primary: 'Retry operation and contact support if issue persists',
        secondary: ['Clear application cache', 'Restart application'],
        preventive: ['Keep application updated', 'Report unknown errors'],
        escalation: 'Contact support with full error details and reproduction steps',
      },
    },
  };

  /**
   * Create a standardized profile error
   */
  static createError(
    type: ProfileErrorType,
    technicalDetails: Partial<ProfileErrorTechnicalDetails> = {},
    context?: Partial<ProfileErrorContext>
  ): EnhancedProfileError {
    const definition = this.ERROR_DEFINITIONS[type];
    
    if (!definition) {
      throw new Error(`Unknown profile error type: ${type}`);
    }

    const baseError: ProfileError = {
      type,
      code: definition.code,
      message: definition.message,
      userMessage: definition.userMessage,
      technicalDetails: {
        suggestedFix: definition.suggestedActions.primary,
        ...technicalDetails,
      },
      isRecoverable: definition.isRecoverable,
      retryable: definition.retryable,
      severity: definition.severity,
      timestamp: Date.now(),
      context: context ? {
        operation: 'unknown',
        attemptCount: 1,
        environment: 'production',
        ...context,
      } : undefined,
    };

    return {
      ...baseError,
      classification: definition.classification,
      suggestedActions: definition.suggestedActions,
      relatedErrors: this.getRelatedErrors(type),
      documentationUrl: this.getDocumentationUrl(type),
    };
  }

  /**
   * Create error from caught exception
   */
  static fromException(
    error: unknown,
    context?: Partial<ProfileErrorContext>,
    fallbackType: ProfileErrorType = 'unknown_error'
  ): EnhancedProfileError {
    const errorMessage = this.getErrorMessage(error);
    
    // Try to classify the error based on message content
    const classifiedType = this.classifyErrorMessage(errorMessage);
    const errorType = classifiedType || fallbackType;
    
    const technicalDetails: Partial<ProfileErrorTechnicalDetails> = {
      stackTrace: error instanceof Error ? error.stack : undefined,
      errorCode: this.extractErrorCode(errorMessage),
    };

    return this.createError(errorType, technicalDetails, context);
  }

  /**
   * Create error with account context
   */
  static createAccountError(
    type: ProfileErrorType,
    accountAddress: string,
    userPubkey?: PublicKey,
    additionalDetails: Partial<ProfileErrorTechnicalDetails> = {}
  ): EnhancedProfileError {
    const technicalDetails: Partial<ProfileErrorTechnicalDetails> = {
      accountAddress,
      ...additionalDetails,
    };

    const context: Partial<ProfileErrorContext> = {
      userPubkey: userPubkey?.toString(),
      operation: 'account_operation',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    return this.createError(type, technicalDetails, context);
  }

  /**
   * Create error with transaction context
   */
  static createTransactionError(
    type: ProfileErrorType,
    transactionSignature: string,
    blockHeight?: number,
    slot?: number
  ): EnhancedProfileError {
    const technicalDetails: Partial<ProfileErrorTechnicalDetails> = {
      transactionSignature,
      blockHeight,
      slot,
    };

    const context: Partial<ProfileErrorContext> = {
      operation: 'transaction',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    return this.createError(type, technicalDetails, context);
  }

  /**
   * Get related error types that might occur together
   */
  private static getRelatedErrors(type: ProfileErrorType): ProfileErrorType[] {
    const relations: Record<ProfileErrorType, ProfileErrorType[]> = {
      account_not_found: ['pda_derivation_failed', 'network_error'],
      deserialization_failed: ['size_mismatch', 'data_corruption', 'invalid_structure'],
      size_mismatch: ['deserialization_failed', 'invalid_structure'],
      data_corruption: ['deserialization_failed', 'recovery_failed'],
      owner_mismatch: ['program_error'],
      invalid_structure: ['deserialization_failed', 'size_mismatch'],
      pda_derivation_failed: ['account_not_found', 'program_error'],
      network_error: ['timeout_error', 'program_error'],
      insufficient_funds: ['program_error'],
      program_error: ['network_error', 'timeout_error'],
      validation_failed: ['invalid_structure', 'data_corruption'],
      recovery_failed: ['data_corruption', 'owner_mismatch'],
      timeout_error: ['network_error'],
      unknown_error: [],
    };

    return relations[type] || [];
  }

  /**
   * Get documentation URL for error type
   */
  private static getDocumentationUrl(type: ProfileErrorType): string {
    const baseUrl = 'https://docs.solairus.com/troubleshooting';
    return `${baseUrl}/${type.replace(/_/g, '-')}`;
  }

  /**
   * Classify error message to determine error type
   */
  private static classifyErrorMessage(message: string): ProfileErrorType | null {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('account not found') || lowerMessage.includes('account does not exist')) {
      return 'account_not_found';
    }
    
    if (lowerMessage.includes('deserialize') || lowerMessage.includes('deserialization')) {
      return 'deserialization_failed';
    }
    
    if (lowerMessage.includes('size') && lowerMessage.includes('mismatch')) {
      return 'size_mismatch';
    }
    
    if (lowerMessage.includes('owner') && lowerMessage.includes('mismatch')) {
      return 'owner_mismatch';
    }
    
    if (lowerMessage.includes('insufficient') && lowerMessage.includes('funds')) {
      return 'insufficient_funds';
    }
    
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout_error';
    }
    
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return 'network_error';
    }
    
    if (lowerMessage.includes('program error') || lowerMessage.includes('instruction error')) {
      return 'program_error';
    }
    
    return null;
  }

  /**
   * Extract error code from error message
   */
  private static extractErrorCode(message: string): string | undefined {
    const codeMatch = message.match(/error code:?\s*(\w+)/i);
    return codeMatch ? codeMatch[1] : undefined;
  }

  /**
   * Get error message from unknown error type
   */
  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    
    return 'Unknown error occurred';
  }

  /**
   * Get current environment
   */
  private static getEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
      if (hostname && (hostname.includes('staging') || hostname.includes('dev'))) {
        return 'staging';
      }
    }
    return 'production';
  }
}

/**
 * Error message formatter for user-facing messages
 */
export class ProfileErrorFormatter {
  /**
   * Format error for user display
   */
  static formatForUser(error: EnhancedProfileError): {
    title: string;
    message: string;
    actions: string[];
    severity: ErrorSeverity;
  } {
    return {
      title: this.getErrorTitle(error.type),
      message: error.userMessage,
      actions: [
        error.suggestedActions.primary,
        ...(error.suggestedActions.secondary || []),
      ],
      severity: error.severity,
    };
  }

  /**
   * Format error for technical logging
   */
  static formatForLogging(error: EnhancedProfileError): {
    level: string;
    message: string;
    details: Record<string, unknown>;
  } {
    return {
      level: this.getSeverityLevel(error.severity),
      message: `${error.code}: ${error.message}`,
      details: {
        type: error.type,
        code: error.code,
        accountAddress: error.technicalDetails.accountAddress,
        context: error.context,
        classification: error.classification,
        timestamp: error.timestamp,
        isRecoverable: error.isRecoverable,
        retryable: error.retryable,
      },
    };
  }

  /**
   * Get user-friendly error title
   */
  private static getErrorTitle(type: ProfileErrorType): string {
    const titles: Record<ProfileErrorType, string> = {
      account_not_found: 'Profile Not Found',
      deserialization_failed: 'Profile Data Error',
      size_mismatch: 'Profile Update Required',
      data_corruption: 'Profile Corrupted',
      owner_mismatch: 'Account Ownership Issue',
      invalid_structure: 'Profile Compatibility Issue',
      pda_derivation_failed: 'Address Generation Error',
      network_error: 'Network Connection Issue',
      insufficient_funds: 'Insufficient Balance',
      program_error: 'Smart Contract Error',
      validation_failed: 'Profile Validation Error',
      recovery_failed: 'Recovery Failed',
      timeout_error: 'Operation Timeout',
      unknown_error: 'Unexpected Error',
    };

    return titles[type] || 'Profile Error';
  }

  /**
   * Convert severity to logging level
   */
  private static getSeverityLevel(severity: ErrorSeverity): string {
    const levels: Record<ErrorSeverity, string> = {
      low: 'info',
      medium: 'warn',
      high: 'error',
      critical: 'error',
    };

    return levels[severity] || 'warn';
  }
}

/**
 * Utility functions for error handling
 */
export const ProfileErrorUtils = {
  /**
   * Check if error is retryable
   */
  isRetryable: (error: ProfileError): boolean => error.retryable,

  /**
   * Check if error is recoverable
   */
  isRecoverable: (error: ProfileError): boolean => error.isRecoverable,

  /**
   * Get retry delay based on error type and attempt count
   */
  getRetryDelay: (error: ProfileError, attemptCount: number): number => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay;
    
    return delay + jitter;
  },

  /**
   * Check if error requires immediate user attention
   */
  requiresUserAttention: (error: EnhancedProfileError): boolean => {
    return error.classification.requiresUserAction || 
           error.severity === 'critical' ||
           !error.isRecoverable;
  },

  /**
   * Get error priority for handling queue
   */
  getErrorPriority: (error: EnhancedProfileError): number => {
    const severityPriority = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    let priority = severityPriority[error.severity];
    
    // Boost priority for non-recoverable errors
    if (!error.isRecoverable) {
      priority += 2;
    }
    
    // Boost priority for user-action-required errors
    if (error.classification.requiresUserAction) {
      priority += 1;
    }
    
    return priority;
  },
};