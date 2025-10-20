# Requirements Document

## Introduction

This feature enables administrators and developers to manually activate user licenses without requiring USDT payment from either the user or admin. This is intended for administrative purposes such as promotional activations, customer service resolutions, or testing scenarios.

## Glossary

- **Admin**: The administrative authority with elevated privileges in the system
- **Dev**: The development authority with elevated privileges in the system  
- **User**: Any participant in the system who can receive a license
- **License Activation**: The process of granting a user access to system features for a specified duration
- **Manual Activation**: License activation performed by admin/dev without USDT payment
- **License Duration**: The number of days the license remains valid
- **System**: The Solairus smart contract program

## Requirements

### Requirement 1

**User Story:** As an admin, I want to manually activate a user's license without USDT payment, so that I can provide promotional licenses or resolve customer service issues.

#### Acceptance Criteria

1. WHEN an admin calls the manual license activation method, THE System SHALL verify the caller is authorized as admin or dev
2. WHEN the target user does not exist, THE System SHALL automatically register the user with the provided sponsor
3. WHEN the target user already exists, THE System SHALL proceed with license activation without modifying existing user data
4. WHEN license activation is requested, THE System SHALL set the license expiration to current timestamp plus the specified days
5. WHERE the user already has an active license, THE System SHALL extend the license from the current expiration date

### Requirement 2

**User Story:** As a dev, I want to specify custom license durations and extension behavior during manual activation, so that I can provide flexible licensing terms for different scenarios.

#### Acceptance Criteria

1. WHEN manual activation is called, THE System SHALL accept a license duration parameter in days
2. WHEN the duration parameter is provided, THE System SHALL validate it is greater than zero
3. WHEN calculating expiration, THE System SHALL convert days to seconds (days × 24 × 60 × 60)
4. WHEN manual activation is called, THE System SHALL accept an extend_existing boolean parameter
5. IF extend_existing is true AND user has active license, THEN THE System SHALL extend from current expiration date
6. IF extend_existing is false OR user has no active license, THEN THE System SHALL set expiration from current timestamp
7. THE System SHALL emit a license activation event with the manual activation flag and extension behavior

### Requirement 3

**User Story:** As an admin, I want manual license activations to be tracked separately from paid activations, so that I can distinguish between revenue-generating and promotional activations.

#### Acceptance Criteria

1. WHEN manual activation occurs, THE System SHALL emit a distinct event type for tracking
2. THE System SHALL NOT update any USDT buckets or financial tracking since no actual USDT is spent
3. THE System SHALL NOT distribute affiliate commissions for manual activations since no real money is involved
4. THE System SHALL NOT transfer any USDT tokens during manual activation process
5. THE System SHALL record the activation with a "Manual" payment method in events
6. THE System SHALL include the authorizing admin/dev address in the event data
7. THE System SHALL maintain financial integrity by keeping manual activations separate from revenue operations

### Requirement 4

**User Story:** As a system user, I want manual activations to provide the same license benefits as paid activations, so that I receive full system access regardless of activation method.

#### Acceptance Criteria

1. WHEN manual activation completes, THE System SHALL set license_expires_at to the calculated expiration timestamp
2. THE System SHALL allow the user to access all licensed features during the active period
3. THE System SHALL treat manually activated licenses identically to paid licenses for feature access
4. THE System SHALL allow license extensions through subsequent manual or paid activations
5. THE System SHALL maintain all existing user profile data during manual activation

### Requirement 5

**User Story:** As a security-conscious admin, I want manual license activation to have proper access controls, so that only authorized personnel can perform these operations.

#### Acceptance Criteria

1. THE System SHALL restrict manual activation to admin and dev authorities only
2. WHEN an unauthorized user attempts manual activation, THE System SHALL reject the transaction with Unauthorized error
3. THE System SHALL verify the caller's authority against the stored admin and dev addresses in config
4. THE System SHALL require the authority to sign the transaction
5. THE System SHALL validate all account constraints and PDAs before processing

### Requirement 6

**User Story:** As an admin, I want access to a dedicated admin interface at /dapp/special, so that I can perform administrative functions through a secure web interface.

#### Acceptance Criteria

1. THE System SHALL provide a protected route at /dapp/special accessible to admin, dev, marketer1, and marketer2
2. WHEN a user accesses /dapp/special, THE System SHALL verify their connected wallet against authorized addresses in environment variables
3. WHEN the connected wallet matches an authorized address, THE System SHALL grant role-appropriate access to the interface
4. WHEN the connected wallet does not match any authorized addresses, THE System SHALL deny access and redirect
5. THE System SHALL maintain session-based access control and role-based permissions throughout the interface

### Requirement 7

**User Story:** As a dev, I want to update system configuration values through the admin interface, so that I can modify roles and settings without redeploying the contract.

#### Acceptance Criteria

1. WHEN dev accesses the admin interface, THE System SHALL display configuration management section
2. THE System SHALL allow dev to update role public keys (admin, marketer1, marketer2, trader, systemreserve)
3. THE System SHALL allow dev to modify percentage configurations for license and agent distributions
4. THE System SHALL allow dev to update system parameters (ROI rate, license duration, activation fees)
5. WHEN configuration changes are submitted, THE System SHALL call the appropriate contract update methods

### Requirement 8

**User Story:** As an admin or dev, I want to view and withdraw from system buckets, so that I can manage system finances and distribute earnings.

#### Acceptance Criteria

1. THE System SHALL display current balances for all system buckets (admin, dev, marketer1, marketer2, trader, systemreserve)
2. WHEN admin is logged in, THE System SHALL allow withdrawal from admin, trader, and systemreserve buckets
3. WHEN dev is logged in, THE System SHALL allow withdrawal from dev, trader, and systemreserve buckets
4. THE System SHALL allow admin to view and withdraw from their own bucket, trader bucket, and systemreserve bucket
5. THE System SHALL allow dev to view and withdraw from their own bucket, trader bucket, and systemreserve bucket
6. WHEN withdrawal is requested, THE System SHALL validate amount and call withdraw_system_bucket method

### Requirement 9

**User Story:** As a dev, I want to monitor all system bucket balances, so that I can oversee the entire financial state of the system.

#### Acceptance Criteria

1. WHEN dev accesses the admin interface, THE System SHALL display balances for all buckets
2. THE System SHALL show real-time balances for admin, dev, marketer1, marketer2, trader, and systemreserve buckets
3. THE System SHALL display bucket balance history and recent transactions
4. THE System SHALL provide export functionality for financial reporting
5. THE System SHALL update bucket displays in real-time as transactions occur

### Requirement 10

**User Story:** As an admin or dev, I want to manage user credit balances through the admin interface, so that I can provide customer support and resolve account issues.

#### Acceptance Criteria

1. THE System SHALL provide a user credit management section in the admin interface
2. WHEN a user address is entered, THE System SHALL display current credit balance
3. THE System SHALL allow admin/dev to credit (add) or debit (subtract) user credit balances
4. WHEN credit operations are performed for non-existent users, THE System SHALL automatically create the user profile with dev as sponsor
5. WHEN credit operations are performed, THE System SHALL call the credit_user_balance contract method
6. THE System SHALL log all credit operations with timestamp, amount, operation type, and authorizing admin

### Requirement 11

**User Story:** As an admin or dev, I want to manually activate user licenses through the admin interface, so that I can provide customer service and promotional activations.

#### Acceptance Criteria

1. THE System SHALL provide a license activation section in the admin interface for admin and dev only
2. WHEN a user address is entered, THE System SHALL display current license status and expiration
3. THE System SHALL allow admin/dev to specify license duration in days
4. THE System SHALL provide an option to choose between extending existing license or setting new expiration
5. WHEN activation is requested for unregistered users, THE System SHALL prompt for sponsor address
6. WHEN manual activation is performed, THE System SHALL call the manual license activation contract method with chosen extension behavior

### Requirement 12

**User Story:** As marketer1 or marketer2, I want limited access to the admin interface to manage my earnings, so that I can view and withdraw my commissions without accessing other system functions.

#### Acceptance Criteria

1. WHEN marketer1 or marketer2 accesses /dapp/special, THE System SHALL provide a restricted interface
2. THE System SHALL display only the marketer's own bucket balance (marketer1 or marketer2 respectively)
3. THE System SHALL allow the marketer to withdraw from their own bucket only
4. THE System SHALL hide all other administrative functions from marketer view
5. THE System SHALL prevent marketers from accessing user management, configuration, or other bucket operations

### Requirement 13

**User Story:** As an admin or dev, I want to update user sponsor relationships through the admin interface, so that I can correct referral structures and resolve customer service issues.

#### Acceptance Criteria

1. THE System SHALL provide a user sponsor management section in the admin interface for admin and dev only
2. WHEN a user address is entered, THE System SHALL display current sponsor information
3. THE System SHALL allow admin/dev to update the user's sponsor to a new valid sponsor address
4. WHEN sponsor update is requested, THE System SHALL validate the new sponsor is a registered user
5. WHEN sponsor update is performed, THE System SHALL call the update_user_profile contract method
6. THE System SHALL log all sponsor updates with timestamp, old sponsor, new sponsor, and authorizing admin