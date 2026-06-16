# Agent Error Handling Guide

This guide explains how to implement user-friendly error handling for AI agent operations in the Solairus platform.

## Overview

The enhanced error handling system provides:
- **Comprehensive error parsing** with specific agent error codes
- **User-friendly error messages** with actionable guidance
- **Intelligent retry mechanisms** with exponential backoff
- **Context-aware error display** components
- **Timing-specific error handling** for withdrawal cooldowns
- **Error boundaries** for graceful failure recovery

## Core Components

### 1. AgentErrorHandler

The main error parsing and handling utility:

```typescript
import { useAgentErrorHandler } from '@/utils/agent-error-handler';

const { showError, showSuccess, formatErrorForUI } = useAgentErrorHandler();

// Parse and display error
const handleError = (error: unknown) => {
  showError(error, 'ROI withdrawal', agent, {
    showRetry: true,
    onRetry: retryOperation
  });
};

// Format error for custom UI
const errorInfo = formatErrorForUI(error, 'context', agent);
```

### 2. AgentErrorDisplay

Enhanced error display component:

```typescript
import { AgentErrorDisplay } from '@/components/agent/AgentErrorDisplay';

<AgentErrorDisplay
  error={error}
  context="ROI withdrawal"
  agent={agent}
  onRetry={handleRetry}
  compact={true}
  showRetryButton={true}
  autoRetryCountdown={true}
/>
```

### 3. AgentRetryMechanism

Intelligent retry logic with user controls:

```typescript
import { useAgentRetryMechanism } from '@/utils/agent-retry-mechanism';

const { executeWithRetry } = useAgentRetryMechanism('withdrawal');

const result = await executeWithRetry(
  () => withdrawRoi(agentId),
  {
    context: 'ROI withdrawal',
    agent,
    onRetryAttempt: (attempt, error) => {
      console.log(`Retry ${attempt}:`, error.message);
    },
    onUserConfirmation: async (error) => {
      return confirm('Retry this operation?');
    }
  }
);
```

### 4. AgentErrorBoundary

React error boundary for graceful failure recovery:

```typescript
import { AgentErrorBoundary } from '@/components/agent/AgentErrorBoundary';

<AgentErrorBoundary
  context="Agent Dashboard"
  onError={(error, errorInfo) => {
    console.error('Dashboard error:', error);
  }}
>
  <AgentDashboard />
</AgentErrorBoundary>
```

## Error Types and Handling

### Timing Errors (24-hour cooldowns)

```typescript
// Error Code: 6017 (WITHDRAWAL_TOO_EARLY)
// Display: Countdown timer with next available time
// Action: Show timer, allow user to set reminder
// Retry: Automatic after cooldown period
```

### Limit Errors (Yield caps, withdrawal limits)

```typescript
// Error Codes: 6016 (AGENT_RETIRED), 6018 (GLOBAL_WITHDRAWAL_LIMIT_REACHED)
// Display: Clear explanation of limit reached
// Action: Suggest activating new agents
// Retry: Not retryable, requires user action
```

### Network Errors (Connection issues)

```typescript
// Display: "Network busy" or "Connection error"
// Action: Automatic retry with exponential backoff
// Retry: Up to 5 attempts with increasing delays
```

### Contract Errors (Smart contract issues)

```typescript
// Error Codes: 6020 (INSUFFICIENT_SYSTEM_RESERVE), 2006 (SEEDS_CONSTRAINT)
// Display: Context-specific explanation
// Action: Wait and retry, or check wallet connection
// Retry: Limited retries with user confirmation
```

### Validation Errors (Input validation)

```typescript
// Error Codes: 6015 (INVALID_TIER), 6004 (INVALID_AMOUNT)
// Display: Specific validation message
// Action: Fix input and try again
// Retry: Not retryable until input is corrected
```

## Implementation Patterns

### 1. Service Layer Error Handling

```typescript
// In service functions
export async function withdrawAgentRoi(
  provider: AnchorProvider,
  activationId: number
): Promise<WithdrawAgentRoiResult> {
  try {
    // ... operation logic
    return { signature: txSignature };
  } catch (error) {
    // Let the error handler parse and format the error
    const agentError = AgentErrorHandler.parseError(error, 'ROI withdrawal');
    throw new Error(agentError.message);
  }
}
```

### 2. Component Error Handling

```typescript
// In React components
const handleWithdraw = async () => {
  try {
    setLoading(true);
    await withdrawRoi(agent.activationId);
    showSuccess('Withdrawal successful!');
  } catch (error) {
    showError(error, 'ROI withdrawal', agent, {
      showRetry: true,
      onRetry: handleWithdraw
    });
  } finally {
    setLoading(false);
  }
};
```

### 3. Retry with User Confirmation

```typescript
const { executeWithRetry } = useAgentRetryMechanism('activation');

const result = await executeWithRetry(
  () => activateAgent(params),
  {
    context: 'Agent activation',
    onUserConfirmation: async (error) => {
      // Show confirmation dialog for financial operations
      return window.confirm(
        `Activation failed: ${error.message}\n\nWould you like to retry?`
      );
    }
  }
);
```

## Error Message Guidelines

### 1. Be Specific and Actionable

❌ Bad: "Error occurred"
✅ Good: "Agent has reached its 200% yield cap and cannot generate more ROI"

### 2. Provide Context

❌ Bad: "Withdrawal failed"
✅ Good: "ROI withdrawal failed: 24-hour cooldown period is still active"

### 3. Suggest Next Steps

❌ Bad: "Invalid tier"
✅ Good: "Invalid agent tier selected. Please choose NOVA, VEGA, ORION, or PRIME"

### 4. Include Timing Information

❌ Bad: "Try again later"
✅ Good: "Next withdrawal available in 4 hours 23 minutes"

## Testing Error Handling

### 1. Unit Tests

```typescript
describe('AgentErrorHandler', () => {
  it('should parse timing errors correctly', () => {
    const error = new Error('WithdrawalTooEarly');
    const result = AgentErrorHandler.parseError(error, 'withdrawal', agent);
    
    expect(result.type).toBe('timing');
    expect(result.isRetryable).toBe(true);
    expect(result.retryDelay).toBeGreaterThan(0);
  });
});
```

### 2. Integration Tests

```typescript
describe('Agent ROI Withdrawal', () => {
  it('should handle cooldown errors gracefully', async () => {
    // Mock agent with recent withdrawal
    const agent = createMockAgent({ lastWithdrawal: Date.now() - 1000 });
    
    const result = await withdrawAgentRoi(provider, agent.activationId);
    
    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('timing');
  });
});
```

### 3. Error Simulation

```typescript
// For testing error handling in development
const simulateError = (errorType: string) => {
  switch (errorType) {
    case 'timing':
      throw new Error('WithdrawalTooEarly - 24 hour cooldown required');
    case 'limits':
      throw new Error('AgentRetired - yield cap reached');
    case 'network':
      throw new Error('Network connection failed');
    // ... other error types
  }
};
```

## Best Practices

### 1. Always Use Error Handler

```typescript
// ❌ Don't handle errors manually
catch (error) {
  console.error(error);
  setError('Something went wrong');
}

// ✅ Use the error handler
catch (error) {
  const agentError = showError(error, 'context', agent);
  setError(agentError.message);
}
```

### 2. Provide Retry Options

```typescript
// ✅ Always provide retry for retryable errors
showError(error, 'context', agent, {
  showRetry: true,
  onRetry: handleRetry
});
```

### 3. Use Error Boundaries

```typescript
// ✅ Wrap components in error boundaries
<AgentErrorBoundary context="Agent Card">
  <AgentCard agent={agent} onWithdraw={handleWithdraw} />
</AgentErrorBoundary>
```

### 4. Log Errors Appropriately

```typescript
// ✅ Log with context and structured data
console.error('Agent operation failed:', {
  operation: 'withdrawal',
  agentId: agent.activationId,
  tier: agent.tier,
  error: error.message,
  timestamp: new Date().toISOString()
});
```

## Error Code Reference

| Code | Name | Type | Retryable | Description |
|------|------|------|-----------|-------------|
| 6015 | INVALID_TIER | validation | No | Invalid agent tier (0-3) |
| 6016 | AGENT_RETIRED | limits | No | Agent reached yield cap |
| 6017 | WITHDRAWAL_TOO_EARLY | timing | Yes | 24-hour cooldown active |
| 6018 | GLOBAL_WITHDRAWAL_LIMIT_REACHED | limits | No | 200x deposit limit reached |
| 6019 | AGENT_NOT_FOUND | validation | Yes | Agent PDA not found |
| 6020 | INSUFFICIENT_SYSTEM_RESERVE | contract | Yes | System reserves low |
| 6000 | UNAUTHORIZED | validation | No | Access denied |
| 6003 | MATH_OVERFLOW | validation | No | Calculation overflow |
| 6004 | INVALID_AMOUNT | validation | No | Invalid amount |
| 6006 | INSUFFICIENT_FUNDS | validation | No | Insufficient balance |
| 2006 | SEEDS_CONSTRAINT | contract | Yes | PDA verification failed |

## Migration from Old Error Handling

### 1. Replace Manual Error Handling

```typescript
// Old way
catch (error) {
  if (error.message.includes('WithdrawalTooEarly')) {
    setError('Please wait 24 hours between withdrawals');
  } else {
    setError('Withdrawal failed');
  }
}

// New way
catch (error) {
  showError(error, 'ROI withdrawal', agent, {
    showRetry: true,
    onRetry: handleWithdraw
  });
}
```

### 2. Update Error Display Components

```typescript
// Old way
{error && (
  <div className="error-message">
    {error}
  </div>
)}

// New way
{error && (
  <AgentErrorDisplay
    error={error}
    context="operation"
    agent={agent}
    onRetry={handleRetry}
  />
)}
```

This enhanced error handling system provides a much better user experience while maintaining developer productivity and system reliability.