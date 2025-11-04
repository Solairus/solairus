/**
 * Profile Monitoring and Metrics Collection
 * 
 * Comprehensive monitoring system for profile operations with metrics collection,
 * performance tracking, and registration success/failure rate monitoring.
 * 
 * Requirements: 2.1, 2.3
 */

import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getErrorMessage } from "@/lib/solairus-removed";
import { 
  ProfileErrorContext, 
  EnhancedProfileError,
  ProfileErrorFormatter 
} from "./profile-error-types";

/**
 * Registration metrics and statistics
 */
export interface RegistrationMetrics {
  totalAttempts: number;
  successfulRegistrations: number;
  failedRegistrations: number;
  successRate: number;
  averageRegistrationTime: number;
  errorBreakdown: Record<string, number>;
  performanceMetrics: {
    averageValidationTime: number;
    averageRecoveryTime: number;
    averageNetworkLatency: number;
  };
  timeSeriesData: RegistrationTimeSeriesPoint[];
}

export interface RegistrationTimeSeriesPoint {
  timestamp: number;
  attempts: number;
  successes: number;
  failures: number;
  averageTime: number;
  errorTypes: string[];
}

/**
 * Performance metrics for profile operations
 */
export interface PerformanceMetrics {
  operationType: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  networkLatency?: number;
  accountSize?: number;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * System health indicators
 */
export interface SystemHealthMetrics {
  timestamp: number;
  rpcEndpoint: string;
  networkLatency: number;
  blockHeight?: number;
  programResponsive: boolean;
  errorRate: number;
  activeOperations: number;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Alert configuration for monitoring
 */
export interface AlertConfig {
  errorRateThreshold: number; // Percentage
  latencyThreshold: number; // Milliseconds
  failureCountThreshold: number;
  timeWindowMinutes: number;
  enabled: boolean;
}

/**
 * Alert event
 */
export interface AlertEvent {
  id: string;
  type: 'error_rate' | 'high_latency' | 'failure_spike' | 'system_health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: number;
}

/**
 * Profile Monitoring Service
 */
export class ProfileMonitoringService {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private metrics: PerformanceMetrics[] = [];
  private registrationMetrics: RegistrationMetrics;
  private systemHealth: SystemHealthMetrics[] = [];
  private alerts: AlertEvent[] = [];
  private alertConfig: AlertConfig;
  private maxMetricsHistory = 10000;
  private maxHealthHistory = 1000;
  private maxAlerts = 500;

  constructor(program: anchor.Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
    
    this.registrationMetrics = {
      totalAttempts: 0,
      successfulRegistrations: 0,
      failedRegistrations: 0,
      successRate: 0,
      averageRegistrationTime: 0,
      errorBreakdown: {},
      performanceMetrics: {
        averageValidationTime: 0,
        averageRecoveryTime: 0,
        averageNetworkLatency: 0,
      },
      timeSeriesData: [],
    };

    this.alertConfig = {
      errorRateThreshold: 25, // 25% error rate threshold
      latencyThreshold: 5000, // 5 second latency threshold
      failureCountThreshold: 10, // 10 failures in time window
      timeWindowMinutes: 15, // 15 minute time window
      enabled: true,
    };

    // Start periodic health checks in development
    if (this.isDevelopment()) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Record registration attempt
   */
  recordRegistrationAttempt(
    userPubkey: PublicKey,
    success: boolean,
    duration: number,
    error?: EnhancedProfileError
  ): void {
    this.registrationMetrics.totalAttempts++;
    
    if (success) {
      this.registrationMetrics.successfulRegistrations++;
    } else {
      this.registrationMetrics.failedRegistrations++;
      
      // Track error types
      if (error) {
        const errorType = error.type || 'unknown';
        this.registrationMetrics.errorBreakdown[errorType] = 
          (this.registrationMetrics.errorBreakdown[errorType] || 0) + 1;
      }
    }

    // Update success rate
    this.registrationMetrics.successRate = 
      (this.registrationMetrics.successfulRegistrations / this.registrationMetrics.totalAttempts) * 100;

    // Update average registration time
    const totalTime = (this.registrationMetrics.averageRegistrationTime * (this.registrationMetrics.totalAttempts - 1)) + duration;
    this.registrationMetrics.averageRegistrationTime = totalTime / this.registrationMetrics.totalAttempts;

    // Add to time series data
    this.addTimeSeriesPoint(success, duration, error?.type);

    // Check for alerts
    this.checkAlerts();

    // Log metrics in development
    if (this.isDevelopment()) {
      console.log('[ProfileMonitoring] Registration recorded:', {
        userPubkey: userPubkey.toString(),
        success,
        duration,
        totalAttempts: this.registrationMetrics.totalAttempts,
        successRate: this.registrationMetrics.successRate.toFixed(2) + '%',
      });
    }
  }

  /**
   * Record performance metrics for any operation
   */
  recordPerformanceMetric(metric: Omit<PerformanceMetrics, 'endTime' | 'duration'>): string {
    const id = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const performanceMetric: PerformanceMetrics = {
      ...metric,
      endTime: Date.now(),
      duration: Date.now() - metric.startTime,
    };

    this.metrics.push(performanceMetric);

    // Trim metrics if exceeding max history
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Update aggregated performance metrics
    this.updateAggregatedMetrics(performanceMetric);

    return id;
  }

  /**
   * Start performance measurement for an operation
   */
  startPerformanceMeasurement(
    operationType: string,
    metadata?: Record<string, unknown>
  ): {
    complete: (success: boolean, errorType?: string, additionalMetadata?: Record<string, unknown>) => void;
  } {
    const startTime = Date.now();
    
    return {
      complete: (success: boolean, errorType?: string, additionalMetadata?: Record<string, unknown>) => {
        this.recordPerformanceMetric({
          operationType,
          startTime,
          success,
          errorType,
          retryCount: 0,
          metadata: { ...metadata, ...additionalMetadata },
        });
      },
    };
  }

  /**
   * Get current registration metrics
   */
  getRegistrationMetrics(): RegistrationMetrics {
    return { ...this.registrationMetrics };
  }

  /**
   * Get performance metrics for specific operation type
   */
  getPerformanceMetrics(
    operationType?: string,
    timeRangeMinutes?: number
  ): PerformanceMetrics[] {
    let filteredMetrics = this.metrics;

    if (operationType) {
      filteredMetrics = filteredMetrics.filter(m => m.operationType === operationType);
    }

    if (timeRangeMinutes) {
      const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
      filteredMetrics = filteredMetrics.filter(m => m.startTime >= cutoffTime);
    }

    return filteredMetrics;
  }

  /**
   * Get system health metrics
   */
  getSystemHealthMetrics(timeRangeMinutes?: number): SystemHealthMetrics[] {
    if (!timeRangeMinutes) {
      return [...this.systemHealth];
    }

    const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
    return this.systemHealth.filter(h => h.timestamp >= cutoffTime);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): AlertEvent[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(timeRangeMinutes?: number): AlertEvent[] {
    if (!timeRangeMinutes) {
      return [...this.alerts];
    }

    const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoffTime);
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Generate monitoring report
   */
  generateMonitoringReport(timeRangeMinutes: number = 60): {
    summary: {
      timeRange: string;
      totalOperations: number;
      successRate: number;
      averageLatency: number;
      errorRate: number;
    };
    registrationMetrics: RegistrationMetrics;
    topErrors: Array<{ type: string; count: number; percentage: number }>;
    performanceTrends: {
      operationType: string;
      averageTime: number;
      successRate: number;
      count: number;
    }[];
    systemHealth: {
      current: SystemHealthMetrics | null;
      average: {
        networkLatency: number;
        errorRate: number;
      };
    };
    alerts: {
      active: number;
      resolved: number;
      critical: number;
    };
  } {
    const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.startTime >= cutoffTime);
    const recentHealth = this.systemHealth.filter(h => h.timestamp >= cutoffTime);
    const recentAlerts = this.alerts.filter(a => a.timestamp >= cutoffTime);

    // Calculate summary statistics
    const totalOperations = recentMetrics.length;
    const successfulOperations = recentMetrics.filter(m => m.success).length;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;
    const averageLatency = totalOperations > 0 
      ? recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalOperations 
      : 0;
    const errorRate = 100 - successRate;

    // Top errors
    const errorCounts: Record<string, number> = {};
    recentMetrics.filter(m => !m.success && m.errorType).forEach(m => {
      errorCounts[m.errorType!] = (errorCounts[m.errorType!] || 0) + 1;
    });

    const topErrors = Object.entries(errorCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalOperations) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Performance trends by operation type
    const operationGroups: Record<string, PerformanceMetrics[]> = {};
    recentMetrics.forEach(m => {
      if (!operationGroups[m.operationType]) {
        operationGroups[m.operationType] = [];
      }
      operationGroups[m.operationType].push(m);
    });

    const performanceTrends = Object.entries(operationGroups).map(([operationType, metrics]) => ({
      operationType,
      averageTime: metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length,
      successRate: (metrics.filter(m => m.success).length / metrics.length) * 100,
      count: metrics.length,
    }));

    // System health summary
    const currentHealth = recentHealth.length > 0 ? recentHealth[recentHealth.length - 1] : null;
    const averageNetworkLatency = recentHealth.length > 0
      ? recentHealth.reduce((sum, h) => sum + h.networkLatency, 0) / recentHealth.length
      : 0;
    const averageErrorRate = recentHealth.length > 0
      ? recentHealth.reduce((sum, h) => sum + h.errorRate, 0) / recentHealth.length
      : 0;

    // Alert summary
    const activeAlerts = recentAlerts.filter(a => !a.resolved).length;
    const resolvedAlerts = recentAlerts.filter(a => a.resolved).length;
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical').length;

    return {
      summary: {
        timeRange: `${timeRangeMinutes} minutes`,
        totalOperations,
        successRate: Math.round(successRate * 100) / 100,
        averageLatency: Math.round(averageLatency),
        errorRate: Math.round(errorRate * 100) / 100,
      },
      registrationMetrics: this.getRegistrationMetrics(),
      topErrors,
      performanceTrends,
      systemHealth: {
        current: currentHealth,
        average: {
          networkLatency: Math.round(averageNetworkLatency),
          errorRate: Math.round(averageErrorRate * 100) / 100,
        },
      },
      alerts: {
        active: activeAlerts,
        resolved: resolvedAlerts,
        critical: criticalAlerts,
      },
    };
  }

  /**
   * Export metrics data for analysis
   */
  exportMetricsData(): {
    timestamp: number;
    registrationMetrics: RegistrationMetrics;
    performanceMetrics: PerformanceMetrics[];
    systemHealth: SystemHealthMetrics[];
    alerts: AlertEvent[];
    configuration: {
      alertConfig: AlertConfig;
      maxMetricsHistory: number;
      environment: string;
    };
  } {
    return {
      timestamp: Date.now(),
      registrationMetrics: this.getRegistrationMetrics(),
      performanceMetrics: [...this.metrics],
      systemHealth: [...this.systemHealth],
      alerts: [...this.alerts],
      configuration: {
        alertConfig: { ...this.alertConfig },
        maxMetricsHistory: this.maxMetricsHistory,
        environment: this.getEnvironment(),
      },
    };
  }

  /**
   * Clear metrics data
   */
  clearMetricsData(): void {
    this.metrics = [];
    this.systemHealth = [];
    this.alerts = [];
    this.registrationMetrics = {
      totalAttempts: 0,
      successfulRegistrations: 0,
      failedRegistrations: 0,
      successRate: 0,
      averageRegistrationTime: 0,
      errorBreakdown: {},
      performanceMetrics: {
        averageValidationTime: 0,
        averageRecoveryTime: 0,
        averageNetworkLatency: 0,
      },
      timeSeriesData: [],
    };
  }

  // Private helper methods

  private addTimeSeriesPoint(success: boolean, duration: number, errorType?: string): void {
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minute windows
    const windowStart = Math.floor(now / timeWindow) * timeWindow;

    let existingPoint = this.registrationMetrics.timeSeriesData.find(
      point => point.timestamp === windowStart
    );

    if (!existingPoint) {
      existingPoint = {
        timestamp: windowStart,
        attempts: 0,
        successes: 0,
        failures: 0,
        averageTime: 0,
        errorTypes: [],
      };
      this.registrationMetrics.timeSeriesData.push(existingPoint);
    }

    existingPoint.attempts++;
    if (success) {
      existingPoint.successes++;
    } else {
      existingPoint.failures++;
      if (errorType && !existingPoint.errorTypes.includes(errorType)) {
        existingPoint.errorTypes.push(errorType);
      }
    }

    // Update average time
    const totalTime = (existingPoint.averageTime * (existingPoint.attempts - 1)) + duration;
    existingPoint.averageTime = totalTime / existingPoint.attempts;

    // Keep only last 24 hours of time series data
    const cutoffTime = now - (24 * 60 * 60 * 1000);
    this.registrationMetrics.timeSeriesData = this.registrationMetrics.timeSeriesData
      .filter(point => point.timestamp >= cutoffTime);
  }

  private updateAggregatedMetrics(metric: PerformanceMetrics): void {
    if (metric.operationType === 'validation' && metric.duration) {
      const validationMetrics = this.metrics.filter(m => m.operationType === 'validation');
      const totalTime = validationMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
      this.registrationMetrics.performanceMetrics.averageValidationTime = 
        totalTime / validationMetrics.length;
    }

    if (metric.operationType === 'recovery' && metric.duration) {
      const recoveryMetrics = this.metrics.filter(m => m.operationType === 'recovery');
      const totalTime = recoveryMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
      this.registrationMetrics.performanceMetrics.averageRecoveryTime = 
        totalTime / recoveryMetrics.length;
    }

    if (metric.networkLatency) {
      const metricsWithLatency = this.metrics.filter(m => m.networkLatency);
      const totalLatency = metricsWithLatency.reduce((sum, m) => sum + (m.networkLatency || 0), 0);
      this.registrationMetrics.performanceMetrics.averageNetworkLatency = 
        totalLatency / metricsWithLatency.length;
    }
  }

  private checkAlerts(): void {
    if (!this.alertConfig.enabled) return;

    const timeWindow = this.alertConfig.timeWindowMinutes * 60 * 1000;
    const cutoffTime = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.startTime >= cutoffTime);

    // Check error rate
    if (recentMetrics.length > 0) {
      const errorRate = (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100;
      if (errorRate > this.alertConfig.errorRateThreshold) {
        this.createAlert('error_rate', 'high', 
          `Error rate (${errorRate.toFixed(1)}%) exceeds threshold (${this.alertConfig.errorRateThreshold}%)`,
          { errorRate, threshold: this.alertConfig.errorRateThreshold }
        );
      }
    }

    // Check latency
    const recentLatencies = recentMetrics
      .filter(m => m.duration)
      .map(m => m.duration!);
    
    if (recentLatencies.length > 0) {
      const averageLatency = recentLatencies.reduce((sum, l) => sum + l, 0) / recentLatencies.length;
      if (averageLatency > this.alertConfig.latencyThreshold) {
        this.createAlert('high_latency', 'medium',
          `Average latency (${averageLatency.toFixed(0)}ms) exceeds threshold (${this.alertConfig.latencyThreshold}ms)`,
          { averageLatency, threshold: this.alertConfig.latencyThreshold }
        );
      }
    }

    // Check failure spike
    const recentFailures = recentMetrics.filter(m => !m.success).length;
    if (recentFailures > this.alertConfig.failureCountThreshold) {
      this.createAlert('failure_spike', 'high',
        `Failure count (${recentFailures}) exceeds threshold (${this.alertConfig.failureCountThreshold}) in ${this.alertConfig.timeWindowMinutes} minutes`,
        { failureCount: recentFailures, threshold: this.alertConfig.failureCountThreshold }
      );
    }
  }

  private createAlert(
    type: AlertEvent['type'],
    severity: AlertEvent['severity'],
    message: string,
    metrics: Record<string, unknown>
  ): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(alert => 
      alert.type === type && 
      !alert.resolved && 
      (Date.now() - alert.timestamp) < (this.alertConfig.timeWindowMinutes * 60 * 1000)
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: AlertEvent = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      metrics,
      resolved: false,
    };

    this.alerts.push(alert);

    // Trim alerts if exceeding max
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Log alert in development
    if (this.isDevelopment()) {
      console.warn('[ProfileMonitoring] Alert created:', alert);
    }
  }

  private async startHealthMonitoring(): Promise<void> {
    const checkHealth = async () => {
      try {
        const startTime = Date.now();
        const [blockHeight] = await Promise.all([
          this.provider.connection.getBlockHeight().catch(() => undefined),
        ]);
        const networkLatency = Date.now() - startTime;

        // Test program responsiveness
        let programResponsive = true;
        try {
          await this.provider.connection.getAccountInfo(this.program.programId);
        } catch {
          programResponsive = false;
        }

        // Calculate recent error rate
        const recentMetrics = this.metrics.filter(m => 
          m.startTime >= Date.now() - (15 * 60 * 1000) // Last 15 minutes
        );
        const errorRate = recentMetrics.length > 0 
          ? (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100 
          : 0;

        const healthMetric: SystemHealthMetrics = {
          timestamp: Date.now(),
          rpcEndpoint: this.provider.connection.rpcEndpoint,
          networkLatency,
          blockHeight,
          programResponsive,
          errorRate,
          activeOperations: this.getActiveOperationsCount(),
        };

        // Add memory usage if available
        if (typeof performance !== 'undefined' && typeof (performance as unknown as { memory?: unknown }).memory !== 'undefined') {
          const memory = (performance as unknown as { memory: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
          } }).memory;
          healthMetric.memoryUsage = {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
          };
        }

        this.systemHealth.push(healthMetric);

        // Trim health history
        if (this.systemHealth.length > this.maxHealthHistory) {
          this.systemHealth = this.systemHealth.slice(-this.maxHealthHistory);
        }

        // Check system health alerts
        if (!programResponsive || networkLatency > 10000 || errorRate > 50) {
          this.createAlert('system_health', 'critical',
            `System health degraded: Program responsive: ${programResponsive}, Latency: ${networkLatency}ms, Error rate: ${errorRate.toFixed(1)}%`,
            { programResponsive, networkLatency, errorRate }
          );
        }

      } catch (error) {
        console.warn('[ProfileMonitoring] Health check failed:', getErrorMessage(error));
      }
    };

    // Initial health check
    await checkHealth();

    // DISABLED: Periodic health checks to prevent rate limits
    // setInterval(checkHealth, 5 * 60 * 1000);
  }

  private getActiveOperationsCount(): number {
    // This would track active operations in a real implementation
    // For now, return 0 as a placeholder
    return 0;
  }

  private isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
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
 * Factory function to create ProfileMonitoringService
 */
export function createProfileMonitoringService(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): ProfileMonitoringService {
  return new ProfileMonitoringService(program, provider);
}

/**
 * Global monitoring instance for easy access
 */
let globalMonitoringService: ProfileMonitoringService | null = null;

export function initializeGlobalMonitoring(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): void {
  globalMonitoringService = new ProfileMonitoringService(program, provider);
}

export function getGlobalMonitoring(): ProfileMonitoringService | null {
  return globalMonitoringService;
}

/**
 * Utility functions for monitoring operations
 */
export const ProfileMonitoringUtils = {
  /**
   * Wrap any async operation with monitoring
   */
  withMonitoring: async <T>(
    operationType: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> => {
    const monitoring = getGlobalMonitoring();
    if (!monitoring) {
      return operation();
    }

    const measurement = monitoring.startPerformanceMeasurement(operationType, metadata);
    
    try {
      const result = await operation();
      measurement.complete(true, undefined, { resultType: typeof result });
      return result;
    } catch (error) {
      const errorType = error instanceof Error ? error.constructor.name : 'unknown';
      measurement.complete(false, errorType, { error: getErrorMessage(error) });
      throw error;
    }
  },

  /**
   * Record registration outcome
   */
  recordRegistration: (
    userPubkey: PublicKey,
    success: boolean,
    duration: number,
    error?: EnhancedProfileError
  ): void => {
    const monitoring = getGlobalMonitoring();
    if (monitoring) {
      monitoring.recordRegistrationAttempt(userPubkey, success, duration, error);
    }
  },

  /**
   * Get quick health status
   */
  getHealthStatus: (): {
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
    metrics: {
      successRate: number;
      averageLatency: number;
      activeAlerts: number;
    };
  } => {
    const monitoring = getGlobalMonitoring();
    if (!monitoring) {
      return {
        status: 'critical',
        message: 'Monitoring not initialized',
        metrics: { successRate: 0, averageLatency: 0, activeAlerts: 0 },
      };
    }

    const registrationMetrics = monitoring.getRegistrationMetrics();
    const activeAlerts = monitoring.getActiveAlerts();
    const recentHealth = monitoring.getSystemHealthMetrics(15); // Last 15 minutes

    const averageLatency = recentHealth.length > 0
      ? recentHealth.reduce((sum, h) => sum + h.networkLatency, 0) / recentHealth.length
      : 0;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'System operating normally';

    if (activeAlerts.some(a => a.severity === 'critical')) {
      status = 'critical';
      message = 'Critical issues detected';
    } else if (registrationMetrics.successRate < 90 || averageLatency > 5000 || activeAlerts.length > 0) {
      status = 'degraded';
      message = 'Performance degraded';
    }

    return {
      status,
      message,
      metrics: {
        successRate: registrationMetrics.successRate,
        averageLatency,
        activeAlerts: activeAlerts.length,
      },
    };
  },
};