/**
 * Profile Diagnostics and Logging System
 * 
 * Comprehensive logging and diagnostic utilities for profile account operations
 * with detailed information for debugging and monitoring.
 * 
 * Requirements: 2.1, 2.3, 2.4
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { derivePdas, getErrorMessage } from "@/lib/solairus-main";
import { 
  EnhancedProfileError, 
  ProfileErrorFactory, 
  ProfileErrorFormatter,
  ProfileErrorContext 
} from "./profile-error-types";
import { ValidationResult, AccountValidation } from "./profile-account-validator";

/**
 * Diagnostic information for profile accounts
 */
export interface ProfileDiagnosticInfo {
  timestamp: number;
  userPubkey: string;
  derivedPda: string;
  pdaDerivationSuccess: boolean;
  accountExists: boolean;
  accountInfo?: {
    owner: string;
    size: number;
    executable: boolean;
    rentEpoch: number;
    lamports: number;
    dataHash?: string;
  };
  validationResult?: ValidationResult;
  networkInfo: {
    rpcEndpoint: string;
    blockHeight?: number;
    slot?: number;
    networkLatency?: number;
  };
  programInfo: {
    programId: string;
    programExists: boolean;
    programExecutable?: boolean;
  };
  environmentInfo: {
    userAgent?: string;
    walletType?: string;
    clientVersion?: string;
    environment: 'development' | 'staging' | 'production';
  };
}

/**
 * Account state inspection details
 */
export interface AccountStateInspection {
  address: string;
  exists: boolean;
  rawData?: {
    size: number;
    owner: string;
    executable: boolean;
    rentEpoch: number;
    lamports: number;
    dataPreview: string; // First 64 bytes as hex
    dataHash: string;
  };
  deserializationAttempt?: {
    success: boolean;
    error?: string;
    partialData?: Record<string, any>;
  };
  structureAnalysis?: {
    expectedFields: string[];
    actualFields: string[];
    missingFields: string[];
    extraFields: string[];
    fieldTypeMatches: Record<string, boolean>;
  };
  sizeAnalysis: {
    expectedSize: number;
    actualSize: number;
    sizeDifference: number;
    sizeCategory: 'correct' | 'too_small' | 'too_large';
  };
}

/**
 * PDA derivation diagnostic information
 */
export interface PdaDerivationDiagnostic {
  userPubkey: string;
  programId: string;
  seeds: {
    provided: string[];
    computed: string[];
    seedsMatch: boolean;
  };
  derivationResult: {
    success: boolean;
    derivedAddress?: string;
    bump?: number;
    error?: string;
  };
  verification: {
    addressValid: boolean;
    onCurve: boolean;
    canonicalBump: boolean;
  };
}

/**
 * Operation trace for debugging complex flows
 */
export interface OperationTrace {
  operationId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  steps: OperationStep[];
  result: 'success' | 'failure' | 'partial' | 'timeout';
  error?: EnhancedProfileError;
  context: ProfileErrorContext;
}

export interface OperationStep {
  stepId: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'failure' | 'skipped';
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Logging levels for profile operations
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Log entry structure
 */
export interface ProfileLogEntry {
  level: LogLevel;
  timestamp: number;
  category: 'validation' | 'recovery' | 'operation' | 'diagnostic' | 'performance';
  message: string;
  details?: Record<string, any>;
  context?: ProfileErrorContext;
  operationId?: string;
  userPubkey?: string;
  accountAddress?: string;
}

/**
 * Profile Diagnostics Service
 */
export class ProfileDiagnosticsService {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private connection: Connection;
  private logs: ProfileLogEntry[] = [];
  private traces: Map<string, OperationTrace> = new Map();
  private maxLogEntries: number = 1000;
  private maxTraces: number = 100;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
    this.connection = provider.connection;
  }

  /**
   * Log profile operation with context
   */
  log(
    level: LogLevel,
    category: ProfileLogEntry['category'],
    message: string,
    details?: Record<string, any>,
    context?: ProfileErrorContext
  ): void {
    const entry: ProfileLogEntry = {
      level,
      timestamp: Date.now(),
      category,
      message,
      details,
      context,
      userPubkey: context?.userPubkey,
      accountAddress: details?.accountAddress,
      operationId: context?.operation,
    };

    this.logs.push(entry);
    
    // Trim logs if exceeding max entries
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console output for development
    if (this.isDevelopment()) {
      this.outputToConsole(entry);
    }
  }

  /**
   * Start operation trace
   */
  startTrace(
    operationId: string,
    operation: string,
    context: ProfileErrorContext
  ): OperationTrace {
    const trace: OperationTrace = {
      operationId,
      operation,
      startTime: Date.now(),
      steps: [],
      result: 'success',
      context,
    };

    this.traces.set(operationId, trace);
    
    // Trim traces if exceeding max
    if (this.traces.size > this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }

    this.log('debug', 'operation', `Started operation: ${operation}`, { operationId }, context);
    
    return trace;
  }

  /**
   * Add step to operation trace
   */
  addTraceStep(
    operationId: string,
    stepId: string,
    name: string,
    input?: Record<string, any>
  ): OperationStep {
    const trace = this.traces.get(operationId);
    if (!trace) {
      throw new Error(`Operation trace not found: ${operationId}`);
    }

    const step: OperationStep = {
      stepId,
      name,
      startTime: Date.now(),
      status: 'pending',
      input,
    };

    trace.steps.push(step);
    
    this.log('debug', 'operation', `Started step: ${name}`, { operationId, stepId, input }, trace.context);
    
    return step;
  }

  /**
   * Complete operation trace step
   */
  completeTraceStep(
    operationId: string,
    stepId: string,
    status: OperationStep['status'],
    output?: Record<string, any>,
    error?: string
  ): void {
    const trace = this.traces.get(operationId);
    if (!trace) return;

    const step = trace.steps.find(s => s.stepId === stepId);
    if (!step) return;

    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    step.status = status;
    step.output = output;
    step.error = error;

    const level: LogLevel = status === 'failure' ? 'error' : 'debug';
    this.log(level, 'operation', `Completed step: ${step.name} (${status})`, {
      operationId,
      stepId,
      duration: step.duration,
      output,
      error,
    }, trace.context);
  }

  /**
   * Complete operation trace
   */
  completeTrace(
    operationId: string,
    result: OperationTrace['result'],
    error?: EnhancedProfileError
  ): OperationTrace | undefined {
    const trace = this.traces.get(operationId);
    if (!trace) return undefined;

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.result = result;
    trace.error = error;

    const level: LogLevel = result === 'failure' ? 'error' : 'info';
    this.log(level, 'operation', `Completed operation: ${trace.operation} (${result})`, {
      operationId,
      duration: trace.duration,
      stepsCount: trace.steps.length,
      error: error ? ProfileErrorFormatter.formatForLogging(error) : undefined,
    }, trace.context);

    return trace;
  }

  /**
   * Get comprehensive diagnostic information for a user profile
   */
  async getDiagnosticInfo(userPubkey: PublicKey): Promise<ProfileDiagnosticInfo> {
    const startTime = Date.now();
    const operationId = `diagnostic_${userPubkey.toString()}_${startTime}`;
    
    const context: ProfileErrorContext = {
      userPubkey: userPubkey.toString(),
      operation: 'diagnostic',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    const trace = this.startTrace(operationId, 'getDiagnosticInfo', context);

    try {
      // Step 1: PDA Derivation
      this.addTraceStep(operationId, 'pda_derivation', 'Derive profile PDA');
      const pdaResult = derivePdas(userPubkey);
      this.completeTraceStep(operationId, 'pda_derivation', 'success', {
        profilePda: pdaResult.profile?.toString(),
      });

      if (!pdaResult.profile) {
        throw new Error('Failed to derive profile PDA');
      }

      // Step 2: Network Information
      this.addTraceStep(operationId, 'network_info', 'Get network information');
      const networkInfo = await this.getNetworkInfo();
      this.completeTraceStep(operationId, 'network_info', 'success', networkInfo);

      // Step 3: Account Information
      this.addTraceStep(operationId, 'account_info', 'Get account information');
      const accountExists = await this.checkAccountExists(pdaResult.profile);
      let accountInfo;
      
      if (accountExists) {
        const rawAccountInfo = await this.connection.getAccountInfo(pdaResult.profile);
        if (rawAccountInfo) {
          accountInfo = {
            owner: rawAccountInfo.owner.toString(),
            size: rawAccountInfo.data.length,
            executable: rawAccountInfo.executable,
            rentEpoch: rawAccountInfo.rentEpoch,
            lamports: rawAccountInfo.lamports,
            dataHash: this.hashData(rawAccountInfo.data),
          };
        }
      }
      this.completeTraceStep(operationId, 'account_info', 'success', { accountExists, accountInfo });

      // Step 4: Program Information
      this.addTraceStep(operationId, 'program_info', 'Get program information');
      const programInfo = await this.getProgramInfo();
      this.completeTraceStep(operationId, 'program_info', 'success', programInfo);

      // Step 5: Environment Information
      this.addTraceStep(operationId, 'environment_info', 'Get environment information');
      const environmentInfo = this.getEnvironmentInfo();
      this.completeTraceStep(operationId, 'environment_info', 'success', environmentInfo);

      const diagnosticInfo: ProfileDiagnosticInfo = {
        timestamp: Date.now(),
        userPubkey: userPubkey.toString(),
        derivedPda: pdaResult.profile.toString(),
        pdaDerivationSuccess: true,
        accountExists,
        accountInfo,
        networkInfo,
        programInfo,
        environmentInfo,
      };

      this.completeTrace(operationId, 'success');
      
      this.log('info', 'diagnostic', 'Diagnostic information collected successfully', {
        userPubkey: userPubkey.toString(),
        accountExists,
        duration: Date.now() - startTime,
      }, context);

      return diagnosticInfo;

    } catch (error) {
      const profileError = ProfileErrorFactory.fromException(error, context);
      this.completeTrace(operationId, 'failure', profileError);
      
      this.log('error', 'diagnostic', 'Failed to collect diagnostic information', {
        error: ProfileErrorFormatter.formatForLogging(profileError),
        duration: Date.now() - startTime,
      }, context);

      throw profileError;
    }
  }

  /**
   * Inspect account state in detail
   */
  async inspectAccountState(accountAddress: PublicKey): Promise<AccountStateInspection> {
    const startTime = Date.now();
    const context: ProfileErrorContext = {
      operation: 'account_inspection',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    try {
      this.log('debug', 'diagnostic', 'Starting account state inspection', {
        accountAddress: accountAddress.toString(),
      }, context);

      const inspection: AccountStateInspection = {
        address: accountAddress.toString(),
        exists: false,
        sizeAnalysis: {
          expectedSize: this.getExpectedProfileSize(),
          actualSize: 0,
          sizeDifference: 0,
          sizeCategory: 'correct',
        },
      };

      // Check if account exists
      const accountInfo = await this.connection.getAccountInfo(accountAddress);
      inspection.exists = accountInfo !== null;

      if (accountInfo) {
        // Raw data analysis
        inspection.rawData = {
          size: accountInfo.data.length,
          owner: accountInfo.owner.toString(),
          executable: accountInfo.executable,
          rentEpoch: accountInfo.rentEpoch,
          lamports: accountInfo.lamports,
          dataPreview: accountInfo.data.slice(0, 64).toString('hex'),
          dataHash: this.hashData(accountInfo.data),
        };

        // Size analysis
        inspection.sizeAnalysis.actualSize = accountInfo.data.length;
        inspection.sizeAnalysis.sizeDifference = 
          inspection.sizeAnalysis.actualSize - inspection.sizeAnalysis.expectedSize;
        
        if (inspection.sizeAnalysis.actualSize === inspection.sizeAnalysis.expectedSize) {
          inspection.sizeAnalysis.sizeCategory = 'correct';
        } else if (inspection.sizeAnalysis.actualSize < inspection.sizeAnalysis.expectedSize) {
          inspection.sizeAnalysis.sizeCategory = 'too_small';
        } else {
          inspection.sizeAnalysis.sizeCategory = 'too_large';
        }

        // Deserialization attempt
        try {
          const userProfile = await this.program.account["userProfile"].fetch(accountAddress);
          inspection.deserializationAttempt = {
            success: true,
            partialData: this.extractPartialData(userProfile),
          };

          // Structure analysis
          inspection.structureAnalysis = this.analyzeStructure(userProfile);

        } catch (deserializationError) {
          inspection.deserializationAttempt = {
            success: false,
            error: getErrorMessage(deserializationError),
          };
        }
      }

      this.log('info', 'diagnostic', 'Account state inspection completed', {
        accountAddress: accountAddress.toString(),
        exists: inspection.exists,
        sizeCategory: inspection.sizeAnalysis.sizeCategory,
        deserializationSuccess: inspection.deserializationAttempt?.success,
        duration: Date.now() - startTime,
      }, context);

      return inspection;

    } catch (error) {
      this.log('error', 'diagnostic', 'Account state inspection failed', {
        accountAddress: accountAddress.toString(),
        error: getErrorMessage(error),
        duration: Date.now() - startTime,
      }, context);

      throw ProfileErrorFactory.fromException(error, context);
    }
  }

  /**
   * Diagnose PDA derivation process
   */
  async diagnosePdaDerivation(userPubkey: PublicKey): Promise<PdaDerivationDiagnostic> {
    const context: ProfileErrorContext = {
      userPubkey: userPubkey.toString(),
      operation: 'pda_diagnosis',
      attemptCount: 1,
      environment: this.getEnvironment(),
    };

    try {
      this.log('debug', 'diagnostic', 'Starting PDA derivation diagnosis', {
        userPubkey: userPubkey.toString(),
      }, context);

      const diagnostic: PdaDerivationDiagnostic = {
        userPubkey: userPubkey.toString(),
        programId: this.program.programId.toString(),
        seeds: {
          provided: ['user_profile', userPubkey.toString()],
          computed: [],
          seedsMatch: false,
        },
        derivationResult: {
          success: false,
        },
        verification: {
          addressValid: false,
          onCurve: false,
          canonicalBump: false,
        },
      };

      // Attempt PDA derivation
      try {
        const pdaResult = derivePdas(userPubkey);
        
        if (pdaResult.profile) {
          diagnostic.derivationResult = {
            success: true,
            derivedAddress: pdaResult.profile.toString(),
          };

          // Verify the derived address
          diagnostic.verification.addressValid = PublicKey.isOnCurve(pdaResult.profile);
          diagnostic.verification.onCurve = PublicKey.isOnCurve(pdaResult.profile);

          // Try to find the canonical bump
          try {
            const [derivedPda, bump] = PublicKey.findProgramAddressSync(
              [Buffer.from('user_profile'), userPubkey.toBuffer()],
              this.program.programId
            );
            
            diagnostic.verification.canonicalBump = derivedPda.equals(pdaResult.profile);
            diagnostic.derivationResult.bump = bump;
            
          } catch (bumpError) {
            diagnostic.verification.canonicalBump = false;
          }
        }

      } catch (derivationError) {
        diagnostic.derivationResult = {
          success: false,
          error: getErrorMessage(derivationError),
        };
      }

      this.log('info', 'diagnostic', 'PDA derivation diagnosis completed', {
        userPubkey: userPubkey.toString(),
        success: diagnostic.derivationResult.success,
        derivedAddress: diagnostic.derivationResult.derivedAddress,
        addressValid: diagnostic.verification.addressValid,
      }, context);

      return diagnostic;

    } catch (error) {
      this.log('error', 'diagnostic', 'PDA derivation diagnosis failed', {
        userPubkey: userPubkey.toString(),
        error: getErrorMessage(error),
      }, context);

      throw ProfileErrorFactory.fromException(error, context);
    }
  }

  /**
   * Get operation traces for debugging
   */
  getOperationTraces(operationId?: string): OperationTrace[] {
    if (operationId) {
      const trace = this.traces.get(operationId);
      return trace ? [trace] : [];
    }
    
    return Array.from(this.traces.values());
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(
    count: number = 100,
    level?: LogLevel,
    category?: ProfileLogEntry['category']
  ): ProfileLogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      const levelPriority = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
      const minPriority = levelPriority[level];
      filteredLogs = filteredLogs.filter(log => levelPriority[log.level] >= minPriority);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    return filteredLogs.slice(-count);
  }

  /**
   * Export diagnostic data for support
   */
  exportDiagnosticData(userPubkey?: PublicKey): {
    timestamp: number;
    userPubkey?: string;
    logs: ProfileLogEntry[];
    traces: OperationTrace[];
    systemInfo: {
      programId: string;
      rpcEndpoint: string;
      environment: string;
      clientVersion?: string;
    };
  } {
    const filteredLogs = userPubkey 
      ? this.logs.filter(log => log.userPubkey === userPubkey.toString())
      : this.logs;

    const filteredTraces = userPubkey
      ? Array.from(this.traces.values()).filter(trace => 
          trace.context.userPubkey === userPubkey.toString())
      : Array.from(this.traces.values());

    return {
      timestamp: Date.now(),
      userPubkey: userPubkey?.toString(),
      logs: filteredLogs,
      traces: filteredTraces,
      systemInfo: {
        programId: this.program.programId.toString(),
        rpcEndpoint: this.connection.rpcEndpoint,
        environment: this.getEnvironment(),
        clientVersion: this.getClientVersion(),
      },
    };
  }

  /**
   * Clear diagnostic data
   */
  clearDiagnosticData(): void {
    this.logs = [];
    this.traces.clear();
    
    this.log('info', 'diagnostic', 'Diagnostic data cleared', {
      timestamp: Date.now(),
    });
  }

  // Private helper methods

  private async checkAccountExists(address: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(address);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  private async getNetworkInfo(): Promise<ProfileDiagnosticInfo['networkInfo']> {
    const startTime = Date.now();
    
    try {
      const [blockHeight, slot] = await Promise.all([
        this.connection.getBlockHeight().catch(() => undefined),
        this.connection.getSlot().catch(() => undefined),
      ]);

      const networkLatency = Date.now() - startTime;

      return {
        rpcEndpoint: this.connection.rpcEndpoint,
        blockHeight,
        slot,
        networkLatency,
      };
    } catch {
      return {
        rpcEndpoint: this.connection.rpcEndpoint,
        networkLatency: Date.now() - startTime,
      };
    }
  }

  private async getProgramInfo(): Promise<ProfileDiagnosticInfo['programInfo']> {
    try {
      const programAccount = await this.connection.getAccountInfo(this.program.programId);
      
      return {
        programId: this.program.programId.toString(),
        programExists: programAccount !== null,
        programExecutable: programAccount?.executable,
      };
    } catch {
      return {
        programId: this.program.programId.toString(),
        programExists: false,
      };
    }
  }

  private getEnvironmentInfo(): ProfileDiagnosticInfo['environmentInfo'] {
    return {
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      walletType: this.getWalletType(),
      clientVersion: this.getClientVersion(),
      environment: this.getEnvironment(),
    };
  }

  private getExpectedProfileSize(): number {
    // Same calculation as in ProfileAccountValidator
    return 152;
  }

  private hashData(data: Buffer): string {
    // Simple hash for data identification
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 256); i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return hash.toString(16);
  }

  private extractPartialData(userProfile: any): Record<string, any> {
    try {
      return {
        user: userProfile.user?.toString(),
        sponsor: userProfile.sponsor?.toString(),
        createdAt: userProfile.createdAt?.toString(),
        activePrincipalUsdt: userProfile.activePrincipalUsdt?.toString(),
        licenseExpiresAt: userProfile.licenseExpiresAt?.toString(),
        totalAffiliateEarnings: userProfile.totalAffiliateEarnings?.toString(),
      };
    } catch {
      return {};
    }
  }

  private analyzeStructure(userProfile: any): AccountStateInspection['structureAnalysis'] {
    const expectedFields = [
      'user', 'sponsor', 'createdAt', 'activePrincipalUsdt', 
      'lastRoiWithdrawAt', 'licenseExpiresAt', 'totalAffiliateEarnings',
      'totalAffiliateWithdrawn', 'level1Earnings', 'level2Earnings', 'level3Earnings'
    ];

    const actualFields = Object.keys(userProfile || {});
    const missingFields = expectedFields.filter(field => !actualFields.includes(field));
    const extraFields = actualFields.filter(field => !expectedFields.includes(field));

    const fieldTypeMatches: Record<string, boolean> = {};
    for (const field of expectedFields) {
      if (actualFields.includes(field)) {
        fieldTypeMatches[field] = this.validateFieldType(field, userProfile[field]);
      }
    }

    return {
      expectedFields,
      actualFields,
      missingFields,
      extraFields,
      fieldTypeMatches,
    };
  }

  private validateFieldType(field: string, value: any): boolean {
    switch (field) {
      case 'user':
      case 'sponsor':
        return value instanceof PublicKey || (typeof value === 'object' && value._bn);
      case 'createdAt':
      case 'activePrincipalUsdt':
      case 'lastRoiWithdrawAt':
      case 'licenseExpiresAt':
      case 'totalAffiliateEarnings':
      case 'totalAffiliateWithdrawn':
      case 'level1Earnings':
      case 'level2Earnings':
      case 'level3Earnings':
        return anchor.BN.isBN(value) || (typeof value === 'object' && value._bn);
      default:
        return true;
    }
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

  private getWalletType(): string | undefined {
    if (typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as unknown).solana;
      if (wallet.isPhantom) return 'Phantom';
      if (wallet.isSolflare) return 'Solflare';
      if (wallet.isBackpack) return 'Backpack';
      if (wallet.isCoinbaseWallet) return 'Coinbase';
      return 'Unknown';
    }
    return undefined;
  }

  private getClientVersion(): string | undefined {
    // This would typically come from package.json or build info
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  private isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  private outputToConsole(entry: ProfileLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.details);
        break;
      case 'info':
        console.info(prefix, entry.message, entry.details);
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.details);
        break;
      case 'error':
      case 'critical':
        console.error(prefix, entry.message, entry.details);
        break;
    }
  }
}

/**
 * Factory function to create ProfileDiagnosticsService
 */
export function createProfileDiagnosticsService(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): ProfileDiagnosticsService {
  return new ProfileDiagnosticsService(program, provider);
}

/**
 * Global diagnostics instance for easy access
 */
let globalDiagnosticsService: ProfileDiagnosticsService | null = null;

export function initializeGlobalDiagnostics(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): void {
  globalDiagnosticsService = new ProfileDiagnosticsService(program, provider);
}

export function getGlobalDiagnostics(): ProfileDiagnosticsService | null {
  return globalDiagnosticsService;
}

/**
 * Utility functions for common diagnostic operations
 */
export const ProfileDiagnosticUtils = {
  /**
   * Quick diagnostic check for user profile
   */
  quickDiagnostic: async (
    program: anchor.Program,
    provider: anchor.AnchorProvider,
    userPubkey: PublicKey
  ): Promise<{
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
  }> => {
    const diagnostics = new ProfileDiagnosticsService(program, provider);
    
    try {
      const info = await diagnostics.getDiagnosticInfo(userPubkey);
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      if (!info.accountExists) {
        issues.push('Profile account does not exist');
        recommendations.push('Complete user registration');
      }
      
      if (info.accountInfo && info.accountInfo.size !== 152) {
        issues.push('Account size mismatch');
        recommendations.push('Update profile account structure');
      }
      
      if (!info.pdaDerivationSuccess) {
        issues.push('PDA derivation failed');
        recommendations.push('Check program configuration');
      }
      
      const status = issues.length === 0 ? 'healthy' : 
                    issues.some(issue => issue.includes('does not exist')) ? 'warning' : 'error';
      
      return { status, issues, recommendations };
      
    } catch (error) {
      return {
        status: 'error',
        issues: [`Diagnostic check failed: ${getErrorMessage(error)}`],
        recommendations: ['Contact support for assistance'],
      };
    }
  },

  /**
   * Performance monitoring for profile operations
   */
  measurePerformance: <T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> => {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        
        if (globalDiagnosticsService) {
          globalDiagnosticsService.log('info', 'performance', 
            `Operation completed: ${operation}`, { duration });
        }
        
        resolve({ result, duration });
      } catch (error) {
        const duration = Date.now() - startTime;
        
        if (globalDiagnosticsService) {
          globalDiagnosticsService.log('error', 'performance', 
            `Operation failed: ${operation}`, { duration, error: getErrorMessage(error) });
        }
        
        reject(error);
      }
    });
  },
};