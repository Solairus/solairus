# Agent Error Handler Usage Guide

This document provides examples of how to use the new Agent Error Handler system for comprehensive error handling in AI agent operations.

## Overview

The Agent Error Handler provides:
- **Comprehensive Error Parsing**: Automatically categorizes and parses agent-specific errors
- **User-Friendly Messages**: Converts technical errors into actionable user guidance
- **Context-Aware Handling**: Provides different messages based on agent state and error context
- **Retry Logic**: Intelligent retry suggestions with appropriate delays
- **Toast Integration**: Seamless integration with the toast notification system

## Basic Usage

### In React Components

```typescript
import { useAgentErrorHandler } from '@/utils/agent-error-handler';

const MyAgentComponent = () => {
  const { showError, showSuccess } = useAgentErrorHandler();

  const handleAgentOperation = async () => {
    try {
      await performAgentOperation();
      showSuccess('Operation completed successfully!');
    } catch (error) {
      showError(error, 'Agent operation', agent, {
        showRetry: true,
        onRetry: handleAgentOperation
      });
    }
  };
};
```

### In Service Functions

```typescript
import { AgentErrorHandler } from '@/utils/agent-error-handler';

export async function withdrawAgentRoi(params) {
  try {
    // ... operation logic
    return result;
  } catch (error) {
    // Parse error with agent context
    const agentError = AgentErrorHandler.parseError(error, 'ROI withdrawal', agent);
    throw new Error(agentError.message);
  }
}
```

## Error Types and Handling

### 1. Timing Errors (24-hour delays)

```typescript
// Error: "WithdrawalTooEarly - 24 hour cooldown required"
// Result: 
// - Type: 'timing'
// - Message: "New agents must wait 24 hours after activation before the first ROI withdrawal."
// - Retry: Available with countdown timer
// - Action: "Wait 30 minutes and try again"
```

### 2. Limit Errors (Yield caps, withdrawal limits)

```typescript
// Error: "AgentRetired - yield cap reached"
// Result:
// - Type: 'limits'
// - Message: "This VEGA agent has reached its 200% yield cap and cannot generate more ROI."
// - Retry: Not available
// - Action: "Consider activating a new agent to continue earning"
```

### 3. Network Errors

```typescript
// Error: "Network connection failed"
// Result:
// - Type: 'network'
// - Message: "Network connection error. Please check your internet connection."
// - Retry: Available immediately
// - Action: "Check your internet connection and retry"
```

### 4. Contract Errors

```typescript
// Error: "InsufficientSystemReserve"
// Result:
// - Type: 'contract'
// - Message: "System reserves are temporarily low due to high withdrawal volume."
// - Retry: Available after 5 minutes
// - Action: "Wait a few minutes and try again"
```

## Advanced Usage

### Custom Error Context

```typescript
const { parseError } = useAgentErrorHandler();

// Parse error with specific context and agent data
const agentError = parseError(error, 'Agent activation', agent);

// Check if retryable
if (agentError.isRetryable) {
  // Show retry option
  const retryDelay = agentError.retryDelay || 0;
  console.log(`Can retry in ${retryDelay} seconds`);
}
```

### Error-Specific UI Components

```typescript
const WithdrawalButton = ({ agent, onWithdraw }) => {
  const { showError, isRetryable, getRetryDelay } = useAgentErrorHandler();
  const [error, setError] = useState(null);

  const handleWithdraw = async () => {
    try {
      await onWithdraw(agent.activationId);
      setError(null);
    } catch (err) {
      const agentError = showError(err, 'ROI withdrawal', agent);
      setError(agentError);
    }
  };

  return (
    <div>
      <Button 
        onClick={handleWithdraw}
        disabled={error && !isRetryable(error)}
      >
        {error && getRetryDelay(error) > 0 
          ? `Retry in ${Math.ceil(getRetryDelay(error) / 60)}m`
          : 'Withdraw ROI'
        }
      </Button>
      
      {error && (
        <WithdrawalValidationFeedback 
          error={error.message}
          agent={agent}
          onRetry={isRetryable(error) ? handleWithdraw : undefined}
        />
      )}
    </div>
  );
};
```

## Error Code Reference

### Agent-Specific Error Codes

| Code | Error | Type | Retryable | Description |
|------|-------|------|-----------|-------------|
| 6015 | InvalidTier | validation | No | Invalid agent tier selected |
| 6016 | AgentRetired | limits | No | Agent reached yield cap |
| 6017 | WithdrawalTooEarly | timing | Yes | 24-hour delay not elapsed |
| 6018 | GlobalWithdrawalLimitReached | limits | No | 200x withdrawal limit reached |
| 6019 | AgentNotFound | validation | Yes | Agent record not found |
| 6020 | InsufficientSystemReserve | contract | Yes | System reserves low |

### Common Anchor Error Codes

| Code | Error | Type | Retryable | Description |
|------|-------|------|-----------|-------------|
| 6000 | Unauthorized | validation | No | Permission denied |
| 6003 | MathOverflow | validation | No | Calculation overflow |
| 6004 | InvalidAmount | validation | No | Invalid amount value |
| 6006 | InsufficientFunds | validation | No | Insufficient balance |
| 2006 | SeedsConstraint | contract | Yes | Account verification failed |

## Toast Notification Behavior

### Duration by Error Type

- **Timing errors**: 8 seconds (longer for countdown info)
- **Limit errors**: 10 seconds (longer for explanation)
- **Network errors**: 5 seconds
- **Other errors**: 6 seconds

### Retry Button Behavior

- **Available**: Shows "Retry" or "Try Again" with refresh icon
- **Delayed**: Shows "Retry in Xm" with countdown
- **Unavailable**: Shows "Cannot Retry" or specific action like "Activate New Agent"

## Integration with Existing Components

### WithdrawalValidationFeedback

The component now uses the agent error handler automatically:

```typescript
<WithdrawalValidationFeedback 
  error={errorMessage}
  agent={agent}
  onRetry={handleRetry}
/>
```

### AgentCard

Updated to use comprehensive error handling:

```typescript
const AgentCard = ({ agent, onWithdraw }) => {
  const { showError, showSuccess } = useAgentErrorHandler();
  
  const handleWithdraw = async () => {
    try {
      await onWithdraw(agent.activationId);
      showSuccess('ROI withdrawal successful!', { agent });
    } catch (error) {
      showError(error, 'ROI withdrawal', agent, {
        showRetry: true,
        onRetry: handleWithdraw
      });
    }
  };
  
  // ... rest of component
};
```

## Best Practices

### 1. Always Provide Context

```typescript
// Good
showError(error, 'Agent activation', agent);

// Less helpful
showError(error);
```

### 2. Use Agent Data When Available

```typescript
// Provides agent-specific error messages
const agentError = parseError(error, 'withdrawal', agent);
```

### 3. Handle Success States

```typescript
// Show success with context
showSuccess('Agent activated successfully!', {
  description: `${tierName} agent activated with ${amount} USDT`,
  agent
});
```

### 4. Implement Proper Retry Logic

```typescript
// Only show retry for appropriate errors
showError(error, context, agent, {
  showRetry: agentError.isRetryable,
  onRetry: agentError.isRetryable ? handleRetry : undefined
});
```

### 5. Use Timing Information

```typescript
// Display countdown for timing errors
if (agentError.type === 'timing' && agentError.retryDelay > 0) {
  const minutes = Math.ceil(agentError.retryDelay / 60);
  console.log(`Next withdrawal available in ${minutes} minutes`);
}
```

## Testing

The error handler includes comprehensive tests covering:

- Error parsing and categorization
- User-friendly message generation
- Retry logic and timing
- Toast integration
- Agent context handling

Run tests with:
```bash
npm test src/utils/__tests__/agent-error-handler.test.ts
```

## Migration from Old Error Handling

### Before (withdrawal-validation-utils.ts)

```typescript
const parsedError = parseWithdrawalError(error);
const guidance = getWithdrawalGuidance(parsedError, agent);
const retryAction = getRetryAction(parsedError, agent);
```

### After (agent-error-handler.ts)

```typescript
const { parseError } = useAgentErrorHandler();
const agentError = parseError(error, 'ROI withdrawal', agent);
// All guidance and retry logic included in agentError object
```

The new system provides more comprehensive error handling with better user experience and easier integration.