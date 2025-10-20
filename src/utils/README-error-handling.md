# Admin Error Handling System

This document describes the comprehensive error handling system implemented for the admin interface.

## Overview

The error handling system provides:
- Contract error parsing with specific error codes
- User-friendly error messages for admin operations
- Transaction status tracking and retry mechanisms
- Loading states and progress indicators
- Comprehensive error boundaries

## Components

### 1. AdminErrorHandler (`src/utils/admin-error-handler.ts`)

Central error handling utility that parses and categorizes admin-related errors.

#### Error Types
- **network**: Connection/RPC issues (retryable)
- **contract**: Smart contract errors including authorization (retryable)
- **validation**: Input validation errors (not retryable)
- **transaction**: Transaction-specific errors (retryable)
- **authorization**: Permission/role-based errors (not retryable)
- **unknown**: Unexpected errors (retryable)

#### Error Codes
The system recognizes specific Anchor error codes:
- `6000`: Unauthorized
- `6001`: Invalid percentage
- `6002`: Invalid config sum
- `6003`: Math overflow
- `6004`: Invalid amount
- `2006`: Seeds constraint violation

#### Usage
```typescript
import { useAdminErrorHandler } from '@/utils/admin-error-handler';

const { showError, showSuccess } = useAdminErrorHandler();

// Show error with retry option
showError(error, 'Bucket withdrawal', {
  showRetry: true,
  onRetry: () => handleRetry(),
});

// Show success message
showSuccess('Operation completed successfully', {
  description: 'Transaction: abc123...',
});
```

### 2. Transaction Status Hook (`src/hooks/useTransactionStatus.ts`)

Manages transaction lifecycle with progress tracking and retry mechanisms.

#### Features
- Step-based progress tracking
- Automatic retry with exponential backoff
- Transaction confirmation tracking
- Loading states and user feedback

#### Usage
```typescript
import { useTransactionStatus } from '@/hooks/useTransactionStatus';

const transactionStatus = useTransactionStatus({
  steps: [
    { id: 'validate', label: 'Validating operation' },
    { id: 'sign', label: 'Waiting for signature' },
    { id: 'confirm', label: 'Confirming transaction' },
  ],
  onSuccess: (signature) => {
    console.log('Transaction successful:', signature);
  },
  onError: (error) => {
    console.error('Transaction failed:', error);
  },
});

// Execute transaction
await transactionStatus.executeTransaction(async () => {
  return await performBlockchainOperation();
}, 'Operation context');
```

### 3. Loading State Hook (`src/hooks/useLoadingState.ts`)

Manages multiple concurrent loading operations with progress indicators.

#### Features
- Multiple concurrent operations
- Progress tracking with messages
- Automatic timeout handling
- Specialized hooks for forms and data fetching

#### Usage
```typescript
import { useLoadingState, useFormLoadingState } from '@/hooks/useLoadingState';

const loading = useLoadingState();
const formLoading = useFormLoadingState();

// Start loading operation
loading.startLoading('operation-id', {
  message: 'Processing...',
  timeout: 30000,
});

// Submit form with loading
await formLoading.submitWithLoading('form-id', async () => {
  return await submitForm();
});
```

### 4. Retry Mechanism Hook (`src/hooks/useRetryMechanism.ts`)

Provides intelligent retry mechanisms with circuit breaker pattern.

#### Features
- Exponential backoff with jitter
- Configurable retry conditions
- Circuit breaker for network operations
- Retry history tracking

#### Usage
```typescript
import { useRetryMechanism, useNetworkRetry } from '@/hooks/useRetryMechanism';

const retry = useRetryMechanism({
  maxRetries: 3,
  baseDelay: 1000,
});

// Execute with retry
const result = await retry.executeWithRetry(async () => {
  return await riskyOperation();
}, 'Operation context');
```

### 5. Progress Indicators (`src/components/admin/ProgressIndicator.tsx`)

Visual components for displaying progress and loading states.

#### Components
- `ProgressIndicator`: Basic progress bar with percentage
- `StepProgress`: Step-based progress visualization
- `LoadingCard`: Complete loading interface with steps
- `ErrorIndicator`: Error display with retry option

#### Usage
```typescript
import { LoadingCard, StepProgress } from '@/components/admin/ProgressIndicator';

// Loading card with steps
<LoadingCard
  title="Processing Transaction"
  message="Please wait..."
  progress={75}
  steps={transactionSteps}
  showCancel={true}
  onCancel={() => cancelOperation()}
/>

// Step progress
<StepProgress
  steps={steps}
  variant="horizontal"
  showMessages={true}
/>
```

### 6. Error Boundary (`src/components/admin/AdminErrorBoundary.tsx`)

React error boundary for catching and handling component errors.

#### Features
- Graceful error handling with fallback UI
- Error reporting and logging
- Recovery mechanisms
- User-friendly error messages

#### Usage
```typescript
import { AdminErrorBoundary, withAdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';

// Wrap component
<AdminErrorBoundary>
  <AdminComponent />
</AdminErrorBoundary>

// HOC usage
const SafeComponent = withAdminErrorBoundary(AdminComponent);
```

## Integration Examples

### Bucket Withdrawal with Error Handling

```typescript
const { showError, showSuccess } = useAdminErrorHandler();

const transactionStatus = useTransactionStatus({
  steps: [
    { id: 'validate', label: 'Validating withdrawal' },
    { id: 'sign', label: 'Waiting for signature' },
    { id: 'confirm', label: 'Confirming transaction' },
  ],
  onSuccess: (signature) => {
    showSuccess(`Successfully withdrew ${amount} USDT`, {
      description: `Transaction: ${signature.slice(0, 8)}...`,
    });
  },
  onError: (error) => {
    showError(error.originalError, 'Bucket withdrawal', {
      showRetry: error.isRetryable,
      onRetry: () => handleWithdraw(),
    });
  },
});

const handleWithdraw = async () => {
  if (!validateInputs()) return;

  await transactionStatus.executeTransaction(async () => {
    transactionStatus.updateProgress(20, 'validate');
    
    const txSignature = await withdrawFromBucket({
      provider: anchorProvider,
      bucketType,
      amount: amountBN,
      authority: publicKey,
    });

    return txSignature;
  }, 'Bucket withdrawal');
};
```

### Form Submission with Loading States

```typescript
const { showError, showSuccess } = useAdminErrorHandler();
const formLoading = useFormLoadingState();

const handleSubmit = async (formData) => {
  try {
    await formLoading.submitWithLoading('config-form', async () => {
      const result = await updateConfiguration(formData);
      
      showSuccess('Configuration updated successfully');
      return result;
    }, {
      message: 'Updating configuration...',
      timeout: 60000,
    });
  } catch (error) {
    showError(error, 'Configuration update', {
      showRetry: true,
      onRetry: () => handleSubmit(formData),
    });
  }
};
```

## Best Practices

### 1. Error Context
Always provide context when handling errors:
```typescript
showError(error, 'Bucket withdrawal'); // Good
showError(error); // Less helpful
```

### 2. Retry Logic
Only enable retry for appropriate error types:
```typescript
showError(error, context, {
  showRetry: error.isRetryable && error.type !== 'validation',
  onRetry: () => retryOperation(),
});
```

### 3. Progress Updates
Update progress at meaningful points:
```typescript
await transactionStatus.executeTransaction(async () => {
  transactionStatus.updateProgress(20, 'validate');
  // ... validation logic
  
  transactionStatus.updateProgress(60, 'sign');
  // ... signing logic
  
  return result;
});
```

### 4. Loading States
Use appropriate loading components:
```typescript
// For simple operations
{loading.isLoading && <Spinner />}

// For complex operations with steps
{transactionStatus.isLoading && (
  <LoadingCard
    title="Processing"
    steps={transactionStatus.state.steps}
    progress={transactionStatus.state.progress}
  />
)}
```

### 5. Error Boundaries
Wrap admin components with error boundaries:
```typescript
// In AdminDashboard
const renderConfigContent = () => (
  <AdminErrorBoundary>
    <ConfigManagement />
  </AdminErrorBoundary>
);
```

## Testing

The error handling system includes comprehensive tests:

- `src/utils/__tests__/admin-error-handler.test.ts`
- `src/hooks/__tests__/useTransactionStatus.test.ts`

Run tests with:
```bash
npm run test src/utils/__tests__/admin-error-handler.test.ts
npm run test src/hooks/__tests__/useTransactionStatus.test.ts
```

## Error Monitoring

The system is designed to integrate with error monitoring services:

```typescript
// In AdminErrorBoundary
const reportError = (error, errorInfo, adminError) => {
  // Send to monitoring service
  // Example: Sentry.captureException(error, { extra: errorReport });
};
```

## Future Enhancements

1. **Analytics Integration**: Track error patterns and user behavior
2. **Offline Support**: Handle network disconnections gracefully
3. **Performance Monitoring**: Track transaction times and success rates
4. **User Feedback**: Collect user feedback on error experiences
5. **Automated Recovery**: Implement more sophisticated recovery mechanisms