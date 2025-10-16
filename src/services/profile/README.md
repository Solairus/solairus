# Enhanced Profile Error Handling and Diagnostics

This module provides comprehensive error handling and diagnostics for profile account operations, addressing the `AccountDidNotDeserialize` errors and other profile-related issues.

## Features

### Enhanced Error Types (`profile-error-types.ts`)

- **Comprehensive Error Classification**: 14 different error types covering all possible profile operation failures
- **Structured Error Information**: Each error includes technical details, user-friendly messages, and suggested actions
- **Error Severity Levels**: Low, medium, high, and critical severity classification
- **Recovery Information**: Indicates whether errors are recoverable and retryable
- **Context Tracking**: Includes operation context, attempt counts, and environment information

### Comprehensive Diagnostics (`profile-diagnostics.ts`)

- **Operation Tracing**: Track complex operations with detailed step-by-step logging
- **Account State Inspection**: Deep analysis of account structure, size, and data integrity
- **PDA Derivation Diagnostics**: Validate Program Derived Address generation
- **Performance Monitoring**: Track operation duration and identify bottlenecks
- **Export Capabilities**: Generate diagnostic reports for support and debugging

### Integration Utilities (`profile-integration-utils.ts`)

- **Enhanced Service Manager**: Unified interface for profile operations with automatic error handling
- **Automatic Recovery**: Intelligent recovery attempts based on error classification
- **User-Friendly Error Formatting**: Convert technical errors to actionable user messages
- **Diagnostic Reporting**: Generate comprehensive diagnostic reports

## Usage Examples

### Basic Error Handling

```typescript
import { ProfileErrorFactory, ProfileErrorFormatter } from '@/services/profile';

try {
  // Some profile operation
} catch (error) {
  const profileError = ProfileErrorFactory.fromException(error, {
    userPubkey: userPubkey.toString(),
    operation: 'profile_validation',
    attemptCount: 1,
    environment: 'production',
  });

  // Format for user display
  const userMessage = ProfileErrorFormatter.formatForUser(profileError);
  console.log(userMessage.title, userMessage.message);

  // Check if recoverable
  if (profileError.isRecoverable) {
    // Attempt recovery
  }
}
```

### Enhanced Profile Service Manager

```typescript
import { createEnhancedProfileServiceManager } from '@/services/profile';

const profileManager = createEnhancedProfileServiceManager(program, provider);

// Validate profile with automatic error handling
const validationResult = await profileManager.validateProfile(userPubkey);

if (!validationResult.isValid && validationResult.canRecover) {
  // Attempt automatic recovery
  const recoveryResult = await profileManager.recoverProfile(userPubkey, sponsor);
  
  if (recoveryResult.success) {
    console.log('Profile recovered successfully');
  }
}
```

### Diagnostic Reporting

```typescript
import { ProfileDiagnosticsService } from '@/services/profile';

const diagnostics = new ProfileDiagnosticsService(program, provider);

// Get comprehensive diagnostic information
const diagnosticInfo = await diagnostics.getDiagnosticInfo(userPubkey);

// Inspect account state in detail
const accountInspection = await diagnostics.inspectAccountState(profilePda);

// Export diagnostic data for support
const supportData = diagnostics.exportDiagnosticData(userPubkey);
```

### Operation Tracing

```typescript
import { getGlobalDiagnostics } from '@/services/profile';

const diagnostics = getGlobalDiagnostics();

if (diagnostics) {
  const operationId = `registration_${Date.now()}`;
  const trace = diagnostics.startTrace(operationId, 'userRegistration', context);
  
  try {
    diagnostics.addTraceStep(operationId, 'validation', 'Validate user input');
    // ... validation logic
    diagnostics.completeTraceStep(operationId, 'validation', 'success');
    
    diagnostics.addTraceStep(operationId, 'registration', 'Register user profile');
    // ... registration logic
    diagnostics.completeTraceStep(operationId, 'registration', 'success');
    
    diagnostics.completeTrace(operationId, 'success');
  } catch (error) {
    diagnostics.completeTrace(operationId, 'failure', profileError);
  }
}
```

## Error Types

| Error Type | Code | Severity | Recoverable | Description |
|------------|------|----------|-------------|-------------|
| `account_not_found` | PROFILE_001 | Low | Yes | Profile account doesn't exist |
| `deserialization_failed` | PROFILE_002 | High | Yes | Account data can't be deserialized |
| `size_mismatch` | PROFILE_003 | High | Yes | Account has incorrect size |
| `data_corruption` | PROFILE_004 | Critical | Yes | Account data is corrupted |
| `owner_mismatch` | PROFILE_005 | Critical | No | Account has wrong owner |
| `invalid_structure` | PROFILE_006 | Medium | Yes | Account structure mismatch |
| `pda_derivation_failed` | PROFILE_007 | Medium | Yes | PDA derivation failed |
| `network_error` | PROFILE_008 | Medium | Yes | Network connectivity issue |
| `insufficient_funds` | PROFILE_009 | Medium | Yes | Not enough SOL for operation |
| `program_error` | PROFILE_010 | High | Yes | Smart contract error |
| `validation_failed` | PROFILE_011 | Medium | Yes | Profile validation failed |
| `recovery_failed` | PROFILE_012 | Critical | No | Recovery attempts failed |
| `timeout_error` | PROFILE_013 | Medium | Yes | Operation timed out |
| `unknown_error` | PROFILE_999 | Medium | Yes | Unknown error occurred |

## Integration with Existing Services

The enhanced error handling and diagnostics are designed to integrate seamlessly with existing profile services:

1. **ProfileAccountValidator**: Now uses enhanced error types and logging
2. **AccountRecoveryService**: Integrated with diagnostics and operation tracing
3. **License Service**: Can be updated to use the enhanced profile service manager

## Requirements Addressed

- **2.1**: Comprehensive error handling with detailed technical information
- **2.2**: User-friendly error messages with suggested actions  
- **2.3**: Diagnostic information for PDA derivation and account structure
- **2.4**: Debugging utilities to inspect account state and data
- **2.5**: Error classification system for different failure types

## Testing

The module includes comprehensive tests covering:
- Error creation and classification
- Error formatting for users and logging
- Utility functions for error handling
- Context information and environment detection

Run tests with:
```bash
npm test src/services/profile/__tests__/enhanced-error-handling.test.ts
```