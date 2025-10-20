/**
 * Profile Development Tools and Utilities
 * 
 * Development-specific diagnostic utilities for inspecting account state,
 * debugging profile operations, and analyzing account structure issues.
 * 
 * Requirements: 2.1, 2.3
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { derivePdas, getErrorMessage, UserProfile } from "@/lib/solairus-main";
// Placeholder types for missing services
interface AccountStateInspection {
  [key: string]: unknown;
}

interface PdaDerivationDiagnostic {
  [key: string]: unknown;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  canRecover: boolean;
  suggestedAction: string;
}

interface RecoveryResult {
  success: boolean;
  error?: string;
  action?: string;
  transactionSignature?: string;
}

/**
 * Account structure analysis result
 */
export interface AccountStructureAnalysis {
  address: string;
  analysis: {
    exists: boolean;
    size: {
      actual: number;
      expected: number;
      difference: number;
      status: 'correct' | 'too_small' | 'too_large';
    };
    ownership: {
      owner: string;
      expectedOwner: string;
      correct: boolean;
    };
    data: {
      canDeserialize: boolean;
      deserializationError?: string;
      fieldAnalysis?: FieldAnalysis[];
      dataPreview: string;
      dataHash: string;
    };
    pda: {
      derivationCorrect: boolean;
      expectedAddress: string;
      actualAddress: string;
      bump?: number;
    };
  };
  recommendations: string[];
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface FieldAnalysis {
  fieldName: string;
  expectedType: string;
  actualType: string;
  isValid: boolean;
  value?: string;
  issues: string[];
}

/**
 * Batch analysis result for multiple accounts
 */
export interface BatchAnalysisResult {
  totalAccounts: number;
  healthyAccounts: number;
  problematicAccounts: number;
  results: AccountStructureAnalysis[];
  summary: {
    commonIssues: Array<{ issue: string; count: number; percentage: number }>;
    severityBreakdown: Record<string, number>;
    recommendations: string[];
  };
}

/**
 * Development environment information
 */
export interface DevEnvironmentInfo {
  network: {
    endpoint: string;
    cluster: 'mainnet-beta' | 'testnet' | 'devnet' | 'localnet' | 'unknown';
    blockHeight?: number;
    slot?: number;
    version?: string;
  };
  program: {
    id: string;
    exists: boolean;
    executable: boolean;
    owner: string;
    dataLength: number;
  };
  wallet: {
    connected: boolean;
    publicKey?: string;
    balance?: number;
  };
  browser: {
    userAgent: string;
    walletExtensions: string[];
    localStorage: boolean;
    indexedDB: boolean;
  };
  performance: {
    memoryUsage?: {
      used: number;
      total: number;
      limit: number;
    };
    timing: {
      navigationStart: number;
      loadEventEnd: number;
      domContentLoaded: number;
    };
  };
}

/**
 * Profile Development Tools
 */
export class ProfileDevTools {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private connection: Connection;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
    this.connection = provider.connection;
  }

  /**
   * Comprehensive account structure analysis
   */
  async analyzeAccountStructure(userPubkey: PublicKey): Promise<AccountStructureAnalysis> {
    const { profile } = derivePdas(userPubkey);
    if (!profile) {
      throw new Error('Failed to derive profile PDA');
    }

    const analysis: AccountStructureAnalysis = {
      address: profile.toString(),
      analysis: {
        exists: false,
        size: {
          actual: 0,
          expected: 152,
          difference: 0,
          status: 'correct',
        },
        ownership: {
          owner: '',
          expectedOwner: this.program.programId.toString(),
          correct: false,
        },
        data: {
          canDeserialize: false,
          dataPreview: '',
          dataHash: '',
        },
        pda: {
          derivationCorrect: false,
          expectedAddress: profile.toString(),
          actualAddress: profile.toString(),
        },
      },
      recommendations: [],
      severity: 'info',
    };

    try {
      // Step 1: Check account existence
      const accountInfo = await this.connection.getAccountInfo(profile);
      analysis.analysis.exists = accountInfo !== null;

      if (!accountInfo) {
        analysis.recommendations.push('Account does not exist - complete user registration');
        analysis.severity = 'warning';
        return analysis;
      }

      // Step 2: Analyze size
      analysis.analysis.size.actual = accountInfo.data.length;
      analysis.analysis.size.difference = 
        analysis.analysis.size.actual - analysis.analysis.size.expected;
      
      if (analysis.analysis.size.actual === analysis.analysis.size.expected) {
        analysis.analysis.size.status = 'correct';
      } else if (analysis.analysis.size.actual < analysis.analysis.size.expected) {
        analysis.analysis.size.status = 'too_small';
        analysis.recommendations.push('Account size too small - recreate account with correct size');
        analysis.severity = 'error';
      } else {
        analysis.analysis.size.status = 'too_large';
        analysis.recommendations.push('Account size too large - may indicate structure mismatch');
        analysis.severity = 'warning';
      }

      // Step 3: Analyze ownership
      analysis.analysis.ownership.owner = accountInfo.owner.toString();
      analysis.analysis.ownership.correct = 
        accountInfo.owner.equals(this.program.programId);
      
      if (!analysis.analysis.ownership.correct) {
        analysis.recommendations.push('Account owner incorrect - recreate account');
        analysis.severity = 'critical';
      }

      // Step 4: Analyze data
      analysis.analysis.data.dataPreview = accountInfo.data.slice(0, 64).toString('hex');
      analysis.analysis.data.dataHash = this.hashData(accountInfo.data);

      // Test deserialization
      try {
        const userProfile = await this.program.account["userProfile"].fetch(profile) as UserProfile;
        analysis.analysis.data.canDeserialize = true;
        
        // Analyze fields
        analysis.analysis.data.fieldAnalysis = this.analyzeFields(userProfile);
        
        const invalidFields = analysis.analysis.data.fieldAnalysis.filter(f => !f.isValid);
        if (invalidFields.length > 0) {
          analysis.recommendations.push(`Invalid fields detected: ${invalidFields.map(f => f.fieldName).join(', ')}`);
          analysis.severity = 'error';
        }

      } catch (deserializationError) {
        analysis.analysis.data.canDeserialize = false;
        analysis.analysis.data.deserializationError = getErrorMessage(deserializationError);
        analysis.recommendations.push('Account data cannot be deserialized - attempt recovery or recreation');
        analysis.severity = 'critical';
      }

      // Step 5: Analyze PDA derivation
      try {
        const [expectedPda, bump] = PublicKey.findProgramAddressSync(
          [Buffer.from('user_profile'), userPubkey.toBuffer()],
          this.program.programId
        );
        
        analysis.analysis.pda.derivationCorrect = expectedPda.equals(profile);
        analysis.analysis.pda.expectedAddress = expectedPda.toString();
        analysis.analysis.pda.bump = bump;
        
        if (!analysis.analysis.pda.derivationCorrect) {
          analysis.recommendations.push('PDA derivation mismatch - check program configuration');
          analysis.severity = 'critical';
        }
        
      } catch (pdaError) {
        analysis.recommendations.push('PDA derivation failed - check program configuration');
        analysis.severity = 'critical';
      }

      // Final severity assessment
      if (analysis.recommendations.length === 0) {
        analysis.recommendations.push('Account structure is healthy');
        analysis.severity = 'info';
      }

      return analysis;

    } catch (error) {
      analysis.recommendations.push(`Analysis failed: ${getErrorMessage(error)}`);
      analysis.severity = 'critical';
      return analysis;
    }
  }

  /**
   * Batch analyze multiple user accounts
   */
  async batchAnalyzeAccounts(userPubkeys: PublicKey[]): Promise<BatchAnalysisResult> {
    const results: AccountStructureAnalysis[] = [];
    
    console.log(`[ProfileDevTools] Starting batch analysis of ${userPubkeys.length} accounts...`);
    
    for (let i = 0; i < userPubkeys.length; i++) {
      const userPubkey = userPubkeys[i];
      console.log(`[ProfileDevTools] Analyzing account ${i + 1}/${userPubkeys.length}: ${userPubkey.toString()}`);
      
      try {
        const analysis = await this.analyzeAccountStructure(userPubkey);
        results.push(analysis);
      } catch (error) {
        console.error(`[ProfileDevTools] Failed to analyze account ${userPubkey.toString()}:`, error);
        results.push({
          address: userPubkey.toString(),
          analysis: {
            exists: false,
            size: { actual: 0, expected: 152, difference: -152, status: 'too_small' },
            ownership: { owner: '', expectedOwner: this.program.programId.toString(), correct: false },
            data: { canDeserialize: false, dataPreview: '', dataHash: '' },
            pda: { derivationCorrect: false, expectedAddress: '', actualAddress: '' },
          },
          recommendations: [`Analysis failed: ${getErrorMessage(error)}`],
          severity: 'critical',
        });
      }
    }

    // Generate summary
    const healthyAccounts = results.filter(r => r.severity === 'info').length;
    const problematicAccounts = results.length - healthyAccounts;

    // Count common issues
    const issueCount: Record<string, number> = {};
    results.forEach(result => {
      result.recommendations.forEach(rec => {
        issueCount[rec] = (issueCount[rec] || 0) + 1;
      });
    });

    const commonIssues = Object.entries(issueCount)
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: (count / results.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Severity breakdown
    const severityBreakdown: Record<string, number> = {};
    results.forEach(result => {
      severityBreakdown[result.severity] = (severityBreakdown[result.severity] || 0) + 1;
    });

    // Generate recommendations
    const recommendations: string[] = [];
    if (problematicAccounts > 0) {
      recommendations.push(`${problematicAccounts} accounts need attention`);
    }
    if (commonIssues.length > 0) {
      recommendations.push(`Most common issue: ${commonIssues[0].issue} (${commonIssues[0].count} accounts)`);
    }
    if (healthyAccounts === results.length) {
      recommendations.push('All accounts are healthy');
    }

    return {
      totalAccounts: results.length,
      healthyAccounts,
      problematicAccounts,
      results,
      summary: {
        commonIssues,
        severityBreakdown,
        recommendations,
      },
    };
  }

  /**
   * Interactive account debugger
   */
  async debugAccount(userPubkey: PublicKey): Promise<{
    userPubkey: string;
    structureAnalysis: AccountStructureAnalysis;
    validationResult: ValidationResult;
    pdaDiagnostic: PdaDerivationDiagnostic;
    accountInspection: AccountStateInspection;
    recoveryOptions: RecoveryResult | null;
    debugCommands: string[];
  }> {
    console.log(`[ProfileDevTools] Starting interactive debug for ${userPubkey.toString()}`);

    const { profile } = derivePdas(userPubkey);
    if (!profile) {
      throw new Error('Failed to derive profile PDA');
    }

    // Gather all diagnostic information
    const structureAnalysis = await this.analyzeAccountStructure(userPubkey);
    
    // Placeholder implementations for missing services
    const validationResult: ValidationResult = {
      isValid: structureAnalysis.analysis.exists && structureAnalysis.analysis.data.canDeserialize,
      errors: structureAnalysis.recommendations,
      canRecover: structureAnalysis.severity !== 'critical',
      suggestedAction: structureAnalysis.recommendations[0] || 'No action needed',
    };

    const pdaDiagnostic: PdaDerivationDiagnostic = {
      derivationCorrect: structureAnalysis.analysis.pda.derivationCorrect,
      expectedAddress: structureAnalysis.analysis.pda.expectedAddress,
    };

    const accountInspection: AccountStateInspection = {
      exists: structureAnalysis.analysis.exists,
      size: structureAnalysis.analysis.size.actual,
      canDeserialize: structureAnalysis.analysis.data.canDeserialize,
    };

    // Placeholder recovery options
    let recoveryOptions: RecoveryResult | null = null;
    if (!validationResult.isValid && validationResult.canRecover) {
      recoveryOptions = {
        success: false,
        error: 'Recovery services not implemented',
        action: 'manual_recovery_required',
      };
    }

    // Generate debug commands
    const debugCommands = this.generateDebugCommands(userPubkey, profile, structureAnalysis);

    const debugResult = {
      userPubkey: userPubkey.toString(),
      structureAnalysis,
      validationResult,
      pdaDiagnostic,
      accountInspection,
      recoveryOptions,
      debugCommands,
    };

    // Log debug information to console
    console.group(`[ProfileDevTools] Debug Results for ${userPubkey.toString()}`);
    console.log('Structure Analysis:', structureAnalysis);
    console.log('Validation Result:', validationResult);
    console.log('PDA Diagnostic:', pdaDiagnostic);
    console.log('Account Inspection:', accountInspection);
    if (recoveryOptions) {
      console.log('Recovery Options:', recoveryOptions);
    }
    console.log('Debug Commands:', debugCommands);
    console.groupEnd();

    return debugResult;
  }

  /**
   * Get development environment information
   */
  async getDevEnvironmentInfo(): Promise<DevEnvironmentInfo> {
    const envInfo: DevEnvironmentInfo = {
      network: {
        endpoint: this.connection.rpcEndpoint,
        cluster: this.detectCluster(this.connection.rpcEndpoint),
      },
      program: {
        id: this.program.programId.toString(),
        exists: false,
        executable: false,
        owner: '',
        dataLength: 0,
      },
      wallet: {
        connected: false,
      },
      browser: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Node.js',
        walletExtensions: this.detectWalletExtensions(),
        localStorage: typeof localStorage !== 'undefined',
        indexedDB: typeof indexedDB !== 'undefined',
      },
      performance: {
        timing: {
          navigationStart: 0,
          loadEventEnd: 0,
          domContentLoaded: 0,
        },
      },
    };

    try {
      // Network information
      const [blockHeight, slot, version] = await Promise.all([
        this.connection.getBlockHeight().catch(() => undefined),
        this.connection.getSlot().catch(() => undefined),
        this.connection.getVersion().catch(() => undefined),
      ]);

      envInfo.network.blockHeight = blockHeight;
      envInfo.network.slot = slot;
      envInfo.network.version = version?.['solana-core'];

      // Program information
      const programAccount = await this.connection.getAccountInfo(this.program.programId);
      if (programAccount) {
        envInfo.program.exists = true;
        envInfo.program.executable = programAccount.executable;
        envInfo.program.owner = programAccount.owner.toString();
        envInfo.program.dataLength = programAccount.data.length;
      }

      // Wallet information
      if (this.provider.wallet && this.provider.wallet.publicKey) {
        envInfo.wallet.connected = true;
        envInfo.wallet.publicKey = this.provider.wallet.publicKey.toString();
        
        const balance = await this.connection.getBalance(this.provider.wallet.publicKey);
        envInfo.wallet.balance = balance / 1e9; // Convert lamports to SOL
      }

      // Performance information
      if (typeof performance !== 'undefined') {
        if (typeof (performance as unknown as { memory?: unknown }).memory !== 'undefined') {
          const memory = (performance as unknown as { memory: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          } }).memory;
          envInfo.performance.memoryUsage = {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
          };
        }

        if (performance.timing) {
          envInfo.performance.timing = {
            navigationStart: performance.timing.navigationStart,
            loadEventEnd: performance.timing.loadEventEnd,
            domContentLoaded: performance.timing.domContentLoadedEventEnd,
          };
        }
      }

    } catch (error) {
      console.warn('[ProfileDevTools] Failed to gather some environment info:', getErrorMessage(error));
    }

    return envInfo;
  }

  /**
   * Generate diagnostic report for support
   */
  async generateDiagnosticReport(userPubkey?: PublicKey): Promise<{
    timestamp: number;
    environment: DevEnvironmentInfo;
    userAnalysis?: {
      userPubkey: string;
      structureAnalysis: AccountStructureAnalysis;
      validationResult: ValidationResult;
    };
    systemHealth: {
      rpcLatency: number;
      programAccessible: boolean;
      walletConnected: boolean;
    };
    diagnosticData: Record<string, unknown>;
    recommendations: string[];
  }> {
    const environment = await this.getDevEnvironmentInfo();
    
    let userAnalysis;
    if (userPubkey) {
      const { profile } = derivePdas(userPubkey);
      if (profile) {
        const structureAnalysis = await this.analyzeAccountStructure(userPubkey);
        const validationResult: ValidationResult = {
          isValid: structureAnalysis.analysis.exists && structureAnalysis.analysis.data.canDeserialize,
          errors: structureAnalysis.recommendations,
          canRecover: structureAnalysis.severity !== 'critical',
          suggestedAction: structureAnalysis.recommendations[0] || 'No action needed',
        };
        
        userAnalysis = {
          userPubkey: userPubkey.toString(),
          structureAnalysis,
          validationResult,
        };
      }
    }

    // System health check
    const healthStartTime = Date.now();
    const programAccessible = await this.connection.getAccountInfo(this.program.programId)
      .then(() => true)
      .catch(() => false);
    const rpcLatency = Date.now() - healthStartTime;

    const systemHealth = {
      rpcLatency,
      programAccessible,
      walletConnected: environment.wallet.connected,
    };

    const diagnosticData = {
      userPubkey: userPubkey?.toString(),
      timestamp: Date.now(),
      message: 'Diagnostic services not implemented',
    };

    // Generate recommendations
    const recommendations: string[] = [];
    if (!systemHealth.programAccessible) {
      recommendations.push('Program not accessible - check network connection and program deployment');
    }
    if (systemHealth.rpcLatency > 5000) {
      recommendations.push('High RPC latency detected - consider switching RPC endpoint');
    }
    if (!systemHealth.walletConnected) {
      recommendations.push('Wallet not connected - connect wallet to test profile operations');
    }
    if (userAnalysis && userAnalysis.structureAnalysis.severity === 'critical') {
      recommendations.push('Critical account issues detected - immediate attention required');
    }

    return {
      timestamp: Date.now(),
      environment,
      userAnalysis,
      systemHealth,
      diagnosticData,
      recommendations,
    };
  }

  /**
   * Export debug data as JSON for sharing
   */
  async exportDebugData(userPubkey?: PublicKey): Promise<string> {
    const report = await this.generateDiagnosticReport(userPubkey);
    return JSON.stringify(report, null, 2);
  }

  // Private helper methods

  private analyzeFields(userProfile: UserProfile): FieldAnalysis[] {
    const fields: FieldAnalysis[] = [];

    // Analyze each field
    fields.push(this.analyzeField('user', 'PublicKey', userProfile.user));
    fields.push(this.analyzeField('sponsor', 'PublicKey', userProfile.sponsor));
    fields.push(this.analyzeField('createdAt', 'BN', userProfile.createdAt));
    fields.push(this.analyzeField('activePrincipalUsdt', 'BN', userProfile.activePrincipalUsdt));
    fields.push(this.analyzeField('lastRoiWithdrawAt', 'BN', userProfile.lastRoiWithdrawAt));
    fields.push(this.analyzeField('licenseExpiresAt', 'BN', userProfile.licenseExpiresAt));
    fields.push(this.analyzeField('totalAffiliateEarnings', 'BN', userProfile.totalAffiliateEarnings));
    fields.push(this.analyzeField('totalAffiliateWithdrawn', 'BN', userProfile.totalAffiliateWithdrawn));
    fields.push(this.analyzeField('level1Earnings', 'BN', userProfile.level1Earnings));
    fields.push(this.analyzeField('level2Earnings', 'BN', userProfile.level2Earnings));
    fields.push(this.analyzeField('level3Earnings', 'BN', userProfile.level3Earnings));

    return fields;
  }

  private analyzeField(fieldName: string, expectedType: string, value: unknown): FieldAnalysis {
    const analysis: FieldAnalysis = {
      fieldName,
      expectedType,
      actualType: typeof value,
      isValid: false,
      issues: [],
    };

    try {
      if (value === null || value === undefined) {
        analysis.issues.push('Field is null or undefined');
        return analysis;
      }

      switch (expectedType) {
        case 'PublicKey':
          if (value instanceof PublicKey) {
            analysis.isValid = true;
            analysis.actualType = 'PublicKey';
            analysis.value = value.toString();
          } else if (typeof value === 'object' && value && '_bn' in value) {
            analysis.isValid = true;
            analysis.actualType = 'PublicKey (BN format)';
            analysis.value = new PublicKey(value as unknown).toString();
          } else {
            analysis.issues.push('Expected PublicKey but got different type');
          }
          break;

        case 'BN':
          if (anchor.BN.isBN(value)) {
            analysis.isValid = true;
            analysis.actualType = 'BN';
            analysis.value = (value as anchor.BN).toString();
          } else if (typeof value === 'object' && value && '_bn' in value) {
            analysis.isValid = true;
            analysis.actualType = 'BN (object format)';
            analysis.value = new anchor.BN(value as unknown).toString();
          } else {
            analysis.issues.push('Expected BN but got different type');
          }
          break;

        default:
          analysis.issues.push(`Unknown expected type: ${expectedType}`);
      }

    } catch (error) {
      analysis.issues.push(`Field analysis failed: ${getErrorMessage(error)}`);
    }

    return analysis;
  }

  private hashData(data: Buffer): string {
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 256); i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return hash.toString(16);
  }

  private detectCluster(endpoint: string): DevEnvironmentInfo['network']['cluster'] {
    if (endpoint.includes('mainnet')) return 'mainnet-beta';
    if (endpoint.includes('testnet')) return 'testnet';
    if (endpoint.includes('devnet')) return 'devnet';
    if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) return 'localnet';
    return 'unknown';
  }

  private detectWalletExtensions(): string[] {
    if (typeof window === 'undefined') return [];

    const extensions: string[] = [];
    const solana = (window as unknown as { solana?: unknown }).solana;
    
    if (solana && typeof solana === 'object') {
      const wallet = solana as Record<string, unknown>;
      if (wallet.isPhantom) extensions.push('Phantom');
      if (wallet.isSolflare) extensions.push('Solflare');
      if (wallet.isBackpack) extensions.push('Backpack');
      if (wallet.isCoinbaseWallet) extensions.push('Coinbase');
      if (wallet.isBraveWallet) extensions.push('Brave');
    }

    return extensions;
  }

  private generateDebugCommands(
    userPubkey: PublicKey,
    profilePda: PublicKey,
    analysis: AccountStructureAnalysis
  ): string[] {
    const commands: string[] = [];

    // Basic inspection commands
    commands.push(`solana account ${profilePda.toString()}`);
    commands.push(`solana account ${userPubkey.toString()}`);
    commands.push(`solana program show ${this.program.programId.toString()}`);

    // Conditional commands based on analysis
    if (!analysis.analysis.exists) {
      commands.push(`# Account does not exist - check if user is registered`);
      commands.push(`# Try: await registerUser(${userPubkey.toString()})`);
    }

    if (analysis.analysis.size.status !== 'correct') {
      commands.push(`# Account size issue detected`);
      commands.push(`# Expected: ${analysis.analysis.size.expected}, Actual: ${analysis.analysis.size.actual}`);
    }

    if (!analysis.analysis.ownership.correct) {
      commands.push(`# Account ownership issue`);
      commands.push(`# Owner: ${analysis.analysis.ownership.owner}`);
      commands.push(`# Expected: ${analysis.analysis.ownership.expectedOwner}`);
    }

    if (!analysis.analysis.data.canDeserialize) {
      commands.push(`# Deserialization failed`);
      commands.push(`# Try account recovery or recreation`);
    }

    // Network debugging
    commands.push(`# Network: ${this.connection.rpcEndpoint}`);
    commands.push(`# Check network status: solana cluster-version`);

    return commands;
  }
}

/**
 * Factory function to create ProfileDevTools
 */
export function createProfileDevTools(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): ProfileDevTools {
  return new ProfileDevTools(program, provider);
}

/**
 * Global dev tools instance for console access
 */
let globalDevTools: ProfileDevTools | null = null;

export function initializeGlobalDevTools(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): void {
  globalDevTools = new ProfileDevTools(program, provider);
  
  // Expose to window for console access in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as unknown as { profileDevTools: ProfileDevTools }).profileDevTools = globalDevTools;
    console.log('[ProfileDevTools] Development tools available at window.profileDevTools');
  }
}

export function getGlobalDevTools(): ProfileDevTools | null {
  return globalDevTools;
}

/**
 * Utility functions for quick debugging
 */
export const ProfileDevUtils = {
  /**
   * Quick account check
   */
  quickCheck: async (userPubkey: PublicKey): Promise<void> => {
    const devTools = getGlobalDevTools();
    if (!devTools) {
      console.error('Dev tools not initialized');
      return;
    }

    try {
      const analysis = await devTools.analyzeAccountStructure(userPubkey);
      console.group(`Quick Check: ${userPubkey.toString()}`);
      console.log(`Status: ${analysis.severity}`);
      console.log(`Exists: ${analysis.analysis.exists}`);
      console.log(`Can Deserialize: ${analysis.analysis.data.canDeserialize}`);
      console.log(`Size: ${analysis.analysis.size.actual}/${analysis.analysis.size.expected}`);
      console.log('Recommendations:', analysis.recommendations);
      console.groupEnd();
    } catch (error) {
      console.error('Quick check failed:', getErrorMessage(error));
    }
  },

  /**
   * Debug account interactively
   */
  debug: async (userPubkey: PublicKey): Promise<void> => {
    const devTools = getGlobalDevTools();
    if (!devTools) {
      console.error('Dev tools not initialized');
      return;
    }

    try {
      await devTools.debugAccount(userPubkey);
    } catch (error) {
      console.error('Debug failed:', getErrorMessage(error));
    }
  },

  /**
   * Export debug data to clipboard
   */
  exportToClipboard: async (userPubkey?: PublicKey): Promise<void> => {
    const devTools = getGlobalDevTools();
    if (!devTools) {
      console.error('Dev tools not initialized');
      return;
    }

    try {
      const debugData = await devTools.exportDebugData(userPubkey);
      
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(debugData);
        console.log('Debug data copied to clipboard');
      } else {
        console.log('Debug data:', debugData);
      }
    } catch (error) {
      console.error('Export failed:', getErrorMessage(error));
    }
  },
};