import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

/**
 * User Role Types
 */
export type UserRole = 'admin' | 'dev' | 'marketer1' | 'marketer2' | null;

/**
 * License Status Types
 */
export type LicenseStatus = 'active' | 'expired' | 'near-expiry' | 'none' | 'loading';

/**
 * Transaction Status Types
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'finalized' | 'failed' | 'timeout';

/**
 * User Profile Data
 */
export interface UserProfileData {
  user: PublicKey;
  sponsor: PublicKey;
  createdAt: Date;
  activePrincipalUsdt: number;
  lastRoiWithdrawAt: Date | null;
  licenseExpiresAt: Date | null;
  totalAffiliateEarnings: number;
  totalAffiliateWithdrawn: number;
  level1Earnings: number;
  level2Earnings: number;
  level3Earnings: number;
  creditBalance: number;
}

/**
 * License Information
 */
export interface LicenseInfo {
  status: LicenseStatus;
  expirationDate?: Date;
  daysRemaining?: number;
  isValid: boolean;
}

/**
 * User License Status
 */
export interface UserLicenseStatus {
  exists: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  sponsor: PublicKey | null;
  profile?: UserProfileData;
}

/**
 * Manual License Activation Request
 */
export interface ManualLicenseActivationRequest {
  userPubkey: PublicKey;
  sponsorPubkey: PublicKey;
  durationDays: number;
  extendExisting: boolean;
}

/**
 * User Credit Operation Request
 */
export interface UserCreditOperationRequest {
  userPubkey: PublicKey;
  amount: number;
  isDebit: boolean;
}

/**
 * User Sponsor Update Request
 */
export interface UserSponsorUpdateRequest {
  userPubkey: PublicKey;
  newSponsor: PublicKey;
}

/**
 * Admin Context
 */
export interface AdminContext {
  role: UserRole;
  canAccessConfig: boolean;
  canManageUsers: boolean;
  canViewAllBuckets: boolean;
  accessibleBuckets: string[];
}

/**
 * Contract Event Base
 */
export interface ContractEventBase {
  timestamp: anchor.BN;
}

/**
 * Manual License Activated Event
 */
export interface ManualLicenseActivatedEvent extends ContractEventBase {
  user: PublicKey;
  sponsor: PublicKey;
  durationDays: number;
  licenseExpiresAt: anchor.BN;
  activatedBy: PublicKey;
  wasNewUser: boolean;
  extendExisting: boolean;
  previousExpiration: anchor.BN;
}

/**
 * Credit Balance Updated Event
 */
export interface CreditBalanceUpdatedEvent extends ContractEventBase {
  user: PublicKey;
  amount: anchor.BN;
  isDebit: boolean;
  balanceAfter: anchor.BN;
  updatedBy: PublicKey;
}

/**
 * User Profile Updated Event
 */
export interface UserProfileUpdatedEvent extends ContractEventBase {
  user: PublicKey;
  updatedBy: PublicKey;
  field: string;
  oldValue: string;
  newValue: string;
}

/**
 * Error Context
 */
export interface ErrorContext {
  operation: string;
  userPubkey?: string;
  timestamp: Date;
  attemptCount: number;
}

/**
 * Service Error
 */
export interface ServiceError extends Error {
  code?: string;
  context?: ErrorContext;
  isRetryable?: boolean;
  originalError?: unknown;
}

/**
 * Operation Result
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  transactionSignature?: string;
  timestamp: Date;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Form Validation Result
 */
export interface FormValidationResult extends ValidationResult {
  fieldErrors: Record<string, string[]>;
}

/**
 * Admin Operation Options
 */
export interface AdminOperationOptions {
  skipValidation?: boolean;
  dryRun?: boolean;
  confirmationRequired?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Bucket Information
 */
export interface BucketInfo {
  type: string;
  balance: number;
  canWithdraw: boolean;
  lastUpdated: Date;
}

/**
 * System Configuration
 */
export interface SystemConfiguration {
  admin: PublicKey;
  dev: PublicKey;
  marketer1: PublicKey;
  marketer2: PublicKey;
  trader: PublicKey;
  systemreserve: PublicKey;
  usdtMint: PublicKey;
  activationFeeUsdt: number;
  licenseDurationDays: number;
  roiDailyBps: number;
  licensePercentages: {
    admin: number;
    dev: number;
    marketer1: number;
    marketer2: number;
    reserve: number;
    affL1: number;
    affL2: number;
    affL3: number;
  };
  agentPercentages: {
    admin: number;
    dev: number;
    marketer1: number;
    marketer2: number;
    trader: number;
    reserve: number;
    affL1: number;
    affL2: number;
    affL3: number;
  };
  bucketBalances: {
    admin: number;
    dev: number;
    marketer1: number;
    marketer2: number;
    trader: number;
    systemreserve: number;
  };
}

/**
 * Configuration Update Request
 */
export interface ConfigurationUpdateRequest {
  roleAddresses?: {
    admin?: PublicKey;
    marketer1?: PublicKey;
    marketer2?: PublicKey;
    trader?: PublicKey;
    systemreserve?: PublicKey;
  };
  systemParameters?: {
    activationFeeUsdt?: number;
    licenseDurationDays?: number;
    roiDailyBps?: number;
  };
  licensePercentages?: {
    admin?: number;
    dev?: number;
    marketer1?: number;
    marketer2?: number;
    reserve?: number;
    affL1?: number;
    affL2?: number;
    affL3?: number;
  };
  agentPercentages?: {
    admin?: number;
    dev?: number;
    marketer1?: number;
    marketer2?: number;
    trader?: number;
    reserve?: number;
    affL1?: number;
    affL2?: number;
    affL3?: number;
  };
}

/**
 * Event Listener Callback
 */
export type EventListenerCallback<T = unknown> = (event: T) => void | Promise<void>;

/**
 * Event Subscription
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  callback: EventListenerCallback;
  active: boolean;
}

/**
 * Service Configuration
 */
export interface ServiceConfiguration {
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  confirmationLevel: 'processed' | 'confirmed' | 'finalized';
  enableEventListening: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Pagination Options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated Result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Search Options
 */
export interface SearchOptions extends PaginationOptions {
  query?: string;
  filters?: Record<string, unknown>;
}

/**
 * Export Options
 */
export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  includeHeaders?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  fields?: string[];
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  performedBy: PublicKey;
  targetUser?: PublicKey;
  details: Record<string, unknown>;
  transactionSignature?: string;
  success: boolean;
  error?: string;
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  operationCount: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: Date;
}

/**
 * Health Check Result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'up' | 'down';
    responseTime?: number;
    error?: string;
  }>;
  timestamp: Date;
}

/**
 * Cache Entry
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  key: string;
}

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Notification Configuration
 */
export interface NotificationConfig {
  enabled: boolean;
  channels: ('email' | 'webhook' | 'console')[];
  events: string[];
  filters?: Record<string, unknown>;
}

/**
 * Feature Flag
 */
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  conditions?: Record<string, unknown>;
}

/**
 * Environment Configuration
 */
export interface EnvironmentConfig {
  network: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
  rpcEndpoint: string;
  programId: PublicKey;
  adminAddresses: {
    admin: PublicKey;
    dev: PublicKey;
    marketer1: PublicKey;
    marketer2: PublicKey;
  };
  features: FeatureFlag[];
  rateLimits: Record<string, RateLimitConfig>;
  notifications: NotificationConfig;
}