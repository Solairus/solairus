# License Activation Fix Implementation Plan

## 1. Fix LicenseGuard Component Issues

- [x] 1.1 Remove early return that bypasses license checking
  - Remove the `return <>{children}</>` line that prevents license validation
  - Ensure license guard properly checks environment variable
  - _Requirements: 1.1, 1.2_

- [x] 1.2 Fix React Hook conditional usage error
  - Move useEffect hook to top level to avoid conditional calling
  - Ensure hooks are called in the same order every render
  - _Requirements: 1.1_

- [ ] 1.3 Test license guard redirection functionality
  - Verify redirection to `/dapp/license-activation` for users without licenses
  - Test that license activation page allows access without validation
  - _Requirements: 1.1, 1.3_

## 2. Fix License Activation PDA Derivation

- [x] 2.1 Fix affiliate PDA derivation in activateLicenseUsdt function
  - Fetch user profile first to get actual sponsor information
  - Use real sponsor PublicKeys instead of placeholder keys
  - Derive affiliate PDAs with correct seeds: `[b"affiliate", sponsor_pubkey]`
  - _Requirements: 2.1, 2.3_

- [x] 2.2 Add proper error handling for missing user profiles
  - Check if user profile exists before license activation
  - Throw clear error message if profile not found
  - _Requirements: 2.2, 3.1_

- [x] 2.3 Fix TypeScript IDL address resolution errors
  - Fix the `Property 'address' does not exist on type 'unknown'` error
  - Use proper type casting for IDL address access
  - _Requirements: 2.1_

## 3. Enhance License Service Error Handling

- [x] 3.1 Remove automatic retry logic from license service
  - Remove the `retryTransaction` method calls for license activation
  - Remove `activateLicenseWithRetry` method that does automatic retries
  - Keep only manual retry capability through UI buttons
  - _Requirements: 3.4, 3.5_

- [ ] 3.2 Improve error categorization and messaging
  - Create clear, user-friendly error messages for common failures
  - Categorize errors by type (network, contract, wallet, user)
  - Provide specific guidance for seeds constraint violations
  - _Requirements: 3.1, 3.2_

- [ ] 3.3 Enhance registration prerequisite handling
  - Ensure user registration happens before license activation
  - Add proper wait time for registration confirmation
  - Handle registration failures gracefully
  - _Requirements: 2.2, 3.3_

## 4. Update Error Handler Implementation

- [x] 4.1 Modify LicenseErrorHandler to remove automatic retries
  - Update error handling to only suggest manual retries
  - Remove exponential backoff and automatic retry loops
  - Add clear messaging about manual retry options
  - _Requirements: 3.4, 3.5_

- [x] 4.2 Add specific error handling for seeds constraint violations
  - Detect error code 2006 (ConstraintSeeds)
  - Provide specific guidance for PDA-related errors
  - Suggest wallet reconnection and manual retry
  - _Requirements: 3.2_

## 5. Update UI Components for Better UX

- [ ] 5.1 Add manual retry buttons to license activation page
  - Replace automatic retry with user-controlled retry button
  - Show clear error messages with actionable guidance
  - Display transaction costs before retry attempts
  - _Requirements: 3.2, 3.4_

- [ ] 5.2 Improve license status display and error states
  - Show clear license status in UI
  - Display helpful error messages for activation failures
  - Add loading states for license operations
  - _Requirements: 4.3_

## 6. Testing and Validation

- [ ]* 6.1 Write unit tests for PDA derivation
  - Test affiliate PDA derivation with various sponsor configurations
  - Verify correct seeds format usage
  - Test error handling for missing profiles
  - _Requirements: 2.1, 2.3_

- [ ]* 6.2 Write integration tests for license activation flow
  - Test complete license activation process
  - Test registration + activation for new users
  - Test activation for existing users
  - _Requirements: 4.5_

- [ ] 6.3 Manual testing of error scenarios
  - Test seeds constraint error handling
  - Test network failure scenarios
  - Test insufficient funds scenarios
  - Verify no automatic retries occur
  - _Requirements: 3.1, 3.4, 3.5_

## 7. Performance and Security Validation

- [ ] 7.1 Validate PDA security implementation
  - Ensure affiliate PDAs use actual sponsor keys
  - Verify no seed manipulation is possible
  - Test with different sponsor configurations
  - _Requirements: 2.1, 2.4_

- [ ] 7.2 Verify cost-effectiveness for users
  - Ensure no automatic retries drain user funds
  - Test that failed transactions don't trigger additional costs
  - Validate manual retry functionality
  - _Requirements: 3.5_

## 8. Documentation and Cleanup

- [ ]* 8.1 Update code comments and documentation
  - Document the correct PDA derivation process
  - Add comments explaining affiliate account structure
  - Update error handling documentation
  - _Requirements: 3.6_

- [ ]* 8.2 Clean up unused automatic retry code
  - Remove unused retry methods and utilities
  - Clean up performance monitoring for retries
  - Update license service interface
  - _Requirements: 3.5_