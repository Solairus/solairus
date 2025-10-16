/**
 * License Performance Monitoring
 * Purpose: Track and optimize license operation performance
 * Features:
 * - Operation timing
 * - Cache hit rates
 * - Error tracking
 * - Performance metrics
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  cached?: boolean;
  error?: string;
}

export class LicensePerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS = 100; // Keep last 100 metrics

  /**
   * Start timing an operation
   */
  static startTiming(operation: string): () => void {
    const startTime = performance.now();
    
    return (success: boolean = true, cached: boolean = false, error?: string) => {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        operation,
        duration,
        timestamp: Date.now(),
        success,
        cached,
        error,
      });
    };
  }

  /**
   * Record a performance metric
   */
  private static recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the last MAX_METRICS entries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow operations
    if (metric.duration > 5000) { // 5 seconds
      console.warn(`Slow license operation: ${metric.operation} took ${metric.duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(): {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    cacheHitRate: number;
    slowOperations: number;
    recentErrors: string[];
  } {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        cacheHitRate: 0,
        slowOperations: 0,
        recentErrors: [],
      };
    }

    const totalOperations = this.metrics.length;
    const successfulOps = this.metrics.filter(m => m.success).length;
    const cachedOps = this.metrics.filter(m => m.cached).length;
    const slowOps = this.metrics.filter(m => m.duration > 5000).length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    
    const recentErrors = this.metrics
      .filter(m => !m.success && m.error)
      .slice(-5) // Last 5 errors
      .map(m => m.error!)
      .filter((error, index, arr) => arr.indexOf(error) === index); // Unique errors

    return {
      totalOperations,
      averageDuration: totalDuration / totalOperations,
      successRate: (successfulOps / totalOperations) * 100,
      cacheHitRate: (cachedOps / totalOperations) * 100,
      slowOperations: slowOps,
      recentErrors,
    };
  }

  /**
   * Get metrics for a specific operation
   */
  static getOperationStats(operation: string): {
    count: number;
    averageDuration: number;
    successRate: number;
    lastError?: string;
  } {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        successRate: 0,
      };
    }

    const successfulOps = operationMetrics.filter(m => m.success).length;
    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    const lastError = operationMetrics
      .filter(m => !m.success && m.error)
      .pop()?.error;

    return {
      count: operationMetrics.length,
      averageDuration: totalDuration / operationMetrics.length,
      successRate: (successfulOps / operationMetrics.length) * 100,
      lastError,
    };
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for debugging
   */
  static exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

/**
 * Hook for performance monitoring in components
 */
export function useLicensePerformance() {
  const startTiming = (operation: string) => {
    return LicensePerformanceMonitor.startTiming(operation);
  };

  const getStats = () => {
    return LicensePerformanceMonitor.getStats();
  };

  const getOperationStats = (operation: string) => {
    return LicensePerformanceMonitor.getOperationStats(operation);
  };

  return {
    startTiming,
    getStats,
    getOperationStats,
  };
}

// Development helper to log performance stats
if (process.env.NODE_ENV === 'development') {
  // Log performance stats every 30 seconds in development
  setInterval(() => {
    const stats = LicensePerformanceMonitor.getStats();
    if (stats.totalOperations > 0) {
      console.group('License Performance Stats');
      console.log('Total Operations:', stats.totalOperations);
      console.log('Average Duration:', `${stats.averageDuration.toFixed(2)}ms`);
      console.log('Success Rate:', `${stats.successRate.toFixed(1)}%`);
      console.log('Cache Hit Rate:', `${stats.cacheHitRate.toFixed(1)}%`);
      console.log('Slow Operations:', stats.slowOperations);
      if (stats.recentErrors.length > 0) {
        console.log('Recent Errors:', stats.recentErrors);
      }
      console.groupEnd();
    }
  }, 30000);
}