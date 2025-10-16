# License Status Debug Design

## Overview

This design addresses the false positive license status issue by implementing comprehensive debugging tools, fixing error handling in license status determination, and ensuring cache consistency. The solution focuses on identifying the root cause of incorrect license status display and implementing robust fixes.

## Architecture

### Core Components

1. **License Status Validator** - Validates license status against on-chain reality
2. **Cache Manager** - Handles license cache validation and cleanup
3. **Debug Utilities** - Tools for inspecting and debugging license status
4. **Error Handler** - Proper error handling for license status determination

### Data Flow

```
Wallet Connection → License Service → On-chain Check → Cache Validation → Status Display
                                   ↓
                              Debug Logger → Console/UI Feedback
```

## Components and Interfaces

### 1. License Status Validator

```typescript
interface LicenseStatusValidator {
  validateOnChain(userPubkey: PublicKey): Promise<LicenseValidationResult>;
  validateCache(userPubkey: PublicKey): CacheValidationResult;
  reconcileStatus(onChain: LicenseInfo, cached: LicenseInfo): LicenseInfo;
}

interface LicenseValidationResult {
  hasProfile: boolean;
  profileData: UserProfile | null;
  licenseInfo: LicenseInfo;
  rawAccountData?: Buffer;
  validationTimestamp: number;
}

interface CacheValidationResult {
  isValid: boolean;
  isExpired: boolean;
  cachedInfo: LicenseInfo | null;
  shouldRefresh: boolean;
  issues: string[];
}
```

### 2. Enhanced License Service

```typescript
interface EnhancedLicenseService extends LicenseService {
  validateLicenseStatus(userPubkey: PublicKey): Promise<LicenseValidationResult>;
  debugLicenseStatus(userPubkey: PublicKey): Promise<LicenseDebugInfo>;
  clearLicenseCache(userPubkey: PublicKey): void;
  forceLicenseRefresh(userPubkey: PublicKey): Promise<LicenseInfo>;
}

interface LicenseDebugInfo {
  onChainStatus: LicenseValidationResult;
  cacheStatus: CacheValidationResult;
  serviceState: {
    isInitialized: boolean;
    hasProvider: boolean;
    programId: string;
  };
  recommendations: string[];
}
```

### 3. Debug Utilities

```typescript
interface LicenseDebugUtils {
  inspectOnChainData(userPubkey: PublicKey): Promise<OnChainInspection>;
  inspectCache(): CacheInspection;
  generateDebugReport(userPubkey: PublicKey): Promise<DebugReport>;
  clearAllLicenseData(): void;
}

interface OnChainInspection {
  profileExists: boolean;
  profilePda: string;
  accountInfo: AccountInfo<Buffer> | null;
  decodedData: UserProfile | null;
  rawDataHex: string;
}

interface CacheInspection {
  totalEntries: number;
  licenseEntries: LicenseCacheEntry[];
  expiredEntries: number;
  corruptedEntries: number;
}

interface DebugReport {
  timestamp: string;
  userPubkey: string;
  onChainInspection: OnChainInspection;
  cacheInspection: CacheInspection;
  currentStatus: LicenseInfo;
  issues: Issue[];
  recommendations: string[];
}
```

## Data Models

### Enhanced License Info

```typescript
interface EnhancedLicenseInfo extends LicenseInfo {
  source: 'onchain' | 'cache' | 'default';
  lastValidated: number;
  validationMethod: 'full' | 'cached' | 'error-fallback';
  debugInfo?: {
    profileExists: boolean;
    cacheHit: boolean;
    errors: string[];
  };
}
```

### License Cache Entry

```typescript
interface LicenseCacheEntry {
  userPubkey: string;
  licenseInfo: LicenseInfo;
  timestamp: number;
  expiresAt: number;
  validationHash: string; // Hash of on-chain data for validation
}
```

## Error Handling

### 1. License Status Error Recovery

- **Network Errors**: Default to 'none' status, provide retry option
- **Account Not Found**: Return 'none' status (expected for new users)
- **Invalid Account Data**: Clear cache, return 'none' status
- **Service Initialization Errors**: Show error state with manual retry

### 2. Cache Error Handling

- **Corrupted Cache Data**: Clear entry, fetch fresh data
- **Expired Cache**: Remove entry, fetch fresh data
- **Cache Validation Failure**: Clear all cache, start fresh

### 3. Debug Error Handling

- **On-chain Inspection Errors**: Log error, continue with available data
- **Debug Report Generation Errors**: Provide partial report with error details

## Testing Strategy

### 1. Unit Tests

- License status validation logic
- Cache validation and cleanup
- Error handling scenarios
- Debug utility functions

### 2. Integration Tests

- End-to-end license status flow
- Cache consistency validation
- Error recovery scenarios
- Debug report generation

### 3. Manual Testing Scenarios

- Fresh wallet connection (no profile)
- Wallet with expired cache data
- Network error during license check
- Corrupted cache data scenarios
- Multiple wallet switching

## Implementation Approach

### Phase 1: Debug Infrastructure
1. Implement license status validator
2. Create debug utilities
3. Add comprehensive logging

### Phase 2: Error Handling Fixes
1. Fix license service error handling
2. Implement proper cache validation
3. Add error recovery mechanisms

### Phase 3: User Experience
1. Add debug UI components
2. Implement manual refresh options
3. Add status validation indicators

### Phase 4: Monitoring & Maintenance
1. Add performance monitoring
2. Implement cache health checks
3. Add automated error reporting

## Security Considerations

- Always default to 'no license' on errors for security
- Validate cache data against on-chain reality
- Clear sensitive cache data on logout
- Prevent cache poisoning attacks
- Log security-relevant license status changes

## Performance Considerations

- Minimize on-chain calls through smart caching
- Implement request deduplication
- Use background refresh for better UX
- Optimize debug utilities for production use
- Cache validation results temporarily