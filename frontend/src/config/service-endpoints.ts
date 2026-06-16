/**
 * Service Endpoints Configuration
 * 
 * Centralized configuration for all service endpoints including:
 * - Agent service endpoints
 * - Error reporting endpoints
 * - External API endpoints
 * - WebSocket connections
 */

// Base API configuration
export const API_CONFIG = {
  // Base URLs for different environments
  baseUrls: {
    development: 'http://localhost:4000/api',
    production: (import.meta.env.VITE_API_BASE_URL || '/api'), // Allow explicit backend URL on Railway
    staging: 'https://staging-api.solairus.com/api'
  },

  // Get current base URL
  getBaseUrl(): string {
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }

    if (import.meta.env.DEV) {
      return this.baseUrls.development;
    }

    return this.baseUrls.production;
  },

  // Request configuration
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000,

  // Headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  } as HeadersInit
};

// Agent service endpoints
export const AGENT_ENDPOINTS = {
  // Agent data endpoints
  getUserAgents: '/agents/user/:userAddress',
  getAgentDetails: '/agents/:activationId',
  getAgentStatistics: '/agents/user/:userAddress/statistics',

  // Agent operations endpoints
  activateAgent: '/agents/activate',
  withdrawRoi: '/agents/:activationId/withdraw',

  // Withdrawal limit endpoints
  getWithdrawalLimits: '/agents/user/:userAddress/limits',
  checkWithdrawalEligibility: '/agents/:activationId/eligibility',
  // PnL summary (backend computed)
  getPnlSummary: '/agents/pnl-summary',

  // Agent tier endpoints
  getTierConfigurations: '/agents/tiers',
  getTierStatistics: '/agents/tiers/statistics',

  // Build full URL for endpoint
  buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    let url = `${API_CONFIG.getBaseUrl()}${endpoint}`;

    // Replace path parameters
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    });

    return url;
  }
};

// Bucket service endpoints
export const BUCKET_ENDPOINTS = {
  // Admin buckets overview
  getAdminBuckets: '/admin/buckets',
  // Initialize a bucket withdrawal for a given bucket type
  initBucketWithdrawal: '/admin/buckets/:bucketType/withdraw/init',
  // Build full URL for bucket endpoint
  buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    let url = `${API_CONFIG.getBaseUrl()}${endpoint}`;
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    });
    return url;
  }
};

// Error reporting endpoints
export const ERROR_REPORTING_ENDPOINTS = {
  // Error reporting
  reportError: '/errors/report',
  reportAgentError: '/errors/agent',

  // Error analytics
  getErrorStatistics: '/errors/statistics',
  getErrorTrends: '/errors/trends',

  // Build full URL for endpoint
  buildUrl(endpoint: string): string {
    return `${API_CONFIG.getBaseUrl()}${endpoint}`;
  }
};

// External API endpoints
export const EXTERNAL_ENDPOINTS = {
  // Price data
  coinGecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    simplePrices: '/simple/price',
    coinList: '/coins/list'
  },

  // Solana blockchain data
  solana: {
    // These are handled by RPC configuration
    // but listed here for completeness
    mainnet: 'https://api.mainnet-beta.solana.com',
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com'
  },

  // Analytics and monitoring
  analytics: {
    // Would be configured for production analytics
    endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT || null,
    apiKey: import.meta.env.VITE_ANALYTICS_API_KEY || null
  }
};

// WebSocket endpoints for real-time updates
export const WEBSOCKET_ENDPOINTS = {
  // Agent real-time updates
  agentUpdates: '/ws/agents',
  withdrawalUpdates: '/ws/withdrawals',

  // System status updates
  systemStatus: '/ws/system',

  // Build WebSocket URL
  buildWsUrl(endpoint: string): string {
    const baseUrl = API_CONFIG.getBaseUrl();
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}${endpoint}`;
  }
};

// Service configuration for different features
export const SERVICE_CONFIG = {
  // Agent service configuration
  agents: {
    enableRealTimeUpdates: import.meta.env.VITE_ENABLE_AGENT_REALTIME === 'true',
    enableCaching: true,
    cacheTimeout: 60000, // 1 minute
    maxCacheSize: 1000,

    // Polling configuration when WebSocket is not available
    pollingInterval: parseInt(import.meta.env.VITE_AGENT_REFRESH_INTERVAL || '30000'),
    withdrawalPollingInterval: parseInt(import.meta.env.VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL || '5000'),

    // Batch operations
    enableBatchOperations: true,
    maxBatchSize: 50
  },

  // Error reporting configuration
  errorReporting: {
    enabled: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    endpoint: ERROR_REPORTING_ENDPOINTS.reportError,
    includeUserAgent: true,
    includeBrowserInfo: true,
    includeStackTrace: import.meta.env.DEV,

    // Rate limiting for error reports
    maxErrorsPerMinute: 10,
    maxErrorsPerHour: 100
  },

  // External API configuration
  external: {
    coinGecko: {
      enabled: true,
      apiKey: import.meta.env.VITE_COINGECKO_API_KEY || null,
      rateLimit: 50, // requests per minute for free tier
      cacheTtl: 300000 // 5 minutes
    },

    analytics: {
      enabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
      endpoint: EXTERNAL_ENDPOINTS.analytics.endpoint,
      apiKey: EXTERNAL_ENDPOINTS.analytics.apiKey
    }
  }
};

// Request interceptor configuration
export const REQUEST_INTERCEPTORS = {
  // Add authentication headers
  addAuth: (config: RequestInit): RequestInit => {
    // Attach JWT from local storage if present
    let token: string | null = null;
    try {
      token = localStorage.getItem('solairus.jwt');
    } catch {
      token = null;
    }
    if (token) {
      const headers = new Headers(config.headers as HeadersInit);
      headers.set('Authorization', `Bearer ${token}`);
      return {
        ...config,
        headers,
      };
    }
    return config;
  },

  // Add request ID for tracking
  addRequestId: (config: RequestInit): RequestInit => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Request-ID': requestId
      }
    };
  },

  // Add user agent information
  addUserAgent: (config: RequestInit): RequestInit => {
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-User-Agent': navigator.userAgent,
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0'
      }
    };
  }
};

// Response interceptor configuration
export const RESPONSE_INTERCEPTORS = {
  // Handle common error responses
  handleErrors: async (response: Response): Promise<Response> => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let serverMsg = (errorData && (errorData.error || errorData.message)) || null;
      if (typeof serverMsg === 'object') {
        serverMsg = JSON.stringify(serverMsg);
      }
      throw new Error(serverMsg || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  },

  // Log response times for monitoring
  logResponseTime: (response: Response, startTime: number): Response => {
    const responseTime = Date.now() - startTime;
    if (import.meta.env.DEV) {
      console.log(`API Response: ${response.url} - ${responseTime}ms`);
    }
    return response;
  }
};

// Helper functions for making API requests
export class ApiClient {
  private static async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const startTime = Date.now();

    // Apply request interceptors
    const mergedHeaders: HeadersInit = {
      ...(API_CONFIG.defaultHeaders as HeadersInit),
      ...(options.headers as HeadersInit),
    };
    let config: RequestInit = {
      ...options,
      headers: mergedHeaders,
    };

    config = REQUEST_INTERCEPTORS.addRequestId(config);
    config = REQUEST_INTERCEPTORS.addUserAgent(config);
    config = REQUEST_INTERCEPTORS.addAuth(config);

    // Make the request
    const response = await fetch(url, config);

    // Apply response interceptors
    const processedResponse = await RESPONSE_INTERCEPTORS.handleErrors(response);
    RESPONSE_INTERCEPTORS.logResponseTime(processedResponse, startTime);

    return processedResponse;
  }

  static async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.makeRequest(url, { ...options, method: 'GET' });
  }

  static async post(url: string, data?: unknown, options: RequestInit = {}): Promise<Response> {
    return this.makeRequest(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  static async put(url: string, data?: unknown, options: RequestInit = {}): Promise<Response> {
    return this.makeRequest(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  static async delete(url: string, options: RequestInit = {}): Promise<Response> {
    return this.makeRequest(url, { ...options, method: 'DELETE' });
  }
}

// Validation helpers
export function validateEndpointConfig(): boolean {
  try {
    // Validate base URL configuration
    const baseUrl = API_CONFIG.getBaseUrl();
    if (!baseUrl) {
      console.error('No base URL configured for API');
      return false;
    }

    // Validate required environment variables
    if (import.meta.env.PROD) {
      if (SERVICE_CONFIG.errorReporting.enabled && !ERROR_REPORTING_ENDPOINTS.reportError) {
        console.error('Error reporting enabled but no endpoint configured');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating endpoint configuration:', error);
    return false;
  }
}

// Initialize configuration validation
if (import.meta.env.DEV) {
  const isValid = validateEndpointConfig();
  if (!isValid) {
    console.warn('⚠️ Service endpoint configuration validation failed');
  } else {
    console.log('✅ Service endpoint configuration validated successfully');
  }
}