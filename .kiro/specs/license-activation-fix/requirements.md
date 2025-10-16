# License Activation Fix Requirements

## Introduction

The license activation system is currently failing with a seeds constraint violation error when users try to activate their licenses. The error indicates that the affiliate PDA derivation is not matching what the smart contract expects. Additionally, the license guard is not properly redirecting users to the license activation page despite being enabled.

## Requirements

### Requirement 1: Fix License Guard Redirection

**User Story:** As a user without a valid license, I want to be automatically redirected to the license activation page when I try to access protected dApp features, so that I can purchase a license.

#### Acceptance Criteria

1. WHEN a user accesses a protected dApp route AND they don't have a valid license THEN the system SHALL redirect them to `/dapp/license-activation`
2. WHEN the license guard is enabled via `VITE_ENABLE_LICENSE_GUARD=true` THEN the system SHALL enforce license checking
3. WHEN a user is on the license activation page THEN the system SHALL allow access without license validation
4. WHEN a user has a valid license THEN the system SHALL allow access to protected routes
5. WHEN a user has a near-expiry license THEN the system SHALL show an expiry notification but still allow access

### Requirement 2: Fix License Activation Seeds Constraint Error

**User Story:** As a user trying to purchase a license, I want the license activation transaction to succeed, so that I can access the dApp features.

#### Acceptance Criteria

1. WHEN a user attempts to activate a license THEN the system SHALL properly derive affiliate PDAs using the user's sponsor information
2. WHEN a user doesn't have a profile yet THEN the system SHALL register them first before license activation
3. WHEN deriving affiliate PDAs THEN the system SHALL use the correct seeds format: `[b"affiliate", sponsor_pubkey]`
4. WHEN a user's sponsors are not set THEN the system SHALL use the dev key as default sponsors
5. WHEN the license activation transaction is submitted THEN it SHALL succeed without seeds constraint violations

### Requirement 3: Improve Error Handling and User Experience

**User Story:** As a user experiencing license activation issues, I want clear error messages and manual retry options, so that I can understand what went wrong and decide whether to try again.

#### Acceptance Criteria

1. WHEN a license activation fails THEN the system SHALL provide a clear, user-friendly error message
2. WHEN a seeds constraint error occurs THEN the system SHALL suggest checking wallet connection and provide a manual retry button
3. WHEN a user profile is missing THEN the system SHALL automatically attempt registration before license activation (this is a prerequisite, not a retry)
4. WHEN network issues occur THEN the system SHALL provide a manual retry button without automatic retries
5. WHEN a transaction fails THEN the system SHALL NOT automatically retry to avoid unnecessary gas costs for the user
6. WHEN debugging is needed THEN the system SHALL log detailed error information for developers

### Requirement 4: Validate License System Integration

**User Story:** As a developer, I want to ensure the license system works end-to-end, so that users can successfully purchase and use licenses.

#### Acceptance Criteria

1. WHEN the system starts THEN it SHALL properly initialize the license context and services
2. WHEN a user connects their wallet THEN the system SHALL check their license status
3. WHEN license status changes THEN the UI SHALL update accordingly
4. WHEN a license expires THEN the system SHALL redirect users to renewal
5. WHEN testing the license flow THEN all components SHALL work together seamlessly