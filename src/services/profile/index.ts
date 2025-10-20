/**
 * Profile Services
 * 
 * Centralized exports for profile-related services and utilities
 */

export {
  ProfileErrorFactory,
  ProfileErrorFormatter,
  ProfileErrorUtils,
  type ProfileError,
  type ProfileErrorType,
  type ErrorSeverity,
  type ProfileErrorTechnicalDetails,
  type ProfileErrorContext,
  type ProfileErrorClassification,
  type ProfileErrorAction,
  type EnhancedProfileError,
} from './profile-error-types';

export {
  EnhancedProfileServiceManager,
  createEnhancedProfileServiceManager,
  ProfileIntegrationUtils,
} from './profile-integration-utils';

export {
  ProfileMonitoringService,
  createProfileMonitoringService,
  initializeGlobalMonitoring,
  getGlobalMonitoring,
  ProfileMonitoringUtils,
  type RegistrationMetrics,
  type PerformanceMetrics,
  type SystemHealthMetrics,
  type AlertConfig,
  type AlertEvent,
  type RegistrationTimeSeriesPoint,
} from './profile-monitoring';

export {
  ProfileDevTools,
  createProfileDevTools,
  initializeGlobalDevTools,
  getGlobalDevTools,
  ProfileDevUtils,
  type AccountStructureAnalysis,
  type FieldAnalysis,
  type BatchAnalysisResult,
  type DevEnvironmentInfo,
} from './profile-dev-tools';