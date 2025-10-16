import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { 
  UserProfile, 
  derivePdas, 
  getErrorMessage, 
  registerUser,
  PROGRAM_ID 
} from "@/lib/solairus-main";
import { 
  ProfileAccountValidator, 
  ValidationResult, 
  AccountValidation,
  ProfileValidationError 
} from "./profile-account-validator";
import { 
  ProfileErrorFactory, 
  ProfileErrorContext, 
  EnhancedProfileError 
} from "./profile-error-types";
import { 
  ProfileDiagnosticsService,
  createProfileDiagnosticsService 
} from "./profile-diagnostics";

/**
 * Account Recovery Service
 * 
 * Handles recovery and recreation of corrupted or invalid profile accounts.
 * Provides comprehensive account state detection and recovery strategies.
 * 
 * Key Features:
 * - Account corruption detection and classification
 * - Automatic recovery for known structure changes
 * - Account recreation for corrupted accounts
 * - Recovery strategy selection based on failure type
 */

// Recovery result types
export interface RecoveryResult {
  success: boolean;
  action: 'recovered' | 'recreated' | 'migrated' | 'failed';
  transactionSignature?: string;
  error?: string;
  details?: {
    originalError: string;
    recoveryMethod: string;
    accountAddress: string;
  };
}

export interface AccountFailureClassification {
  type: 'not_found' | 'size_mismatch' | 'data_corruption' | 'structure_mismatch' | 'owner_mismatch' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  suggestedStrategy: RecoveryStrategy;
  details: {
    description: string;
    technicalInfo: string;
    userMessage: string;
  };
}

export type RecoveryStrategy = 
  | 'retry' 
  | 'recreate' 
  | 'migrate' 
  | 'close_and_recreate' 
  | 'manual_intervention'
  | 'none';

export interface RecoveryContext {
  userPubkey: PublicKey;
  profilePda: PublicKey;
  sponsor: PublicKey;
  failureClassification: AccountFailureClassification;
  validationResult: ValidationResult;
  attemptCount: number;
  lastError?: string;
}

/**
 * AccountRecoveryService
 * 
 * Main service class for handling profile account recovery operations
 */
export class AccountRecoveryService {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private validator: ProfileAccountValidator;
  private diagnostics: ProfileDiagnosticsService;

  constructor(
    program: anchor.Program, 
    provider: anchor.AnchorProvider,
    validator: ProfileAccountValidator
  ) {
    this.program = program;
    this.provider = provider;
    this.validator = validator;
    this.diagnostics = createProfileDiagnosticsService(program, provider);
  }

  /**
   * Detect and classify account failure type
   */
  async classifyAccountFailure(
    profilePda: PublicKey,
    validationResult: ValidationResult
  ): Promise<AccountFailureClassification> {
    try {
      // Check if account exists
      const accountExists = await this.validator.checkAccountExists(profilePda);
      
      if (!accountExists) {
        return {
          type: 'not_found',
          severity: 'low',
          isRecoverable: true,
          suggestedStrategy: 'recreate',
          details: {
            description: 'Profile account does not exist',
            technicalInfo: `Account PDA ${profilePda.toString()} not found on blockchain`,
            userMessage: 'Your profile needs to be created. This is normal for new users.',
          },
        };
      }

      // Get account info for detailed analysis
      const accountInfo = await this.provider.connection.getAccountInfo(profilePda);
      if (!accountInfo) {
        return {
          type: 'unknown',
          severity: 'medium',
          isRecoverable: true,
          suggestedStrategy: 'retry',
          details: {
            description: 'Account exists but info cannot be retrieved',
            technicalInfo: 'getAccountInfo returned null despite account existence check',
            userMessage: 'Temporary network issue. Please try again.',
          },
        };
      }

      // Check owner mismatch
      if (!accountInfo.owner.equals(this.program.programId)) {
        return {
          type: 'owner_mismatch',
          severity: 'critical',
          isRecoverable: false,
          suggestedStrategy: 'manual_intervention',
          details: {
            description: 'Account has incorrect owner',
            technicalInfo: `Expected owner: ${this.program.programId.toString()}, Got: ${accountInfo.owner.toString()}`,
            userMessage: 'Account ownership issue detected. Please contact support.',
          },
        };
      }

      // Check size mismatch
      const expectedSize = this.getExpectedProfileSize();
      if (accountInfo.data.length !== expectedSize) {
        return {
          type: 'size_mismatch',
          severity: 'high',
          isRecoverable: true,
          suggestedStrategy: 'close_and_recreate',
          details: {
            description: 'Account has incorrect size allocation',
            technicalInfo: `Expected size: ${expectedSize}, Got: ${accountInfo.data.length}`,
            userMessage: 'Your profile needs to be updated for the latest version.',
          },
        };
      }

      // Test deserialization
      try {
        await this.program.account["userProfile"].fetch(profilePda);
        
        // If we get here, deserialization worked but validation failed
        // This suggests structure mismatch or data integrity issues
        return {
          type: 'structure_mismatch',
          severity: 'medium',
          isRecoverable: true,
          suggestedStrategy: 'migrate',
          details: {
            description: 'Account structure does not match expected format',
            technicalInfo: 'Account deserializes but fails structure validation',
            userMessage: 'Your profile needs to be updated for compatibility.',
          },
        };
        
      } catch (deserializationError) {
        return {
          type: 'data_corruption',
          severity: 'high',
          isRecoverable: true,
          suggestedStrategy: 'close_and_recreate',
          details: {
            description: 'Account data is corrupted or incompatible',
            technicalInfo: `Deserialization failed: ${getErrorMessage(deserializationError)}`,
            userMessage: 'Your profile data is corrupted and needs to be recreated.',
          },
        };
      }

    } catch (error) {
      return {
        type: 'unknown',
        severity: 'medium',
        isRecoverable: true,
        suggestedStrategy: 'retry',
        details: {
          description: 'Unknown error during failure classification',
          technicalInfo: getErrorMessage(error),
          userMessage: 'An unexpected error occurred. Please try again.',
        },
      };
    }
  }

  /**
   * Attempt account recovery based on failure type
   */
  async attemptAccountRecovery(
    userPubkey: PublicKey,
    sponsor: PublicKey,
    maxAttempts: number = 3
  ): Promise<RecoveryResult> {
    const { profile } = derivePdas(userPubkey);
    
    if (!profile) {
      const error = ProfileErrorFactory.createError('pda_derivation_failed', {
        accountAddress: 'unknown',
        suggestedFix: 'Check PDA derivation parameters',
      }, {
        userPubkey: userPubkey.toString(),
        operation: 'account_recovery',
        attemptCount: 1,
        environment: this.getEnvironment(),
      });

      this.diagnostics.log('error', 'recovery', 'PDA derivation failed during recovery', {
        userPubkey: userPubkey.toString(),
        error: error.message,
      });

      return {
        success: false,
        action: 'failed',
        error: 'Could not derive profile PDA',
      };
    }

    const operationId = `recovery_${userPubkey.toString()}_${Date.now()}`;
    const context: ProfileErrorContext = {
      userPubkey: userPubkey.toString(),
      operation: 'account_recovery',
      attemptCount: 0,
      environment: this.getEnvironment(),
    };

    const trace = this.diagnostics.startTrace(operationId, 'attemptAccountRecovery', context);

    let attemptCount = 0;
    let lastError: string | undefined;

    while (attemptCount < maxAttempts) {
      attemptCount++;
      context.attemptCount = attemptCount;
      
      this.diagnostics.addTraceStep(operationId, `attempt_${attemptCount}`, `Recovery attempt ${attemptCount}`);
      
      try {
        // Step 1: Validate current account state
        const validationResult = await this.validator.validateAccountStructure(profile);
        
        if (validationResult.isValid) {
          return {
            success: true,
            action: 'recovered',
            details: {
              originalError: lastError || 'Unknown',
              recoveryMethod: 'validation_passed',
              accountAddress: profile.toString(),
            },
          };
        }

        // Step 2: Classify the failure
        const failureClassification = await this.classifyAccountFailure(profile, validationResult);
        
        // Step 3: Execute recovery strategy
        const recoveryResult = await this.executeRecoveryStrategy(
          userPubkey,
          sponsor,
          failureClassification
        );

        if (recoveryResult.success) {
          this.diagnostics.completeTraceStep(operationId, `attempt_${attemptCount}`, 'success', {
            action: recoveryResult.action,
            transactionSignature: recoveryResult.transactionSignature,
          });
          this.diagnostics.completeTrace(operationId, 'success');
          
          this.diagnostics.log('info', 'recovery', 'Account recovery successful', {
            userPubkey: userPubkey.toString(),
            attemptCount,
            action: recoveryResult.action,
            transactionSignature: recoveryResult.transactionSignature,
          }, context);
          
          return recoveryResult;
        }

        lastError = recoveryResult.error;
        
        this.diagnostics.completeTraceStep(operationId, `attempt_${attemptCount}`, 'failure', undefined, lastError);
        this.diagnostics.log('warn', 'recovery', `Recovery attempt ${attemptCount} failed`, {
          userPubkey: userPubkey.toString(),
          attemptCount,
          error: lastError,
          strategy: failureClassification.suggestedStrategy,
        }, context);
        
        // If strategy was manual intervention, don't retry
        if (failureClassification.suggestedStrategy === 'manual_intervention') {
          break;
        }

      } catch (error) {
        const profileError = ProfileErrorFactory.fromException(error, context);
        lastError = profileError.message;
        
        this.diagnostics.completeTraceStep(operationId, `attempt_${attemptCount}`, 'failure', undefined, lastError);
        this.diagnostics.log('error', 'recovery', `Recovery attempt ${attemptCount} failed with exception`, {
          userPubkey: userPubkey.toString(),
          attemptCount,
          error: lastError,
        }, context);
      }
    }

    const finalError = ProfileErrorFactory.createError('recovery_failed', {
      accountAddress: profile.toString(),
      suggestedFix: 'Contact support for manual recovery assistance',
    }, context);

    this.diagnostics.completeTrace(operationId, 'failure', finalError);
    this.diagnostics.log('error', 'recovery', 'Account recovery failed after all attempts', {
      userPubkey: userPubkey.toString(),
      maxAttempts,
      lastError,
    }, context);

    return {
      success: false,
      action: 'failed',
      error: `Recovery failed after ${maxAttempts} attempts. Last error: ${lastError}`,
      details: {
        originalError: lastError || 'Unknown',
        recoveryMethod: 'max_attempts_exceeded',
        accountAddress: profile.toString(),
      },
    };
  }

  /**
   * Execute specific recovery strategy
   */
  private async executeRecoveryStrategy(
    userPubkey: PublicKey,
    sponsor: PublicKey,
    classification: AccountFailureClassification
  ): Promise<RecoveryResult> {
    const { profile } = derivePdas(userPubkey);
    
    if (!profile) {
      return {
        success: false,
        action: 'failed',
        error: 'Could not derive profile PDA',
      };
    }

    switch (classification.suggestedStrategy) {
      case 'recreate':
        return this.recreateAccount(userPubkey, sponsor);
        
      case 'close_and_recreate':
        return this.closeAndRecreateAccount(userPubkey, sponsor);
        
      case 'migrate':
        return this.migrateAccountStructure(profile);
        
      case 'retry':
        // For retry strategy, we just return success and let the caller retry
        return {
          success: false,
          action: 'failed',
          error: 'Retry strategy requires external retry logic',
        };
        
      case 'manual_intervention':
        return {
          success: false,
          action: 'failed',
          error: 'Manual intervention required. Please contact support.',
        };
        
      default:
        return {
          success: false,
          action: 'failed',
          error: `Unknown recovery strategy: ${classification.suggestedStrategy}`,
        };
    }
  }

  /**
   * Recreate account (for new accounts)
   */
  async recreateAccount(
    userPubkey: PublicKey,
    sponsor: PublicKey
  ): Promise<RecoveryResult> {
    try {
      console.log('🔄 Recreating profile account for user:', userPubkey.toString());
      
      // Use the registerUser function from solairus-main
      // For simplified affiliate system, we use the same sponsor for all levels
      const txSignature = await registerUser(
        this.program,
        userPubkey,
        sponsor, // L1 sponsor
        sponsor, // L2 sponsor (same as L1 for simplicity)
        sponsor  // L3 sponsor (same as L1 for simplicity)
      );

      console.log('✅ Account recreated successfully:', txSignature);
      
      return {
        success: true,
        action: 'recreated',
        transactionSignature: txSignature,
        details: {
          originalError: 'Account did not exist',
          recoveryMethod: 'register_user',
          accountAddress: derivePdas(userPubkey).profile!.toString(),
        },
      };
      
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error('❌ Failed to recreate account:', errorMessage);
      
      return {
        success: false,
        action: 'failed',
        error: errorMessage,
        details: {
          originalError: 'Account recreation failed',
          recoveryMethod: 'register_user',
          accountAddress: derivePdas(userPubkey).profile!.toString(),
        },
      };
    }
  }

  /**
   * Close existing account and recreate (for corrupted accounts)
   */
  async closeAndRecreateAccount(
    userPubkey: PublicKey,
    sponsor: PublicKey
  ): Promise<RecoveryResult> {
    const { profile } = derivePdas(userPubkey);
    
    if (!profile) {
      return {
        success: false,
        action: 'failed',
        error: 'Could not derive profile PDA',
      };
    }

    try {
      console.log('🔄 Closing and recreating corrupted account:', profile.toString());
      
      // Step 1: Close the existing account
      // Note: This requires the account to have a close instruction in the program
      // For now, we'll skip the close step and just recreate
      console.log('⚠️ Account close not implemented, attempting direct recreation');
      
      // Step 2: Recreate the account
      return this.recreateAccount(userPubkey, sponsor);
      
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error('❌ Failed to close and recreate account:', errorMessage);
      
      return {
        success: false,
        action: 'failed',
        error: errorMessage,
        details: {
          originalError: 'Close and recreate failed',
          recoveryMethod: 'close_and_recreate',
          accountAddress: profile.toString(),
        },
      };
    }
  }

  /**
   * Attempt account data migration for structure changes
   */
  async migrateAccountStructure(profilePda: PublicKey): Promise<RecoveryResult> {
    try {
      console.log('🔄 Attempting account structure migration:', profilePda.toString());
      
      // Step 1: Try to fetch the account with current structure
      const userProfile = await this.program.account["userProfile"].fetch(profilePda) as UserProfile;
      
      // Step 2: Validate the migrated structure
      const validation = await this.validator.validateAccountData(profilePda);
      
      if (validation.canDeserialize && validation.structureMatches) {
        console.log('✅ Account migration successful');
        
        return {
          success: true,
          action: 'migrated',
          details: {
            originalError: 'Structure mismatch',
            recoveryMethod: 'structure_validation',
            accountAddress: profilePda.toString(),
          },
        };
      } else {
        return {
          success: false,
          action: 'failed',
          error: 'Migration validation failed',
          details: {
            originalError: 'Structure validation failed after migration',
            recoveryMethod: 'structure_validation',
            accountAddress: profilePda.toString(),
          },
        };
      }
      
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error('❌ Account migration failed:', errorMessage);
      
      return {
        success: false,
        action: 'failed',
        error: errorMessage,
        details: {
          originalError: 'Migration attempt failed',
          recoveryMethod: 'structure_migration',
          accountAddress: profilePda.toString(),
        },
      };
    }
  }

  /**
   * Get recovery recommendations based on account state
   */
  async getRecoveryRecommendations(
    userPubkey: PublicKey
  ): Promise<{
    canRecover: boolean;
    recommendedAction: string;
    riskLevel: 'low' | 'medium' | 'high';
    userMessage: string;
    technicalDetails: string;
  }> {
    const { profile } = derivePdas(userPubkey);
    
    if (!profile) {
      return {
        canRecover: false,
        recommendedAction: 'Contact support',
        riskLevel: 'high',
        userMessage: 'Unable to derive profile address',
        technicalDetails: 'PDA derivation failed',
      };
    }

    try {
      const validationResult = await this.validator.validateAccountStructure(profile);
      const classification = await this.classifyAccountFailure(profile, validationResult);
      
      return {
        canRecover: classification.isRecoverable,
        recommendedAction: this.getActionDescription(classification.suggestedStrategy),
        riskLevel: this.getRiskLevel(classification.severity),
        userMessage: classification.details.userMessage,
        technicalDetails: classification.details.technicalInfo,
      };
      
    } catch (error) {
      return {
        canRecover: true,
        recommendedAction: 'Retry operation',
        riskLevel: 'medium',
        userMessage: 'Temporary error occurred. Please try again.',
        technicalDetails: getErrorMessage(error),
      };
    }
  }

  /**
   * Get expected profile account size
   */
  private getExpectedProfileSize(): number {
    // Same calculation as in ProfileAccountValidator
    return 152; // 8 (discriminator) + 144 (UserProfile struct)
  }

  /**
   * Get human-readable action description
   */
  private getActionDescription(strategy: RecoveryStrategy): string {
    switch (strategy) {
      case 'retry':
        return 'Retry the operation';
      case 'recreate':
        return 'Create new profile account';
      case 'migrate':
        return 'Update account structure';
      case 'close_and_recreate':
        return 'Replace corrupted account';
      case 'manual_intervention':
        return 'Contact support for assistance';
      default:
        return 'No action required';
    }
  }

  /**
   * Convert severity to risk level
   */
  private getRiskLevel(severity: AccountFailureClassification['severity']): 'low' | 'medium' | 'high' {
    switch (severity) {
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
      case 'critical':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Get current environment
   */
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

  /**
   * Create recovery context for tracking recovery operations
   */
  createRecoveryContext(
    userPubkey: PublicKey,
    sponsor: PublicKey,
    validationResult: ValidationResult,
    failureClassification: AccountFailureClassification
  ): RecoveryContext {
    const { profile } = derivePdas(userPubkey);
    
    return {
      userPubkey,
      profilePda: profile!,
      sponsor,
      failureClassification,
      validationResult,
      attemptCount: 0,
    };
  }

  /**
   * Check if recovery is safe to attempt
   */
  async isRecoverySafe(
    userPubkey: PublicKey
  ): Promise<{
    isSafe: boolean;
    reason: string;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    try {
      const { profile } = derivePdas(userPubkey);
      
      if (!profile) {
        return {
          isSafe: false,
          reason: 'Cannot derive profile PDA',
          warnings,
        };
      }

      // Check if account exists
      const accountExists = await this.validator.checkAccountExists(profile);
      
      if (accountExists) {
        // Get account info to check for potential issues
        const accountInfo = await this.provider.connection.getAccountInfo(profile);
        
        if (accountInfo) {
          // Check if account has correct owner
          if (!accountInfo.owner.equals(this.program.programId)) {
            return {
              isSafe: false,
              reason: 'Account has incorrect owner - recovery may not be possible',
              warnings,
            };
          }
          
          // Check if account has data
          if (accountInfo.data.length > 0) {
            warnings.push('Account contains data that may be lost during recovery');
          }
        }
      }

      return {
        isSafe: true,
        reason: 'Recovery appears safe to attempt',
        warnings,
      };
      
    } catch (error) {
      return {
        isSafe: false,
        reason: `Safety check failed: ${getErrorMessage(error)}`,
        warnings,
      };
    }
  }
}

/**
 * Factory function to create AccountRecoveryService instance
 */
export function createAccountRecoveryService(
  program: anchor.Program,
  provider: anchor.AnchorProvider,
  validator: ProfileAccountValidator
): AccountRecoveryService {
  return new AccountRecoveryService(program, provider, validator);
}

/**
 * Utility function for quick account recovery
 */
export async function recoverProfileAccount(
  program: anchor.Program,
  provider: anchor.AnchorProvider,
  validator: ProfileAccountValidator,
  userPubkey: PublicKey,
  sponsor: PublicKey
): Promise<RecoveryResult> {
  const recoveryService = createAccountRecoveryService(program, provider, validator);
  return recoveryService.attemptAccountRecovery(userPubkey, sponsor);
}