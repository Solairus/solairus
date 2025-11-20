/**
 * Agent System Configuration
 * 
 * Centralized configuration for the Enhanced AI Agent System including:
 * - Agent tier metadata and styling
 * - Service endpoints and API configuration
 * - Error handling configuration
 * - UI constants and theming
 */

// Removed solairus-removed; agent tiers fetched from backend

// Extended tier metadata for UI components
export interface ExtendedTierConfig {
  // Core configuration from smart contract
  minYieldBps: number;
  maxYieldBps: number;
  yieldCapPct: number;
  name: string;
  emoji: string;
  description: string;
  dailyRange: string;
  
  // Extended UI metadata
  persona: string;
  tagline: string;
  targetUser: string;
  riskLevel: string;
  riskColor: string;
  
  // Styling configuration
  styling: {
    gradient: string;
    border: string;
    accent: string;
    bg: string;
    glow: string;
    primary: string;
    secondary: string;
    background: string;
  };
  
  // Feature highlights
  features: string[];
  
  // Investment guidance
  recommendedFor: string[];
  minimumExperience: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}

// Complete tier configurations with UI metadata
export const EXTENDED_AGENT_TIER_METADATA: ExtendedTierConfig[] = [
  {
    minYieldBps: 0,
    maxYieldBps: 0,
    yieldCapPct: 200,
    name: 'Nova',
    emoji: '🌀',
    description: 'Stable daily returns with minimal risk',
    dailyRange: '1%–2% (backend)',
    persona: 'Nova',
    tagline: 'Pattern Seeker',
    targetUser: 'Beginners',
    riskLevel: 'Low Risk',
    riskColor: 'text-green-500',
    styling: {
      gradient: 'from-cyan-500/20 via-cyan-400/15 to-cyan-600/10',
      border: 'border-cyan-500/40',
      accent: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      glow: 'shadow-cyan-500/20',
      primary: 'text-cyan-500',
      secondary: 'text-cyan-300',
      background: 'bg-cyan-500/10',
    },
    features: [
      'Stable daily returns',
      'Conservative strategies',
      'Predictable yield patterns'
    ],
    recommendedFor: ['New to crypto', 'Risk-averse investors', 'Small initial investments'],
    minimumExperience: 'Beginner'
  },
  {
    minYieldBps: 0,
    maxYieldBps: 0,
    yieldCapPct: 200,
    name: 'Vega',
    emoji: '⭐',
    description: 'Balanced approach with steady growth',
    dailyRange: '2%–3% (backend)',
    persona: 'Vega',
    tagline: 'Momentum Scout',
    targetUser: 'Balanced',
    riskLevel: 'Medium Risk',
    riskColor: 'text-amber-500',
    styling: {
      gradient: 'from-emerald-500/20 via-emerald-400/15 to-emerald-600/10',
      border: 'border-emerald-500/40',
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      glow: 'shadow-emerald-500/20',
      primary: 'text-emerald-500',
      secondary: 'text-emerald-300',
      background: 'bg-emerald-500/10',
    },
    features: ['Momentum signals', 'Balanced risk-reward'],
    recommendedFor: ['Some trading experience', 'Balanced risk tolerance'],
    minimumExperience: 'Intermediate'
  },
  {
    minYieldBps: 0,
    maxYieldBps: 0,
    yieldCapPct: 200,
    name: 'Orion',
    emoji: '💠',
    description: 'Higher yields with controlled volatility',
    dailyRange: '3%–4% (backend)',
    persona: 'Orion',
    tagline: 'Risk Balancer',
    targetUser: 'Aggressive',
    riskLevel: 'High Risk',
    riskColor: 'text-orange-500',
    styling: {
      gradient: 'from-indigo-500/20 via-indigo-400/15 to-indigo-600/10',
      border: 'border-indigo-500/40',
      accent: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      glow: 'shadow-indigo-500/20',
      primary: 'text-indigo-500',
      secondary: 'text-indigo-300',
      background: 'bg-indigo-500/10',
    },
    features: ['Advanced risk management', 'Enhanced profit potential'],
    recommendedFor: ['Experienced traders', 'Higher risk tolerance'],
    minimumExperience: 'Advanced'
  },
  {
    minYieldBps: 0,
    maxYieldBps: 0,
    yieldCapPct: 200,
    name: 'Prime',
    emoji: '🚀',
    description: 'Maximum returns for experienced traders',
    dailyRange: '4%–5% (backend)',
    persona: 'Prime',
    tagline: 'Alpha Hunter',
    targetUser: 'Elite',
    riskLevel: 'Max Risk',
    riskColor: 'text-red-500',
    styling: {
      gradient: 'from-amber-500/20 via-amber-400/15 to-amber-600/10',
      border: 'border-amber-500/40',
      accent: 'text-amber-400',
      bg: 'bg-amber-500/10',
      glow: 'shadow-amber-500/20',
      primary: 'text-amber-500',
      secondary: 'text-amber-300',
      background: 'bg-amber-500/10',
    },
    features: ['Elite algorithms', 'Premium risk management'],
    recommendedFor: ['Expert traders', 'Large investments'],
    minimumExperience: 'Expert'
  }
];

// Agent service configuration
export const AGENT_SERVICE_CONFIG = {
  // Query configuration
  defaultPageSize: 50,
  maxPageSize: 100,
  
  // Polling intervals (in milliseconds)
  agentDataRefreshInterval: 30000, // 30 seconds
  withdrawalStatusRefreshInterval: 5000, // 5 seconds
  
  // Retry configuration
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  
  // Cache configuration
  agentDataCacheTtl: 60000, // 1 minute
  withdrawalLimitCacheTtl: 30000, // 30 seconds
  
  // Transaction configuration
  confirmationTimeout: 60000, // 1 minute
  maxTransactionRetries: 2,
  
  // Error handling
  showDetailedErrors: import.meta.env.DEV,
  enableErrorReporting: import.meta.env.PROD,
  
  // Feature flags
  enableAgentDashboard: true,
  enableTierSelection: true,
  enableWithdrawalLimits: true,
  enableYieldCapTracking: true,
  enableWithdrawalTimers: true,
};

// UI constants for agent components
export const AGENT_UI_CONFIG = {
  // Animation durations (in milliseconds)
  cardHoverDuration: 300,
  progressAnimationDuration: 1000,
  countdownUpdateInterval: 1000,
  
  // Layout configuration
  cardsPerRow: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    wide: 4
  },
  
  // Progress bar configuration
  yieldCapProgressColors: {
    low: 'bg-green-500', // 0-50%
    medium: 'bg-amber-500', // 50-80%
    high: 'bg-orange-500', // 80-95%
    critical: 'bg-red-500', // 95-100%
  },
  
  // Status badge configuration
  statusBadges: {
    active: {
      variant: 'default' as const,
      text: 'Active',
      color: 'text-green-500'
    },
    retired: {
      variant: 'destructive' as const,
      text: 'Retired',
      color: 'text-red-500'
    },
    cooldown: {
      variant: 'secondary' as const,
      text: 'Cooldown',
      color: 'text-amber-500'
    }
  },
  
  // Toast configuration
  toastDurations: {
    success: 4000,
    error: 6000,
    timing: 8000,
    limits: 10000,
    info: 5000
  },
  
  // Formatting configuration
  currencyFormat: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'USD'
  },
  
  percentageFormat: {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
    style: 'percent'
  }
};

// Error handling configuration for agent operations
export const AGENT_ERROR_CONFIG = {
  // Error categories and their retry policies
  retryPolicies: {
    network: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBackoff: true
    },
    transaction: {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 8000,
      exponentialBackoff: true
    },
    contract: {
      maxRetries: 1,
      baseDelay: 3000,
      maxDelay: 5000,
      exponentialBackoff: false
    },
    timing: {
      maxRetries: 0, // Don't retry timing errors
      baseDelay: 0,
      maxDelay: 0,
      exponentialBackoff: false
    },
    limits: {
      maxRetries: 0, // Don't retry limit errors
      baseDelay: 0,
      maxDelay: 0,
      exponentialBackoff: false
    }
  },
  
  // Error message customization
  userFriendlyMessages: {
    networkError: 'Connection issue. Please check your internet and try again.',
    transactionFailed: 'Transaction failed. This may be temporary - please retry.',
    contractError: 'Smart contract error. Please try again in a moment.',
    timingError: 'Please wait for the cooldown period to complete.',
    limitError: 'You have reached a system limit. See details for more information.',
    validationError: 'Please check your input and try again.',
    unknownError: 'An unexpected error occurred. Please try again or contact support.'
  },
  
  // Error reporting configuration
  enableErrorReporting: import.meta.env.PROD,
  errorReportingEndpoint: '/api/errors', // Would be configured for production
  includeStackTrace: import.meta.env.DEV,
  includeBrowserInfo: true,
  includeUserAgent: true
};

// Environment-based configuration
export const AGENT_ENV_CONFIG = {
  // Development settings
  development: {
    enableDebugLogs: true,
    enableMockData: false,
    enableTestMode: false,
    simulateNetworkDelay: false,
    mockWithdrawalDelay: 0
  },
  
  // Production settings
  production: {
    enableDebugLogs: false,
    enableMockData: false,
    enableTestMode: false,
    simulateNetworkDelay: false,
    mockWithdrawalDelay: 0
  },
  
  // Get current environment config
  current: import.meta.env.DEV ? 'development' : 'production'
} as const;

// Helper functions for configuration access
export function getExtendedTierConfig(tier: AgentTier): ExtendedTierConfig {
  return EXTENDED_AGENT_TIER_CONFIGS[tier];
}

export function getTierStyling(tier: AgentTier) {
  return EXTENDED_AGENT_TIER_CONFIGS[tier].styling;
}

export function getAgentServiceConfig() {
  return AGENT_SERVICE_CONFIG;
}

export function getAgentUIConfig() {
  return AGENT_UI_CONFIG;
}

export function getAgentErrorConfig() {
  return AGENT_ERROR_CONFIG;
}

export function getCurrentEnvConfig() {
  const env = AGENT_ENV_CONFIG.current;
  return AGENT_ENV_CONFIG[env];
}

// Validation helpers
export function isValidTier(tier: unknown): tier is AgentTier {
  return typeof tier === 'number' && tier >= 0 && tier <= 3;
}

export function validateAgentConfig(): boolean {
  try {
    // Validate all tiers have complete configuration
    for (const tier of [AgentTier.NOVA, AgentTier.VEGA, AgentTier.ORION, AgentTier.PRIME]) {
      const config = EXTENDED_AGENT_TIER_CONFIGS[tier];
      if (!config || !config.name || !config.emoji || !config.styling) {
        console.error(`Invalid configuration for tier ${tier}`);
        return false;
      }
    }
    
    // Validate service configuration
    if (!AGENT_SERVICE_CONFIG.defaultPageSize || AGENT_SERVICE_CONFIG.defaultPageSize <= 0) {
      console.error('Invalid service configuration');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating agent configuration:', error);
    return false;
  }
}

// Initialize configuration validation on module load
if (import.meta.env.DEV) {
  const isValid = validateAgentConfig();
  if (!isValid) {
    console.warn('⚠️ Agent configuration validation failed');
  } else {
    console.log('✅ Agent configuration validated successfully');
  }
}