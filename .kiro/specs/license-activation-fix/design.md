# License Activation Fix Design

## Overview

This design addresses the critical issues preventing users from successfully activating licenses and accessing protected dApp features. The main problems are: (1) license guard not redirecting users properly, and (2) seeds constraint violations during license activation due to incorrect affiliate PDA derivation.

## Architecture

### Component Structure

```
LicenseGuard (Fixed)
├── License Context (Enhanced)
├── License Service (Fixed PDA derivation)
├── Error Handler (User-controlled retries)
└── UI Components (Better error messages)
```

### Data Flow

1. **License Check Flow:**

   - User accesses protected route
   - LicenseGuard checks license status via License Context
   - If invalid license → redirect to activation page
   - If valid license → allow access

2. **License Activation Flow:**
   - Check if user profile exists
   - If no profile → register user first (prerequisite)
   - Fetch user profile to get sponsor information
   - Derive correct affiliate PDAs using sponsor keys
   - Submit license activation transaction
   - Handle errors with clear messages and manual retry options

## Components and Interfaces

### 1. LicenseGuard Component Fix

**Issue:** Early return bypassing license checking
**Solution:** Remove the early return and fix React Hook conditional usage

```typescript
// BEFORE (broken):
return <>{children}</>; // Early return bypassing all logic

// AFTER (fixed):
React.useEffect(() => {
  if (
    isConnected &&
    !licenseInfo.isValid &&
    !isLoading &&
    !isLicenseActivationPage
  ) {
    navigate("/dapp/license-activation", { replace: true });
  }
}, [
  isConnected,
  licenseInfo.isValid,
  isLoading,
  isLicenseActivationPage,
  navigate,
]);
```

### 2. License Activation PDA Derivation Fix

**Issue:** Using placeholder keys instead of actual sponsor keys
**Solution:** Fetch user profile first, then derive affiliate PDAs correctly

```typescript
// BEFORE (broken):
const affL1 = PublicKey.findProgramAddressSync(
  [
    Buffer.from("affiliate"),
    PublicKey.default.toBuffer(), // Wrong: placeholder
  ],
  PROGRAM_ID
)[0];

// AFTER (fixed):
const userProfile = await accounts(program).UserProfile.fetch(profile);
const affL1 = PublicKey.findProgramAddressSync(
  [
    Buffer.from("affiliate"),
    userProfile.sponsorL1.toBuffer(), // Correct: actual sponsor
  ],
  PROGRAM_ID
)[0];
```

### 3. Error Handling Enhancement

**Design Principles:**

- No automatic retries (cost-conscious)
- Clear, actionable error messages
- Manual retry buttons
- Detailed logging for debugging

```typescript
interface LicenseError {
  type: "network" | "contract" | "wallet" | "user";
  message: string;
  originalError: Error;
  isRetryable: boolean;
  suggestedAction: string;
}
```

### 4. License Service Improvements

**Enhanced Flow:**

1. Check if user needs registration
2. If needed, register user (prerequisite, not retry)
3. Wait for registration confirmation
4. Fetch updated user profile
5. Derive affiliate PDAs correctly
6. Submit license activation
7. Handle errors gracefully

## Data Models

### User Profile Structure

```typescript
interface UserProfile {
  user: PublicKey;
  sponsorL1: PublicKey; // Used for aff_l1 PDA derivation
  sponsorL2: PublicKey; // Used for aff_l2 PDA derivation
  sponsorL3: PublicKey; // Used for aff_l3 PDA derivation
  createdAt: anchor.BN;
  activePrincipalUsdt: anchor.BN;
  lastRoiWithdrawAt: anchor.BN;
  licenseExpiresAt: anchor.BN;
}
```

### Affiliate PDA Derivation

```typescript
// Each sponsor has their own AffiliateEarnings PDA
// Seeds: [b"affiliate", sponsor_pubkey]
const affL1 = PublicKey.findProgramAddressSync(
  [Buffer.from("affiliate"), userProfile.sponsorL1.toBuffer()],
  PROGRAM_ID
)[0];
```

## Error Handling

### Error Categories and Responses

1. **Seeds Constraint Violation (2006)**

   - **Cause:** Incorrect PDA derivation
   - **Message:** "Account verification failed. Please ensure your wallet is connected and try again."
   - **Action:** Manual retry button
   - **Fix:** Use correct sponsor keys for affiliate PDA derivation

2. **User Profile Not Found**

   - **Cause:** User not registered
   - **Message:** "Setting up your account..."
   - **Action:** Automatic registration (prerequisite)
   - **Fix:** Register user before license activation

3. **Network/RPC Issues**

   - **Cause:** Connection problems
   - **Message:** "Network connection issue. Please check your connection and try again."
   - **Action:** Manual retry button
   - **Fix:** User-controlled retry

4. **Insufficient Funds**
   - **Cause:** Not enough USDT
   - **Message:** "Insufficient USDT balance. You need 25 USDT to activate your license."
   - **Action:** Link to get USDT
   - **Fix:** User needs to fund their wallet

### Error Handler Implementation

```typescript
class LicenseErrorHandler {
  static categorizeError(error: unknown): LicenseError {
    // Categorize errors and provide appropriate responses
    // No automatic retries - only manual retry suggestions
  }

  static getRetryStrategy(error: LicenseError): "manual" | "none" {
    // Always return 'manual' or 'none' - never automatic
  }
}
```

## Testing Strategy

### Unit Tests

- PDA derivation correctness
- Error categorization
- License status validation

### Integration Tests

- End-to-end license activation flow
- Error handling scenarios
- License guard redirection

### Manual Testing Scenarios

1. New user without profile → registration + activation
2. Existing user with profile → direct activation
3. Network failure → manual retry
4. Seeds constraint error → proper error message
5. License guard redirection → proper navigation

## Implementation Approach

### Phase 1: Fix Critical Issues

1. Remove early return from LicenseGuard
2. Fix React Hook conditional usage
3. Fix affiliate PDA derivation in license activation
4. Test basic license activation flow

### Phase 2: Enhance Error Handling

1. Implement proper error categorization
2. Add manual retry buttons
3. Improve error messages
4. Remove automatic retry logic

### Phase 3: Validation and Testing

1. Test all error scenarios
2. Validate license guard redirection
3. Ensure no automatic retries occur
4. Verify cost-effectiveness for users

## Security Considerations

1. **PDA Security:** Affiliate PDAs are derived using sponsor PublicKeys as seeds, ensuring each sponsor has their own earnings account
2. **No Seed Manipulation:** Using actual sponsor keys prevents users from manipulating affiliate earnings
3. **Registration Prerequisite:** User profile must exist before license activation to ensure proper sponsor relationships
4. **Cost Protection:** No automatic retries protect users from unexpected gas costs

## Performance Considerations

1. **Single Profile Fetch:** Fetch user profile once and reuse for PDA derivation
2. **Efficient Error Handling:** Quick error categorization without expensive operations
3. **Manual Retries Only:** No automatic retry loops that could drain user funds
4. **Optimized PDA Derivation:** Use cached sponsor information when possible
