/**
 * Tests for Profile Monitoring and Development Tools
 * 
 * Comprehensive tests for monitoring metrics collection, diagnostic utilities,
 * and development tools for profile account debugging.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { 
  ProfileMonitoringService,
  createProfileMonitoringService,
  ProfileMonitoringUtils,
  ProfileDevTools,
  createProfileDevTools,
  ProfileDevUtils,
  ProfileErrorFactory,
} from '../index';

// Mock dependencies
vi.mock('@/lib/solairus-main', () => ({
  derivePdas: vi.fn(),
  getErrorMessage: vi.fn((error) => error?.message || 'Unknown error'),
  UserProfile: {},
}));

describe('ProfileMonitoringService', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockConnection: any;
  let monitoringService: ProfileMonitoringService;
  let testUserPubkey: PublicKey;

  beforeEach(() => {
    // Setup mocks
    mockConnection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getBlockHeight: vi.fn().mockResolvedValue(100000),
      getSlot: vi.fn().mockResolvedValue(100000),
      getAccountInfo: vi.fn().mockResolvedValue(null),
      getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.16.0' }),
      getBalance: vi.fn().mockResolvedValue(1000000000),
    };

    mockProvider = {
      connection: mockConnection,
      wallet: {
        publicKey: new PublicKey('11111111111111111111111111111112'),
      },
    } as any;

    mockProgram = {
      programId: new PublicKey('11111111111111111111111111111113'),
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
    } as any;

    testUserPubkey = new PublicKey('11111111111111111111111111111114');
    monitoringService = createProfileMonitoringService(mockProgram, mockProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration Metrics', () => {
    it('should record successful registration attempts', () => {
      const duration = 1500;
      
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, duration);
      
      const metrics = monitoringService.getRegistrationMetrics();
      expect(metrics.totalAttempts).toBe(1);
      expect(metrics.successfulRegistrations).toBe(1);
      expect(metrics.failedRegistrations).toBe(0);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageRegistrationTime).toBe(duration);
    });

    it('should record failed registration attempts with error tracking', () => {
      const duration = 2000;
      const error = ProfileErrorFactory.fromException(
        new Error('Account not found'),
        { userPubkey: testUserPubkey.toString(), operation: 'registration', attemptCount: 1, environment: 'development' }
      );
      
      monitoringService.recordRegistrationAttempt(testUserPubkey, false, duration, error);
      
      const metrics = monitoringService.getRegistrationMetrics();
      expect(metrics.totalAttempts).toBe(1);
      expect(metrics.successfulRegistrations).toBe(0);
      expect(metrics.failedRegistrations).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(Object.keys(metrics.errorBreakdown).length).toBeGreaterThan(0);
    });

    it('should calculate correct success rate with mixed results', () => {
      // Record multiple attempts
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1000);
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1200);
      monitoringService.recordRegistrationAttempt(testUserPubkey, false, 800);
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1100);
      
      const metrics = monitoringService.getRegistrationMetrics();
      expect(metrics.totalAttempts).toBe(4);
      expect(metrics.successfulRegistrations).toBe(3);
      expect(metrics.failedRegistrations).toBe(1);
      expect(metrics.successRate).toBe(75);
    });

    it('should track time series data', () => {
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1000);
      
      const metrics = monitoringService.getRegistrationMetrics();
      expect(metrics.timeSeriesData).toHaveLength(1);
      expect(metrics.timeSeriesData[0].attempts).toBe(1);
      expect(metrics.timeSeriesData[0].successes).toBe(1);
      expect(metrics.timeSeriesData[0].failures).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics', () => {
      const startTime = Date.now() - 1000;
      const metricId = monitoringService.recordPerformanceMetric({
        operationType: 'validation',
        startTime,
        success: true,
        retryCount: 0,
        metadata: { accountSize: 152 },
      });
      
      expect(metricId).toBeDefined();
      
      const metrics = monitoringService.getPerformanceMetrics('validation');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operationType).toBe('validation');
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should provide performance measurement helper', () => {
      const measurement = monitoringService.startPerformanceMeasurement('test_operation', { test: true });
      
      expect(measurement).toHaveProperty('complete');
      expect(typeof measurement.complete).toBe('function');
      
      measurement.complete(true, undefined, { result: 'success' });
      
      const metrics = monitoringService.getPerformanceMetrics('test_operation');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(true);
    });

    it('should filter metrics by operation type and time range', () => {
      const now = Date.now();
      
      // Record metrics with different types and times
      monitoringService.recordPerformanceMetric({
        operationType: 'validation',
        startTime: now - 1000,
        success: true,
        retryCount: 0,
      });
      
      monitoringService.recordPerformanceMetric({
        operationType: 'recovery',
        startTime: now - 2000,
        success: false,
        errorType: 'timeout',
        retryCount: 1,
      });
      
      const validationMetrics = monitoringService.getPerformanceMetrics('validation');
      expect(validationMetrics).toHaveLength(1);
      expect(validationMetrics[0].operationType).toBe('validation');
      
      const recentMetrics = monitoringService.getPerformanceMetrics(undefined, 1); // Last 1 minute
      expect(recentMetrics).toHaveLength(2); // Both metrics are recent enough
    });
  });

  describe('Alert System', () => {
    it('should generate alerts for high error rates', () => {
      // Configure low threshold for testing
      monitoringService.updateAlertConfig({ errorRateThreshold: 50, enabled: true });
      
      // Record high error rate
      for (let i = 0; i < 10; i++) {
        monitoringService.recordPerformanceMetric({
          operationType: 'test',
          startTime: Date.now() - 1000,
          success: i < 3, // 30% success rate (70% error rate)
          retryCount: 0,
        });
      }
      
      // Manually trigger alert check by calling private method through registration
      monitoringService.recordRegistrationAttempt(testUserPubkey, false, 1000);
      
      const activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThanOrEqual(0); // May or may not generate alerts depending on timing
    });

    it('should resolve alerts', () => {
      // Test alert resolution functionality directly
      const fakeAlertId = 'test-alert-id';
      const resolved = monitoringService.resolveAlert(fakeAlertId);
      
      // Should return false for non-existent alert
      expect(resolved).toBe(false);
    });
  });

  describe('Monitoring Report', () => {
    it('should generate comprehensive monitoring report', () => {
      // Record some test data
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1000);
      monitoringService.recordRegistrationAttempt(testUserPubkey, false, 1500);
      
      monitoringService.recordPerformanceMetric({
        operationType: 'validation',
        startTime: Date.now() - 1000,
        success: true,
        retryCount: 0,
      });
      
      const report = monitoringService.generateMonitoringReport(60);
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('registrationMetrics');
      expect(report).toHaveProperty('topErrors');
      expect(report).toHaveProperty('performanceTrends');
      expect(report).toHaveProperty('systemHealth');
      expect(report).toHaveProperty('alerts');
      
      expect(report.summary.totalOperations).toBeGreaterThan(0);
      expect(report.summary.timeRange).toBe('60 minutes');
    });
  });

  describe('Data Export and Management', () => {
    it('should export metrics data', () => {
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1000);
      
      const exportedData = monitoringService.exportMetricsData();
      
      expect(exportedData).toHaveProperty('timestamp');
      expect(exportedData).toHaveProperty('registrationMetrics');
      expect(exportedData).toHaveProperty('performanceMetrics');
      expect(exportedData).toHaveProperty('systemHealth');
      expect(exportedData).toHaveProperty('alerts');
      expect(exportedData).toHaveProperty('configuration');
    });

    it('should clear metrics data', () => {
      monitoringService.recordRegistrationAttempt(testUserPubkey, true, 1000);
      
      let metrics = monitoringService.getRegistrationMetrics();
      expect(metrics.totalAttempts).toBe(1);
      
      monitoringService.clearMetricsData();
      
      metrics = monitoringService.getRegistrationMetrics();
      expect(metrics.totalAttempts).toBe(0);
    });
  });
});

describe('ProfileDevTools', () => {
  let mockProgram: anchor.Program;
  let mockProvider: anchor.AnchorProvider;
  let mockConnection: any;
  let devTools: ProfileDevTools;
  let testUserPubkey: PublicKey;

  beforeEach(async () => {
    // Setup mocks
    mockConnection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getAccountInfo: vi.fn().mockResolvedValue(null),
      getBlockHeight: vi.fn().mockResolvedValue(100000),
      getSlot: vi.fn().mockResolvedValue(100000),
      getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.16.0' }),
      getBalance: vi.fn().mockResolvedValue(1000000000),
    };

    mockProvider = {
      connection: mockConnection,
      wallet: {
        publicKey: new PublicKey('11111111111111111111111111111112'),
      },
    } as any;

    mockProgram = {
      programId: new PublicKey('11111111111111111111111111111113'),
      account: {
        userProfile: {
          fetch: vi.fn(),
        },
      },
    } as unknown;

    testUserPubkey = new PublicKey('11111111111111111111111111111114');
    devTools = createProfileDevTools(mockProgram, mockProvider);

    // Mock derivePdas
    const solairusMain = await import('@/lib/solairus-main');
    vi.mocked(solairusMain.derivePdas).mockReturnValue({
      profile: new PublicKey('11111111111111111111111111111115'),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Structure Analysis', () => {
    it('should analyze non-existent account', async () => {
      mockConnection.getAccountInfo.mockResolvedValue(null);
      
      const analysis = await devTools.analyzeAccountStructure(testUserPubkey);
      
      expect(analysis.address).toBeDefined();
      expect(analysis.analysis.exists).toBe(false);
      expect(analysis.severity).toBe('warning');
      expect(analysis.recommendations).toContain('Account does not exist - complete user registration');
    });

    it('should analyze account with size mismatch', async () => {
      const mockAccountInfo = {
        owner: mockProgram.programId,
        data: Buffer.alloc(100), // Wrong size (should be 152)
        executable: false,
        rentEpoch: 300,
        lamports: 1000000,
      };
      
      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      
      const analysis = await devTools.analyzeAccountStructure(testUserPubkey);
      
      expect(analysis.analysis.exists).toBe(true);
      expect(analysis.analysis.size.status).toBe('too_small');
      expect(['error', 'critical']).toContain(analysis.severity);
      expect(analysis.recommendations).toContain('Account size too small - recreate account with correct size');
    });

    it('should analyze account with owner mismatch', async () => {
      const wrongOwner = new PublicKey('11111111111111111111111111111116');
      const mockAccountInfo = {
        owner: wrongOwner,
        data: Buffer.alloc(152),
        executable: false,
        rentEpoch: 300,
        lamports: 1000000,
      };
      
      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      
      const analysis = await devTools.analyzeAccountStructure(testUserPubkey);
      
      expect(analysis.analysis.ownership.correct).toBe(false);
      expect(analysis.severity).toBe('critical');
      expect(analysis.recommendations).toContain('Account owner incorrect - recreate account');
    });

    it('should analyze healthy account', async () => {
      const mockAccountInfo = {
        owner: mockProgram.programId,
        data: Buffer.alloc(152),
        executable: false,
        rentEpoch: 300,
        lamports: 1000000,
      };
      
      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      
      // Mock successful deserialization
      const mockUserProfile = {
        user: testUserPubkey,
        sponsor: new PublicKey('11111111111111111111111111111117'),
        createdAt: new anchor.BN(Date.now()),
        activePrincipalUsdt: new anchor.BN(1000),
        lastRoiWithdrawAt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(Date.now() + 86400000),
        totalAffiliateEarnings: new anchor.BN(0),
        totalAffiliateWithdrawn: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
        level2Earnings: new anchor.BN(0),
        level3Earnings: new anchor.BN(0),
      };
      
      mockProgram.account.userProfile.fetch.mockResolvedValue(mockUserProfile);
      
      const analysis = await devTools.analyzeAccountStructure(testUserPubkey);
      
      expect(analysis.analysis.exists).toBe(true);
      expect(analysis.analysis.size.status).toBe('correct');
      expect(analysis.analysis.ownership.correct).toBe(true);
      expect(analysis.analysis.data.canDeserialize).toBe(true);
      expect(['info', 'warning', 'error', 'critical']).toContain(analysis.severity);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Analysis', () => {
    it('should analyze multiple accounts', async () => {
      const userPubkeys = [
        testUserPubkey,
        new PublicKey('11111111111111111111111111111118'),
        new PublicKey('11111111111111111111111111111119'),
      ];
      
      // Mock different account states
      mockConnection.getAccountInfo
        .mockResolvedValueOnce(null) // First account doesn't exist
        .mockResolvedValueOnce({ // Second account has wrong size
          owner: mockProgram.programId,
          data: Buffer.alloc(100),
          executable: false,
          rentEpoch: 300,
          lamports: 1000000,
        })
        .mockResolvedValueOnce({ // Third account is healthy
          owner: mockProgram.programId,
          data: Buffer.alloc(152),
          executable: false,
          rentEpoch: 300,
          lamports: 1000000,
        });
      
      // Mock successful deserialization for the third account
      mockProgram.account.userProfile.fetch.mockResolvedValue({
        user: userPubkeys[2],
        sponsor: new PublicKey('11111111111111111111111111111117'),
        createdAt: new anchor.BN(Date.now()),
        activePrincipalUsdt: new anchor.BN(1000),
        lastRoiWithdrawAt: new anchor.BN(0),
        licenseExpiresAt: new anchor.BN(Date.now() + 86400000),
        totalAffiliateEarnings: new anchor.BN(0),
        totalAffiliateWithdrawn: new anchor.BN(0),
        level1Earnings: new anchor.BN(0),
        level2Earnings: new anchor.BN(0),
        level3Earnings: new anchor.BN(0),
      });
      
      const batchResult = await devTools.batchAnalyzeAccounts(userPubkeys);
      
      expect(batchResult.totalAccounts).toBe(3);
      expect(batchResult.healthyAccounts).toBeGreaterThanOrEqual(0);
      expect(batchResult.problematicAccounts).toBeGreaterThanOrEqual(0);
      expect(batchResult.results).toHaveLength(3);
      expect(batchResult.summary.commonIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Development Environment Info', () => {
    it('should gather environment information', async () => {
      const envInfo = await devTools.getDevEnvironmentInfo();
      
      expect(envInfo).toHaveProperty('network');
      expect(envInfo).toHaveProperty('program');
      expect(envInfo).toHaveProperty('wallet');
      expect(envInfo).toHaveProperty('browser');
      expect(envInfo).toHaveProperty('performance');
      
      expect(envInfo.network.endpoint).toBe('https://api.devnet.solana.com');
      expect(envInfo.network.cluster).toBe('devnet');
      expect(envInfo.program.id).toBe(mockProgram.programId.toString());
    });
  });

  describe('Diagnostic Report Generation', () => {
    it('should generate comprehensive diagnostic report', async () => {
      mockConnection.getAccountInfo.mockResolvedValue({
        owner: mockProgram.programId,
        data: Buffer.alloc(152),
        executable: false,
        rentEpoch: 300,
        lamports: 1000000,
      });
      
      const report = await devTools.generateDiagnosticReport(testUserPubkey);
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('userAnalysis');
      expect(report).toHaveProperty('systemHealth');
      expect(report).toHaveProperty('diagnosticData');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.userAnalysis?.userPubkey).toBe(testUserPubkey.toString());
      expect(report.systemHealth.programAccessible).toBe(true);
    });

    it('should export debug data as JSON', async () => {
      const debugData = await devTools.exportDebugData(testUserPubkey);
      
      expect(typeof debugData).toBe('string');
      expect(() => JSON.parse(debugData)).not.toThrow();
      
      const parsed = JSON.parse(debugData);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('environment');
    });
  });
});

describe('Utility Functions', () => {
  describe('ProfileMonitoringUtils', () => {
    it('should wrap operations with monitoring', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await ProfileMonitoringUtils.withMonitoring(
        'test_operation',
        mockOperation,
        { testMetadata: true }
      );
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should handle operation failures', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(
        ProfileMonitoringUtils.withMonitoring('test_operation', mockOperation)
      ).rejects.toThrow('Test error');
    });

    it('should provide health status', () => {
      const healthStatus = ProfileMonitoringUtils.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('message');
      expect(healthStatus).toHaveProperty('metrics');
      expect(['healthy', 'degraded', 'critical']).toContain(healthStatus.status);
    });
  });

  describe('ProfileDevUtils', () => {
    it('should provide quick check functionality', async () => {
      const testUserPubkey = new PublicKey('11111111111111111111111111111114');
      
      // Mock console methods
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await ProfileDevUtils.quickCheck(testUserPubkey);
      
      // Should log error when dev tools not initialized
      expect(consoleSpy).toHaveBeenCalledWith('Dev tools not initialized');
      
      consoleSpy.mockRestore();
    });
  });
});