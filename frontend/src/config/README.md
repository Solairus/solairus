# Enhanced AI Agent System Configuration

This directory contains the centralized configuration for the Enhanced AI Agent System frontend implementation.

## Overview

The configuration system provides:
- **Agent tier metadata and styling** - Complete configuration for all four agent tiers (NOVA, VEGA, ORION, PRIME)
- **Service endpoints** - API endpoints and external service configuration
- **Error handling** - Centralized error handling configuration with retry policies
- **UI constants** - Animation durations, layout settings, and theming
- **Environment validation** - Validation of required environment variables

## Configuration Files

### `agent-config.ts`
Main configuration file for the agent system containing:
- **Extended tier configurations** with UI metadata, styling, and feature descriptions
- **Service configuration** for polling intervals, retry policies, and caching
- **UI configuration** for animations, layouts, and toast durations
- **Error handling configuration** with retry policies and user-friendly messages

### `service-endpoints.ts`
Service endpoint configuration including:
- **API endpoints** for agent operations, withdrawal limits, and tier information
- **External API endpoints** for price data and analytics
- **WebSocket endpoints** for real-time updates
- **Request/response interceptors** for authentication and error handling

### `index.ts`
Centralized exports and helper functions:
- **Feature flags** for enabling/disabling functionality
- **Configuration constants** for easy access throughout the app
- **Helper functions** for checking features and getting configuration values

## Environment Variables

### Required Variables
```bash
VITE_SOLANA_CLUSTER=devnet  # Solana cluster (devnet, testnet, mainnet-beta)
```

### Agent System Variables
```bash
# Feature flags
VITE_ENABLE_AGENT_DASHBOARD=true
VITE_ENABLE_TIER_SELECTION=true
VITE_ENABLE_WITHDRAWAL_LIMITS=true

# Service configuration
VITE_AGENT_REFRESH_INTERVAL=30000
VITE_WITHDRAWAL_STATUS_REFRESH_INTERVAL=5000

# UI configuration
VITE_AGENT_CARDS_MOBILE=1
VITE_AGENT_CARDS_TABLET=2
VITE_AGENT_CARDS_DESKTOP=3
VITE_AGENT_CARDS_WIDE=4

# Error handling
VITE_SHOW_DETAILED_ERRORS=true
VITE_ENABLE_ERROR_REPORTING=false

# Development features
VITE_ENABLE_AGENT_MOCK_DATA=false
VITE_SIMULATE_NETWORK_DELAY=false
```

## Usage Examples

### Using Agent Tier Configuration
```typescript
import { EXTENDED_AGENT_TIER_CONFIGS, getTierStyling } from '@/config/agent-config';
import { AgentTier } from '@/lib/solairus-main';

// Get complete tier configuration
const novaConfig = EXTENDED_AGENT_TIER_CONFIGS[AgentTier.NOVA];
console.log(novaConfig.name); // "NOVA"
console.log(novaConfig.emoji); // "🪶"
console.log(novaConfig.dailyRange); // "1.00% - 1.75%"

// Get tier styling
const styling = getTierStyling(AgentTier.NOVA);
console.log(styling.gradient); // "from-cyan-500/20 via-cyan-400/15 to-cyan-600/10"
```

### Using Service Configuration
```typescript
import { getAgentServiceConfig } from '@/config/agent-config';

const serviceConfig = getAgentServiceConfig();
console.log(serviceConfig.defaultPageSize); // 50
console.log(serviceConfig.agentDataRefreshInterval); // 30000
```

### Using Feature Flags
```typescript
import { isFeatureEnabled, CONFIG } from '@/config';

if (isFeatureEnabled('AGENT_DASHBOARD')) {
  // Render agent dashboard
}

if (CONFIG.FEATURES.TIER_SELECTION) {
  // Show tier selection component
}
```

### Using Error Configuration
```typescript
import { AGENT_ERROR_CONFIG } from '@/config/agent-config';

const retryPolicy = AGENT_ERROR_CONFIG.retryPolicies.network;
console.log(retryPolicy.maxRetries); // 3
console.log(retryPolicy.baseDelay); // 1000
```

## Configuration Validation

The system includes automatic configuration validation in development mode:

```typescript
import { validateAgentSystemConfig } from '@/config';

const validation = validateAgentSystemConfig();
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Validation Checks
- **Agent tier completeness** - All tiers have required configuration
- **Environment variables** - Required variables are set and valid
- **Feature flag consistency** - No conflicting feature combinations
- **Service endpoints** - API endpoints are properly configured

## Tier Configuration Details

### NOVA Tier (Beginner)
- **Daily Yield**: 1.00% - 1.75%
- **Yield Cap**: 175%
- **Risk Level**: Low
- **Target Users**: New to crypto trading, risk-averse investors
- **Styling**: Cyan color scheme

### VEGA Tier (Intermediate)
- **Daily Yield**: 1.75% - 2.15%
- **Yield Cap**: 200%
- **Risk Level**: Medium
- **Target Users**: Balanced risk tolerance, regular investors
- **Styling**: Emerald color scheme

### ORION Tier (Advanced)
- **Daily Yield**: 2.15% - 3.00%
- **Yield Cap**: 220%
- **Risk Level**: High
- **Target Users**: Experienced traders, higher risk tolerance
- **Styling**: Indigo color scheme

### PRIME Tier (Expert)
- **Daily Yield**: 3.00% - 5.00%
- **Yield Cap**: 250%
- **Risk Level**: Maximum
- **Target Users**: Expert traders, maximum risk tolerance
- **Styling**: Amber color scheme

## Error Handling Configuration

### Error Categories
- **Network**: Connection/RPC issues (retryable)
- **Transaction**: Transaction failures (retryable with delay)
- **Contract**: Smart contract errors (limited retries)
- **Timing**: 24-hour cooldown violations (not retryable)
- **Limits**: Yield cap and withdrawal limits (not retryable)
- **Validation**: Input validation errors (not retryable)

### Retry Policies
Each error category has specific retry configuration:
- **Max retries**: Number of automatic retry attempts
- **Base delay**: Initial delay between retries
- **Max delay**: Maximum delay between retries
- **Exponential backoff**: Whether to increase delay exponentially

## Development vs Production

### Development Settings
- Detailed error messages enabled
- Configuration validation logging
- Mock data support (optional)
- Network delay simulation (optional)

### Production Settings
- User-friendly error messages only
- Error reporting to external service
- Performance optimizations
- Security considerations

## Adding New Configuration

To add new configuration options:

1. **Add to appropriate config file** (`agent-config.ts` or `service-endpoints.ts`)
2. **Add environment variable** to `.env.example`
3. **Update validation** in `config-validator.ts`
4. **Export from index** in `index.ts`
5. **Update documentation** in this README

## Best Practices

1. **Use configuration constants** instead of hardcoded values
2. **Validate configuration** in development mode
3. **Provide sensible defaults** for optional settings
4. **Document environment variables** in `.env.example`
5. **Test configuration changes** thoroughly
6. **Keep production settings secure** (no debug info, proper error reporting)

## Troubleshooting

### Common Issues

1. **Missing environment variables**
   - Check `.env.example` for required variables
   - Run configuration validation to identify missing variables

2. **Invalid configuration values**
   - Check console for validation errors in development
   - Ensure boolean values are 'true' or 'false'
   - Ensure numeric values are valid numbers

3. **Feature not working**
   - Check if feature flag is enabled
   - Verify environment variable spelling
   - Check browser console for configuration errors

4. **Styling issues**
   - Verify tier configuration is complete
   - Check if Tailwind classes are properly configured
   - Ensure styling configuration matches component usage

### Debug Configuration

Use the configuration summary to debug issues:

```typescript
import { getConfigurationSummary } from '@/config';

console.log('Configuration Summary:', getConfigurationSummary());
```

This will show all current configuration values and help identify issues.