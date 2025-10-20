/**
 * Configuration Validator
 * 
 * Validates frontend configuration for the Enhanced AI Agent System
 * Ensures all required configurations are properly set up
 */

import { validateAgentConfig } from '@/config/agent-config';
import { validateEndpointConfig } from '@/config/service-endpoints';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  missing: string[];
  invalid: string[];
  recommendations: string[];
}

/**
 * Validate all agent system configurations
 */
export function validateAgentSystemConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate agent configuration
    if (!validateAgentConfig()) {
      errors.push('Agent configuration validation failed');
    }

    // Validate service endpoints
    if (!validateEndpointConfig()) {
      errors.push('Service endpoint configuration validation failed');
    }

    // Validate environment variables
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      errors.push(...envValidation.missing.map(key => `Missing environment variable: ${key}`));
      errors.push(...envValidation.invalid.map(key => `Invalid environment variable: ${key}`));
      warnings.push(...envValidation.recommendations);
    }

    // Validate feature flags
    const featureValidation = validateFeatureFlags();
    if (!featureValidation.isValid) {
      warnings.push(...featureValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Configuration validation error: ${error instanceof Error ? error.message : String(error)}`],
      warnings
    };
  }
}

/**
 * Validate environment variables for agent system
 */
export function validateEnvironmentVariables(): EnvironmentValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const recommendations: string[] = [];

  // Required environment variables
  const required = [
    'VITE_SOLANA_CLUSTER'
  ];

  // Optional but recommended environment variables
  const recommended = [
    'VITE_ENABLE_AGENT_DASHBOARD',
    'VITE_ENABLE_TIER_SELECTION',
    'VITE_ENABLE_WITHDRAWAL_LIMITS',
    'VITE_AGENT_REFRESH_INTERVAL',
    'VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL'
  ];

  // Check required variables
  for (const key of required) {
    const value = import.meta.env[key];
    if (!value) {
      missing.push(key);
    }
  }

  // Check recommended variables
  for (const key of recommended) {
    const value = import.meta.env[key];
    if (!value) {
      recommendations.push(`Consider setting ${key} for better agent system configuration`);
    }
  }

  // Validate specific variable formats
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER;
  if (cluster && !['devnet', 'testnet', 'mainnet-beta'].includes(cluster)) {
    invalid.push('VITE_SOLANA_CLUSTER must be one of: devnet, testnet, mainnet-beta');
  }

  const refreshInterval = import.meta.env.VITE_AGENT_REFRESH_INTERVAL;
  if (refreshInterval && (isNaN(Number(refreshInterval)) || Number(refreshInterval) < 1000)) {
    invalid.push('VITE_AGENT_REFRESH_INTERVAL must be a number >= 1000 (milliseconds)');
  }

  const withdrawalInterval = import.meta.env.VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL;
  if (withdrawalInterval && (isNaN(Number(withdrawalInterval)) || Number(withdrawalInterval) < 1000)) {
    invalid.push('VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL must be a number >= 1000 (milliseconds)');
  }

  // Validate boolean environment variables
  const booleanVars = [
    'VITE_ENABLE_AGENT_DASHBOARD',
    'VITE_ENABLE_TIER_SELECTION',
    'VITE_ENABLE_WITHDRAWAL_LIMITS',
    'VITE_SHOW_DETAILED_ERRORS',
    'VITE_ENABLE_ERROR_REPORTING',
    'VITE_ENABLE_AGENT_MOCK_DATA',
    'VITE_SIMULATE_NETWORK_DELAY'
  ];

  for (const key of booleanVars) {
    const value = import.meta.env[key];
    if (value && !['true', 'false'].includes(value.toLowerCase())) {
      invalid.push(`${key} must be 'true' or 'false'`);
    }
  }

  return {
    isValid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    recommendations
  };
}

/**
 * Validate feature flags configuration
 */
export function validateFeatureFlags(): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for conflicting feature flags
  const agentDashboard = import.meta.env.VITE_ENABLE_AGENT_DASHBOARD !== 'false';
  const tierSelection = import.meta.env.VITE_ENABLE_TIER_SELECTION !== 'false';
  const withdrawalLimits = import.meta.env.VITE_ENABLE_WITHDRAWAL_LIMITS !== 'false';

  if (!agentDashboard && tierSelection) {
    warnings.push('Tier selection is enabled but agent dashboard is disabled - users may not see their selected tiers');
  }

  if (!agentDashboard && withdrawalLimits) {
    warnings.push('Withdrawal limits are enabled but agent dashboard is disabled - users may not see their limits');
  }

  // Check development vs production settings
  if (import.meta.env.PROD) {
    if (import.meta.env.VITE_ENABLE_AGENT_MOCK_DATA === 'true') {
      warnings.push('Mock data is enabled in production - this should be disabled');
    }

    if (import.meta.env.VITE_SIMULATE_NETWORK_DELAY === 'true') {
      warnings.push('Network delay simulation is enabled in production - this should be disabled');
    }

    if (import.meta.env.VITE_SHOW_DETAILED_ERRORS === 'true') {
      warnings.push('Detailed errors are enabled in production - consider disabling for security');
    }
  }

  return {
    isValid: true, // Feature flag issues are warnings, not errors
    warnings
  };
}

/**
 * Get configuration summary for debugging
 */
export function getConfigurationSummary(): Record<string, unknown> {
  return {
    environment: import.meta.env.MODE,
    cluster: import.meta.env.VITE_SOLANA_CLUSTER,
    features: {
      agentDashboard: import.meta.env.VITE_ENABLE_AGENT_DASHBOARD !== 'false',
      tierSelection: import.meta.env.VITE_ENABLE_TIER_SELECTION !== 'false',
      withdrawalLimits: import.meta.env.VITE_ENABLE_WITHDRAWAL_LIMITS !== 'false',
      errorReporting: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
      mockData: import.meta.env.VITE_ENABLE_AGENT_MOCK_DATA === 'true'
    },
    intervals: {
      agentRefresh: Number(import.meta.env.VITE_AGENT_REFRESH_INTERVAL || 30000),
      withdrawalStatus: Number(import.meta.env.VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL || 5000)
    },
    ui: {
      cardsMobile: Number(import.meta.env.VITE_AGENT_CARDS_MOBILE || 1),
      cardsTablet: Number(import.meta.env.VITE_AGENT_CARDS_TABLET || 2),
      cardsDesktop: Number(import.meta.env.VITE_AGENT_CARDS_DESKTOP || 3),
      cardsWide: Number(import.meta.env.VITE_AGENT_CARDS_WIDE || 4)
    }
  };
}

/**
 * Initialize configuration validation and logging
 */
export function initializeConfigValidation(): void {
  if (import.meta.env.DEV) {
    console.group('🔧 Agent System Configuration Validation');
    
    const validation = validateAgentSystemConfig();
    
    if (validation.isValid) {
      console.log('✅ All configurations are valid');
    } else {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    console.log('📋 Configuration Summary:', getConfigurationSummary());
    console.groupEnd();
  }
}

// Auto-initialize in development
if (import.meta.env.DEV) {
  // Delay initialization to ensure all modules are loaded
  setTimeout(initializeConfigValidation, 100);
}