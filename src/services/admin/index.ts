/**
 * Admin Services Module
 * 
 * Provides comprehensive contract integration services for administrative operations
 * including manual license activation, user credit management, and transaction handling.
 */

// Core Services
export { AdminService, createAdminService } from './admin-service';
export { TransactionService, TransactionManager, createTransactionService, createTransactionManager } from './transaction-service';
export { AdminErrorService, createAdminErrorService, adminErrorService } from './error-service';

// Sponsor Management
export { 
  updateUserSponsor, 
  getUserSponsorInfo, 
  getSponsorReferralCount, 
  getSponsorReferrals, 
  validateSponsorChange 
} from './sponsor-management-service';
export type { SponsorChangeParams, SponsorChangeResult } from './sponsor-management-service';

// Service Types
export type {
  ManualLicenseActivationParams,
  ManualLicenseActivationResult,
  UserCreditParams,
  UserCreditResult,
  UserSponsorUpdateParams,
  ManualLicenseActivatedEvent,
  CreditBalanceUpdatedEvent,
} from './admin-service';

export type {
  TransactionStatus,
  TransactionResult,
  TransactionConfirmationOptions,
  RetryConfig,
} from './transaction-service';

export type {
  ServiceError,
  ErrorContext,
  UserFriendlyError,
  ErrorClassification,
} from './error-service';

// Common Types
export type {
  UserRole,
  LicenseStatus,
  UserProfileData,
  LicenseInfo,
  UserLicenseStatus,
  ManualLicenseActivationRequest,
  UserCreditOperationRequest,
  UserSponsorUpdateRequest,
  AdminContext,
  ContractEventBase,
  UserProfileUpdatedEvent,
  OperationResult,
  ValidationResult,
  FormValidationResult,
  AdminOperationOptions,
  BucketInfo,
  SystemConfiguration,
  ConfigurationUpdateRequest,
  EventListenerCallback,
  EventSubscription,
  ServiceConfiguration,
  PaginationOptions,
  PaginatedResult,
  SearchOptions,
  ExportOptions,
  AuditLogEntry,
  PerformanceMetrics,
  HealthCheckResult,
  CacheEntry,
  RateLimitConfig,
  NotificationConfig,
  FeatureFlag,
  EnvironmentConfig,
} from './types';

// Error Enums
export { AdminErrorCode, ErrorSeverity } from './error-service';

// Utility Functions
export { AdminServiceUtils } from './admin-service';

/**
 * Integrated Admin Service Manager
 * 
 * Combines all admin services into a single, easy-to-use interface
 */
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { AdminService } from './admin-service';
import { TransactionManager } from './transaction-service';
import { AdminErrorService } from './error-service';
import type { 
  ManualLicenseActivationRequest, 
  UserCreditOperationRequest, 
  UserSponsorUpdateRequest,
  OperationResult,
  ErrorContext,
  AdminOperationOptions,
} from './types';

export class IntegratedAdminService {
  private adminService: AdminService;
  private transactionManager: TransactionManager;
  private errorService: AdminErrorService;
  private provider: anchor.AnchorProvider;

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    this.adminService = new AdminService(provider);
    this.transactionManager = new TransactionManager(provider.connection);
    this.errorService = new AdminErrorService();
  }

  /**
   * Manually activate a user's license with full error handling and transaction management
   */
  async activateLicenseManual(
    request: ManualLicenseActivationRequest,
    options?: AdminOperationOptions
  ): Promise<OperationResult> {
    const context: ErrorContext = {
      operation: 'activate_license_manual',
      userPubkey: request.userPubkey.toString(),
      timestamp: new Date(),
      attemptCount: 1,
    };

    try {
      // Validate request
      if (!options?.skipValidation) {
        const validation = this.validateLicenseActivationRequest(request);
        if (!validation.isValid) {
          throw this.errorService.createValidationError(
            'license_activation_request',
            request,
            validation.errors.join(', '),
            context
          );
        }
      }

      // Execute with transaction management
      const result = await this.transactionManager.execute(
        async () => {
          return await this.adminService.activateLicenseManual({
            provider: this.provider,
            userPubkey: request.userPubkey,
            sponsorPubkey: request.sponsorPubkey,
            durationDays: request.durationDays,
            extendExisting: request.extendExisting,
            authority: this.provider.publicKey!,
          });
        },
        {
          id: `manual_license_${request.userPubkey.toString()}_${Date.now()}`,
          confirmationOptions: {
            timeout: options?.timeout || 60000,
            commitment: 'confirmed',
          },
          retryConfig: {
            maxAttempts: options?.retryAttempts || 3,
          },
        }
      );

      if (result.status === 'confirmed' || result.status === 'finalized') {
        return {
          success: true,
          transactionSignature: result.signature,
          timestamp: new Date(),
        };
      } else {
        throw new Error(`Transaction failed with status: ${result.status}`);
      }
    } catch (error) {
      this.errorService.logError(error, context);
      
      return {
        success: false,
        error: this.errorService.createServiceError(error, context),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Credit or debit user balance with full error handling
   */
  async creditUserBalance(
    request: UserCreditOperationRequest,
    options?: AdminOperationOptions
  ): Promise<OperationResult> {
    const context: ErrorContext = {
      operation: 'credit_user_balance',
      userPubkey: request.userPubkey.toString(),
      timestamp: new Date(),
      attemptCount: 1,
    };

    try {
      // Validate request
      if (!options?.skipValidation) {
        const validation = this.validateCreditOperationRequest(request);
        if (!validation.isValid) {
          throw this.errorService.createValidationError(
            'credit_operation_request',
            request,
            validation.errors.join(', '),
            context
          );
        }
      }

      // Execute with transaction management
      const result = await this.transactionManager.execute(
        async () => {
          return await this.adminService.creditUserBalance({
            provider: this.provider,
            userPubkey: request.userPubkey,
            amount: request.amount,
            isDebit: request.isDebit,
            authority: this.provider.publicKey!,
          });
        },
        {
          id: `credit_balance_${request.userPubkey.toString()}_${Date.now()}`,
          confirmationOptions: {
            timeout: options?.timeout || 60000,
            commitment: 'confirmed',
          },
          retryConfig: {
            maxAttempts: options?.retryAttempts || 3,
          },
        }
      );

      if (result.status === 'confirmed' || result.status === 'finalized') {
        return {
          success: true,
          transactionSignature: result.signature,
          timestamp: new Date(),
        };
      } else {
        throw new Error(`Transaction failed with status: ${result.status}`);
      }
    } catch (error) {
      this.errorService.logError(error, context);
      
      return {
        success: false,
        error: this.errorService.createServiceError(error, context),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Update user sponsor with full error handling
   */
  async updateUserSponsor(
    request: UserSponsorUpdateRequest,
    options?: AdminOperationOptions
  ): Promise<OperationResult> {
    const context: ErrorContext = {
      operation: 'update_user_sponsor',
      userPubkey: request.userPubkey.toString(),
      timestamp: new Date(),
      attemptCount: 1,
    };

    try {
      // Validate request
      if (!options?.skipValidation) {
        const validation = this.validateSponsorUpdateRequest(request);
        if (!validation.isValid) {
          throw this.errorService.createValidationError(
            'sponsor_update_request',
            request,
            validation.errors.join(', '),
            context
          );
        }
      }

      // Execute with transaction management
      const result = await this.transactionManager.execute(
        async () => {
          return await this.adminService.updateUserSponsor({
            provider: this.provider,
            userPubkey: request.userPubkey,
            newSponsor: request.newSponsor,
            authority: this.provider.publicKey!,
          });
        },
        {
          id: `update_sponsor_${request.userPubkey.toString()}_${Date.now()}`,
          confirmationOptions: {
            timeout: options?.timeout || 60000,
            commitment: 'confirmed',
          },
          retryConfig: {
            maxAttempts: options?.retryAttempts || 3,
          },
        }
      );

      if (result.status === 'confirmed' || result.status === 'finalized') {
        return {
          success: true,
          transactionSignature: result.signature,
          timestamp: new Date(),
        };
      } else {
        throw new Error(`Transaction failed with status: ${result.status}`);
      }
    } catch (error) {
      this.errorService.logError(error, context);
      
      return {
        success: false,
        error: this.errorService.createServiceError(error, context),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get user profile with error handling
   */
  async getUserProfile(userPubkey: PublicKey): Promise<OperationResult> {
    const context: ErrorContext = {
      operation: 'get_user_profile',
      userPubkey: userPubkey.toString(),
      timestamp: new Date(),
      attemptCount: 1,
    };

    try {
      const profile = await this.adminService.getUserProfile(userPubkey);
      
      return {
        success: true,
        data: profile,
        timestamp: new Date(),
      };
    } catch (error) {
      this.errorService.logError(error, context);
      
      return {
        success: false,
        error: this.errorService.createServiceError(error, context),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get system configuration with error handling
   */
  async getSystemConfiguration(): Promise<OperationResult> {
    const context: ErrorContext = {
      operation: 'get_system_configuration',
      timestamp: new Date(),
      attemptCount: 1,
    };

    try {
      const config = await this.adminService.getConfig();
      
      return {
        success: true,
        data: config,
        timestamp: new Date(),
      };
    } catch (error) {
      this.errorService.logError(error, context);
      
      return {
        success: false,
        error: this.errorService.createServiceError(error, context),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Format error for user display
   */
  formatErrorForUser(error: unknown) {
    return this.errorService.formatErrorForUser(error);
  }

  /**
   * Get transaction manager for advanced usage
   */
  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  /**
   * Get admin service for direct access
   */
  getAdminService(): AdminService {
    return this.adminService;
  }

  /**
   * Get error service for direct access
   */
  getErrorService(): AdminErrorService {
    return this.errorService;
  }

  /**
   * Validate license activation request
   */
  private validateLicenseActivationRequest(request: ManualLicenseActivationRequest) {
    const errors: string[] = [];

    if (!request.userPubkey) {
      errors.push('User public key is required');
    }

    if (!request.sponsorPubkey) {
      errors.push('Sponsor public key is required');
    }

    if (request.durationDays <= 0) {
      errors.push('Duration must be greater than 0 days');
    }

    if (request.durationDays > 3650) {
      errors.push('Duration cannot exceed 10 years (3650 days)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate credit operation request
   */
  private validateCreditOperationRequest(request: UserCreditOperationRequest) {
    const errors: string[] = [];

    if (!request.userPubkey) {
      errors.push('User public key is required');
    }

    if (request.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (request.amount > 1_000_000_000) {
      errors.push('Amount is too large');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate sponsor update request
   */
  private validateSponsorUpdateRequest(request: UserSponsorUpdateRequest) {
    const errors: string[] = [];

    if (!request.userPubkey) {
      errors.push('User public key is required');
    }

    if (!request.newSponsor) {
      errors.push('New sponsor public key is required');
    }

    if (request.userPubkey.equals(request.newSponsor)) {
      errors.push('User cannot be their own sponsor');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Create integrated admin service instance
 */
export function createIntegratedAdminService(provider: anchor.AnchorProvider): IntegratedAdminService {
  return new IntegratedAdminService(provider);
}

/**
 * Admin Service Factory
 * 
 * Provides convenient factory functions for creating admin services
 */
export class AdminServiceFactory {
  /**
   * Create a complete admin service suite
   */
  static createComplete(provider: anchor.AnchorProvider) {
    return {
      integrated: new IntegratedAdminService(provider),
      admin: new AdminService(provider),
      transaction: new TransactionManager(provider.connection),
      error: new AdminErrorService(),
    };
  }

  /**
   * Create admin service with custom configuration
   */
  static createWithConfig(
    provider: anchor.AnchorProvider,
    config: {
      retryAttempts?: number;
      timeout?: number;
      confirmationLevel?: 'processed' | 'confirmed' | 'finalized';
    }
  ) {
    const services = AdminServiceFactory.createComplete(provider);
    
    // Configure transaction service
    services.transaction.getTransactionService().updateRetryConfig({
      maxAttempts: config.retryAttempts || 3,
    });

    return services;
  }
}

// Re-export utility functions
export { AdminServiceUtils } from './admin-service';