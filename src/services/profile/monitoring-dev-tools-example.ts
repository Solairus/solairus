/**
 * Example Usage of Profile Monitoring and Development Tools
 * 
 * This file demonstrates how to use the monitoring and diagnostic tools
 * for profile account operations in development and production environments.
 */

import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  ProfileMonitoringService,
  ProfileDevTools,
  ProfileMonitoringUtils,
  ProfileDevUtils,
  initializeGlobalMonitoring,
  initializeGlobalDevTools,
  getGlobalMonitoring,
  getGlobalDevTools,
} from './index';

/**
 * Initialize monitoring and dev tools for a program
 */
export async function initializeProfileTools(
  program: anchor.Program,
  provider: anchor.AnchorProvider
): Promise<{
  monitoring: ProfileMonitoringService;
  devTools: ProfileDevTools;
}> {
  // Initialize global instances
  initializeGlobalMonitoring(program, provider);
  initializeGlobalDevTools(program, provider);

  const monitoring = getGlobalMonitoring()!;
  const devTools = getGlobalDevTools()!;

  console.log('[ProfileTools] Monitoring and dev tools initialized');
  
  return { monitoring, devTools };
}

/**
 * Example: Monitor a registration operation
 */
export async function monitoredRegistration(
  userPubkey: PublicKey,
  registrationFunction: () => Promise<string>
): Promise<string> {
  return ProfileMonitoringUtils.withMonitoring(
    'user_registration',
    async () => {
      const startTime = Date.now();
      
      try {
        const result = await registrationFunction();
        const duration = Date.now() - startTime;
        
        // Record successful registration
        ProfileMonitoringUtils.recordRegistration(userPubkey, true, duration);
        
        console.log(`[ProfileTools] Registration successful for ${userPubkey.toString()} in ${duration}ms`);
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record failed registration
        ProfileMonitoringUtils.recordRegistration(userPubkey, false, duration, error as any);
        
        console.error(`[ProfileTools] Registration failed for ${userPubkey.toString()} after ${duration}ms:`, error);
        throw error;
      }
    },
    { userPubkey: userPubkey.toString() }
  );
}

/**
 * Example: Debug account issues
 */
export async function debugAccountIssues(userPubkey: PublicKey): Promise<void> {
  const devTools = getGlobalDevTools();
  if (!devTools) {
    console.error('[ProfileTools] Dev tools not initialized');
    return;
  }

  console.log(`[ProfileTools] Starting debug session for ${userPubkey.toString()}`);
  
  try {
    // Quick check first
    await ProfileDevUtils.quickCheck(userPubkey);
    
    // Full debug analysis
    const debugResult = await devTools.debugAccount(userPubkey);
    
    console.log('[ProfileTools] Debug analysis completed:');
    console.log('- Structure Analysis:', debugResult.structureAnalysis.severity);
    console.log('- Validation Result:', debugResult.validationResult.isValid ? 'VALID' : 'INVALID');
    console.log('- PDA Derivation:', debugResult.pdaDiagnostic.derivationResult.success ? 'SUCCESS' : 'FAILED');
    console.log('- Account Exists:', debugResult.accountInspection.exists);
    
    if (debugResult.recoveryOptions) {
      console.log('- Recovery Available:', debugResult.recoveryOptions.success);
    }
    
    // Show recommendations
    if (debugResult.structureAnalysis.recommendations.length > 0) {
      console.log('[ProfileTools] Recommendations:');
      debugResult.structureAnalysis.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('[ProfileTools] Debug session failed:', error);
  }
}

/**
 * Example: Generate monitoring report
 */
export async function generateSystemReport(): Promise<void> {
  const monitoring = getGlobalMonitoring();
  if (!monitoring) {
    console.error('[ProfileTools] Monitoring not initialized');
    return;
  }

  console.log('[ProfileTools] Generating system monitoring report...');
  
  const report = monitoring.generateMonitoringReport(60); // Last 60 minutes
  
  console.log('\n=== SYSTEM MONITORING REPORT ===');
  console.log(`Time Range: ${report.summary.timeRange}`);
  console.log(`Total Operations: ${report.summary.totalOperations}`);
  console.log(`Success Rate: ${report.summary.successRate}%`);
  console.log(`Average Latency: ${report.summary.averageLatency}ms`);
  console.log(`Error Rate: ${report.summary.errorRate}%`);
  
  console.log('\n--- Registration Metrics ---');
  console.log(`Total Attempts: ${report.registrationMetrics.totalAttempts}`);
  console.log(`Successful: ${report.registrationMetrics.successfulRegistrations}`);
  console.log(`Failed: ${report.registrationMetrics.failedRegistrations}`);
  console.log(`Success Rate: ${report.registrationMetrics.successRate.toFixed(2)}%`);
  
  if (report.topErrors.length > 0) {
    console.log('\n--- Top Errors ---');
    report.topErrors.slice(0, 5).forEach((error, index) => {
      console.log(`${index + 1}. ${error.type}: ${error.count} (${error.percentage.toFixed(1)}%)`);
    });
  }
  
  if (report.alerts.active > 0) {
    console.log(`\n⚠️  Active Alerts: ${report.alerts.active}`);
    if (report.alerts.critical > 0) {
      console.log(`🚨 Critical Alerts: ${report.alerts.critical}`);
    }
  }
  
  console.log('\n--- System Health ---');
  if (report.systemHealth.current) {
    console.log(`Network Latency: ${report.systemHealth.current.networkLatency}ms`);
    console.log(`Program Responsive: ${report.systemHealth.current.programResponsive}`);
    console.log(`Error Rate: ${report.systemHealth.current.errorRate.toFixed(2)}%`);
  }
  
  console.log('=== END REPORT ===\n');
}

/**
 * Example: Batch analyze multiple accounts
 */
export async function batchAnalyzeAccounts(userPubkeys: PublicKey[]): Promise<void> {
  const devTools = getGlobalDevTools();
  if (!devTools) {
    console.error('[ProfileTools] Dev tools not initialized');
    return;
  }

  console.log(`[ProfileTools] Starting batch analysis of ${userPubkeys.length} accounts...`);
  
  try {
    const batchResult = await devTools.batchAnalyzeAccounts(userPubkeys);
    
    console.log('\n=== BATCH ANALYSIS RESULTS ===');
    console.log(`Total Accounts: ${batchResult.totalAccounts}`);
    console.log(`Healthy Accounts: ${batchResult.healthyAccounts}`);
    console.log(`Problematic Accounts: ${batchResult.problematicAccounts}`);
    
    if (batchResult.summary.commonIssues.length > 0) {
      console.log('\n--- Common Issues ---');
      batchResult.summary.commonIssues.slice(0, 5).forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.issue} (${issue.count} accounts, ${issue.percentage.toFixed(1)}%)`);
      });
    }
    
    console.log('\n--- Severity Breakdown ---');
    Object.entries(batchResult.summary.severityBreakdown).forEach(([severity, count]) => {
      console.log(`${severity}: ${count} accounts`);
    });
    
    if (batchResult.summary.recommendations.length > 0) {
      console.log('\n--- Recommendations ---');
      batchResult.summary.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    console.log('=== END BATCH ANALYSIS ===\n');
    
  } catch (error) {
    console.error('[ProfileTools] Batch analysis failed:', error);
  }
}

/**
 * Example: Export diagnostic data for support
 */
export async function exportDiagnosticData(userPubkey?: PublicKey): Promise<void> {
  const devTools = getGlobalDevTools();
  if (!devTools) {
    console.error('[ProfileTools] Dev tools not initialized');
    return;
  }

  try {
    console.log('[ProfileTools] Exporting diagnostic data...');
    
    const diagnosticData = await devTools.exportDebugData(userPubkey);
    
    // In a real application, you might save this to a file or send to support
    console.log('[ProfileTools] Diagnostic data exported successfully');
    console.log('Data size:', diagnosticData.length, 'characters');
    
    // Copy to clipboard if available
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(diagnosticData);
      console.log('[ProfileTools] Diagnostic data copied to clipboard');
    }
    
  } catch (error) {
    console.error('[ProfileTools] Failed to export diagnostic data:', error);
  }
}

/**
 * Example: Health check and alerting
 */
export function checkSystemHealth(): void {
  const healthStatus = ProfileMonitoringUtils.getHealthStatus();
  
  console.log(`[ProfileTools] System Health: ${healthStatus.status.toUpperCase()}`);
  console.log(`Message: ${healthStatus.message}`);
  console.log(`Success Rate: ${healthStatus.metrics.successRate.toFixed(2)}%`);
  console.log(`Average Latency: ${healthStatus.metrics.averageLatency}ms`);
  console.log(`Active Alerts: ${healthStatus.metrics.activeAlerts}`);
  
  // Take action based on health status
  switch (healthStatus.status) {
    case 'critical':
      console.error('🚨 CRITICAL: Immediate attention required!');
      // In a real app, you might send notifications, trigger alerts, etc.
      break;
    case 'degraded':
      console.warn('⚠️  WARNING: System performance is degraded');
      // In a real app, you might log warnings, notify administrators, etc.
      break;
    case 'healthy':
      console.log('✅ System is operating normally');
      break;
  }
}

/**
 * Example: Development console commands
 * 
 * These functions can be exposed to the browser console for easy debugging
 */
export const DevConsoleCommands = {
  // Quick account check
  check: ProfileDevUtils.quickCheck,
  
  // Full debug analysis
  debug: ProfileDevUtils.debug,
  
  // Export debug data
  export: ProfileDevUtils.exportToClipboard,
  
  // System health check
  health: checkSystemHealth,
  
  // Generate monitoring report
  report: generateSystemReport,
  
  // Custom batch analysis
  batchAnalyze: batchAnalyzeAccounts,
};

// Expose dev commands to window in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).profileDebug = DevConsoleCommands;
  console.log('[ProfileTools] Debug commands available at window.profileDebug');
  console.log('Available commands: check, debug, export, health, report, batchAnalyze');
}

export default {
  initializeProfileTools,
  monitoredRegistration,
  debugAccountIssues,
  generateSystemReport,
  batchAnalyzeAccounts,
  exportDiagnosticData,
  checkSystemHealth,
  DevConsoleCommands,
};