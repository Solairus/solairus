/**
 * Configuration Module Exports
 * 
 * Centralized exports for all configuration modules
 */

// Agent configuration
export * from './agent-config';

// Service endpoints configuration
export * from './service-endpoints';

// Re-export commonly used types and functions
export type {
  ExtendedTierConfig,
} from './agent-config';

// Configuration constants for easy access
export const CONFIG = {
  // Feature flags
  FEATURES: {
    AGENT_DASHBOARD: import.meta.env.VITE_ENABLE_AGENT_DASHBOARD !== 'false',
    TIER_SELECTION: import.meta.env.VITE_ENABLE_TIER_SELECTION !== 'false',
    WITHDRAWAL_LIMITS: import.meta.env.VITE_ENABLE_WITHDRAWAL_LIMITS !== 'false',
    ERROR_REPORTING: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    MOCK_DATA: import.meta.env.VITE_ENABLE_AGENT_MOCK_DATA === 'true',
    DETAILED_ERRORS: import.meta.env.VITE_SHOW_DETAILED_ERRORS === 'true',
  },
  
  // Intervals (in milliseconds)
  INTERVALS: {
    AGENT_REFRESH: Number(import.meta.env.VITE_AGENT_REFRESH_INTERVAL || 30000),
    WITHDRAWAL_STATUS: Number(import.meta.env.VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL || 5000),
  },
  
  // UI Layout
  UI: {
    CARDS_PER_ROW: {
      MOBILE: Number(import.meta.env.VITE_AGENT_CARDS_MOBILE || 1),
      TABLET: Number(import.meta.env.VITE_AGENT_CARDS_TABLET || 2),
      DESKTOP: Number(import.meta.env.VITE_AGENT_CARDS_DESKTOP || 3),
      WIDE: Number(import.meta.env.VITE_AGENT_CARDS_WIDE || 4),
    },
  },
  
  // Environment
  ENV: {
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,
  CLUSTER: import.meta.env.VITE_SOLANA_CLUSTER || 'mainnet-beta',
  },
} as const;

// Helper function to check if a feature is enabled
export function isFeatureEnabled(feature: keyof typeof CONFIG.FEATURES): boolean {
  return CONFIG.FEATURES[feature];
}

// Helper function to get interval configuration
export function getInterval(interval: keyof typeof CONFIG.INTERVALS): number {
  return CONFIG.INTERVALS[interval];
}

// Helper function to get UI configuration
export function getUIConfig(): typeof CONFIG.UI {
  return CONFIG.UI;
}

// Helper function to check environment
export function isDevelopment(): boolean {
  return CONFIG.ENV.IS_DEV;
}

export function isProduction(): boolean {
  return CONFIG.ENV.IS_PROD;
}

export function getCluster(): string {
  return CONFIG.ENV.CLUSTER;
}