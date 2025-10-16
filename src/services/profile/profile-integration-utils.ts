/**
 * Profile Integration Utilities
 * 
 * Integration utilities for enhanced error handling and diagnostics
 * with existing license and profile services.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { 
  ProfileAccountValidator,
  AccountRecoveryService,
  ProfileDiagnosticsService,
  ProfileErrorFactory,
  ProfileErrorFormatter,
  EnhancedProfileError,
  ProfileErrorContext,
  ProfileErrorType,
  ValidationResult,
  ProfileDiagnosticInfo,
  AccountStateInspection,
  PdaDerivationDiagnostic,
  OperationTrace,
  ProfileLogEntry,
  createProfileAccountValidator,
  createAccountRecoveryService,
  createProfileDiagnosticsService,
  initializeGlobalDiagnostics,
  getGlobalDiagnostics,
} from "./index";

/**
 * Enhanced profile service manager with integrated error handling and diagnostics
 */
export class EnhancedProfileServiceManager {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private validator: ProfileAccountValidator;
  private recovery: AccountRecoveryService;
  private diagnostics: ProfileDiagnosticsService;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
    
    // Initialize services
    this.validator = createProfileAccountValidator(program, provider);
    this.recovery = createAccountRecoveryService(program, provider, this.validator);
    this.diagnostics = createProfileDiagnosticsService(program, provider);
    
    // Initialize global diagnostics
    initializeGlobalDiagnostics(program, provider);
  }

  /**
   * Comprehensive profile validation with enhanced error handling
   */
  async validateProfile(userPubkey: PublicKey): Promise<{
    isValid: boolean;
    error?: EnhancedProfileError;
    diagnosticInfo?: ProfileDiagnosticInfo;
    canRecover: boolean;
    suggestedAction: string;
  }> {
    const context: ProfileErrorContext = {
      userPubkey: userPubkey.toString(),
      operation: 'profile_validation',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    const operationId = `validate_${userPubkey.toString()}_${Date.now()}`;
    const trace = this.diagnostics.startTrace(operationId, 'validateProfile', context);

    try {
      this.diagnostics.addTraceStep(operationId, 'pda_derivation', 'Derive profile PDA');
      
      // Step 1: Derive PDA
      const pdaResult = this.validator.validatePdaDerivation(userPubkey);
      if (!(await pdaResult).isValid) {
        const error = ProfileErrorFactory.createError('pda_derivation_failed', {
          accountAddress: userPubkey.toString(),
          suggestedFix: 'Check PDA derivation parameters and program ID',
        }, context);

        this.diagnostics.completeTraceStep(operationId, 'pda_derivation', 'failure', undefined, error.message);
        this.diagnostics.completeTrace(operationId, 'failure', error);

        return {
          isValid: false,
          error,
          canRecover: false,
          suggestedAction: 'Contact support for PDA derivation issues',
        };
      }

      const { derivedPda } = await pdaResult;
      this.diagnostics.completeTraceStep(operationId, 'pda_derivation', 'success', {
        derivedPda: derivedPda.toString(),
      });

      // Step 2: Validate account structure
      this.diagnostics.addTraceStep(operationId, 'account_validation', 'Validate account structure');
      
      const validationResult = await this.validator.validateAccountStructure(derivedPda);
      
      if (validationResult.isValid) {
        this.diagnostics.completeTraceStep(operationId, 'account_validation', 'success');
        this.diagnostics.completeTrace(operationId, 'success');

        this.diagnostics.log('info', 'validation', 'Profile validation successful', {
          userPubkey: userPubkey.toString(),
          accountAddress: derivedPda.toString(),
        }, context);

        return {
          isValid: true,
          canRecover: false,
          suggestedAction: 'none',
        };
      }

      // Step 3: Create enhanced error from validation result
      const errorType = this.classifyValidationError(validationResult);
      const error = ProfileErrorFactory.createAccountError(
        errorType,
        derivedPda.toString(),
        userPubkey,
        {
          suggestedFix: validationResult.suggestedAction,
        }
      );

      this.diagnostics.completeTraceStep(operationId, 'account_validation', 'failure', undefined, error.message);

      // Step 4: Get diagnostic information
      this.diagnostics.addTraceStep(operationId, 'diagnostic_collection', 'Collect diagnostic information');
      
      let diagnosticInfo;
      try {
        diagnosticInfo = await this.diagnostics.getDiagnosticInfo(userPubkey);
        this.diagnostics.completeTraceStep(operationId, 'diagnostic_collection', 'success');
      } catch (diagnosticError) {
        this.diagnostics.completeTraceStep(operationId, 'diagnostic_collection', 'failure', undefined, 
          `Failed to collect diagnostics: ${diagnosticError}`);
      }

      this.diagnostics.completeTrace(operationId, 'failure', error);

      this.diagnostics.log('warn', 'validation', 'Profile validation failed', {
        userPubkey: userPubkey.toString(),
        accountAddress: derivedPda.toString(),
        errorType: error.type,
        canRecover: validationResult.canRecover,
        suggestedAction: validationResult.suggestedAction,
      }, context);

      return {
        isValid: false,
        error,
        diagnosticInfo,
        canRecover: validationResult.canRecover,
        suggestedAction: validationResult.suggestedAction,
      };

    } catch (exception) {
      const error = ProfileErrorFactory.fromException(exception, context);
      this.diagnostics.completeTrace(operationId, 'failure', error);

      this.diagnostics.log('error', 'validation', 'Profile validation failed with exception', {
        userPubkey: userPubkey.toString(),
        error: error.message,
      }, context);

      return {
        isValid: false,
        error,
        canRecover: error.isRecoverable,
        suggestedAction: error.suggestedActions.primary,
      };
    }
  }

  /**
   * Attempt profile recovery with comprehensive logging
   */
  async recoverProfile(
    userPubkey: PublicKey,
    sponsor: PublicKey
  ): Promise<{
    success: boolean;
    error?: EnhancedProfileError;
    transactionSignature?: string;
    diagnosticData?: Record<string, unknown>;
  }> {
    const context: ProfileErrorContext = {
      userPubkey: userPubkey.toString(),
      sponsor: sponsor.toString(),
      operation: 'profile_recovery',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    this.diagnostics.log('info', 'recovery', 'Starting profile recovery', {
      userPubkey: userPubkey.toString(),
      sponsor: sponsor.toString(),
    }, context);

    try {
      const recoveryResult = await this.recovery.attemptAccountRecovery(userPubkey, sponsor);

      if (recoveryResult.success) {
        this.diagnostics.log('info', 'recovery', 'Profile recovery successful', {
          userPubkey: userPubkey.toString(),
          action: recoveryResult.action,
          transactionSignature: recoveryResult.transactionSignature,
        }, context);

        return {
          success: true,
          transactionSignature: recoveryResult.transactionSignature,
        };
      } else {
        const error = ProfileErrorFactory.createError('recovery_failed', {
          accountAddress: userPubkey.toString(),
          suggestedFix: recoveryResult.error || 'Unknown recovery error',
        }, context);

        this.diagnostics.log('error', 'recovery', 'Profile recovery failed', {
          userPubkey: userPubkey.toString(),
          error: recoveryResult.error,
          action: recoveryResult.action,
        }, context);

        return {
          success: false,
          error,
        };
      }

    } catch (exception) {
      const error = ProfileErrorFactory.fromException(exception, context);
      
      this.diagnostics.log('error', 'recovery', 'Profile recovery failed with exception', {
        userPubkey: userPubkey.toString(),
        error: error.message,
      }, context);

      return {
        success: false,
        error,
      };
    }
  }

  /**
   * Get comprehensive diagnostic report
   */
  async getDiagnosticReport(userPubkey: PublicKey): Promise<{
    profileDiagnostics: ProfileDiagnosticInfo;
    accountInspection: AccountStateInspection | undefined;
    pdaDiagnostics: PdaDerivationDiagnostic;
    recentLogs: ProfileLogEntry[];
    operationTraces: OperationTrace[];
  }> {
    const context: ProfileErrorContext = {
      userPubkey: userPubkey.toString(),
      operation: 'diagnostic_report',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    this.diagnostics.log('info', 'diagnostic', 'Generating diagnostic report', {
      userPubkey: userPubkey.toString(),
    }, context);

    try {
      const [profileDiagnostics, pdaDiagnostics] = await Promise.all([
        this.diagnostics.getDiagnosticInfo(userPubkey),
        this.diagnostics.diagnosePdaDerivation(userPubkey),
      ]);

      let accountInspection;
      if (profileDiagnostics.derivedPda) {
        accountInspection = await this.diagnostics.inspectAccountState(
          new PublicKey(profileDiagnostics.derivedPda)
        );
      }

      const recentLogs = this.diagnostics.getRecentLogs(50);
      const operationTraces = this.diagnostics.getOperationTraces();

      return {
        profileDiagnostics,
        accountInspection,
        pdaDiagnostics,
        recentLogs,
        operationTraces,
      };

    } catch (error) {
      this.diagnostics.log('error', 'diagnostic', 'Failed to generate diagnostic report', {
        userPubkey: userPubkey.toString(),
        error: error instanceof Error ? error.message : String(error),
      }, context);

      throw ProfileErrorFactory.fromException(error, context);
    }
  }

  /**
   * Format error for user display
   */
  formatErrorForUser(error: EnhancedProfileError): {
    title: string;
    message: string;
    actions: string[];
    severity: string;
    canRetry: boolean;
    canRecover: boolean;
  } {
    const formatted = ProfileErrorFormatter.formatForUser(error);
    
    return {
      ...formatted,
      canRetry: error.retryable,
      canRecover: error.isRecoverable,
    };
  }

  /**
   * Export diagnostic data for support
   */
  exportDiagnosticData(userPubkey?: PublicKey): Record<string, unknown> {
    return this.diagnostics.exportDiagnosticData(userPubkey);
  }

  /**
   * Clear diagnostic data
   */
  clearDiagnosticData(): void {
    this.diagnostics.clearDiagnosticData();
  }

  // Private helper methods

  private classifyValidationError(validationResult: ValidationResult): ProfileErrorType {
    if (validationResult.errors.some((e: string) => e.includes('does not exist'))) {
      return 'account_not_found';
    }
    
    if (validationResult.errors.some((e: string) => e.includes('deserialization') || e.includes('deserialize'))) {
      return 'deserialization_failed';
    }
    
    if (validationResult.errors.some((e: string) => e.includes('size mismatch'))) {
      return 'size_mismatch';
    }
    
    if (validationResult.errors.some((e: string) => e.includes('owner mismatch'))) {
      return 'owner_mismatch';
    }
    
    if (validationResult.errors.some((e: string) => e.includes('structure'))) {
      return 'invalid_structure';
    }
    
    return 'validation_failed';
  }

  private getEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
      if (hostname.includes('staging') || hostname.includes('dev')) {
        return 'staging';
      }
    }
    return 'production';
  }
}

/**
 * Factory function to create enhanced profile service manager
 */
export function createEnhancedProfileServiceManager(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): EnhancedProfileServiceManager {
  return new EnhancedProfileServiceManager(program, provider);
}

/**
 * Utility functions for profile error handling
 */
export const ProfileIntegrationUtils = {
  /**
   * Handle profile operation with automatic error handling and recovery
   */
  handleProfileOperation: async <T>(
    operation: () => Promise<T>,
    context: ProfileErrorContext,
    maxRetries: number = 3
  ): Promise<{ result?: T; error?: EnhancedProfileError; recovered: boolean }> => {
    let lastError: EnhancedProfileError | undefined;
    let recovered = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return { result, recovered };
      } catch (error) {
        lastError = ProfileErrorFactory.fromException(error, {
          ...context,
          attemptCount: attempt,
        });

        // Log the attempt
        const diagnostics = getGlobalDiagnostics();
        if (diagnostics) {
          diagnostics.log('warn', 'operation', `Operation attempt ${attempt} failed`, {
            operation: context.operation,
            attempt,
            error: lastError.message,
            retryable: lastError.retryable,
          }, context);
        }

        // Check if we should retry
        if (!lastError.retryable || attempt === maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        recovered = true;
      }
    }

    return { error: lastError, recovered };
  },

  /**
   * Validate and recover profile if needed
   */
  validateAndRecover: async (
    manager: EnhancedProfileServiceManager,
    userPubkey: PublicKey,
    sponsor: PublicKey
  ): Promise<{
    isValid: boolean;
    recovered: boolean;
    error?: EnhancedProfileError;
    transactionSignature?: string;
  }> => {
    // First, validate the profile
    const validationResult = await manager.validateProfile(userPubkey);
    
    if (validationResult.isValid) {
      return { isValid: true, recovered: false };
    }

    // If validation failed but recovery is possible, attempt recovery
    if (validationResult.canRecover) {
      const recoveryResult = await manager.recoverProfile(userPubkey, sponsor);
      
      if (recoveryResult.success) {
        // Validate again after recovery
        const revalidationResult = await manager.validateProfile(userPubkey);
        
        return {
          isValid: revalidationResult.isValid,
          recovered: true,
          error: revalidationResult.error,
          transactionSignature: recoveryResult.transactionSignature,
        };
      } else {
        return {
          isValid: false,
          recovered: false,
          error: recoveryResult.error,
        };
      }
    }

    return {
      isValid: false,
      recovered: false,
      error: validationResult.error,
    };
  },

  /**
   * Create user-friendly error message
   */
  createUserFriendlyError: (error: EnhancedProfileError): string => {
    const formatted = ProfileErrorFormatter.formatForUser(error);
    
    let message = `${formatted.title}: ${formatted.message}`;
    
    if (formatted.actions.length > 0) {
      message += `\n\nSuggested actions:\n${formatted.actions.map(action => `• ${action}`).join('\n')}`;
    }
    
    return message;
  },

  /**
   * Check if error requires immediate user attention
   */
  requiresUserAttention: (error: EnhancedProfileError): boolean => {
    return error.severity === 'critical' || 
           !error.isRecoverable || 
           error.classification.requiresUserAction;
  },
};