# Requirements Document

## Introduction

This feature addresses the critical program initialization error where users encounter `TypeError: Cannot read properties of undefined (reading 'size')` at `getProgram (solairus-core.ts:34:10)`. The error occurs during Anchor program initialization due to improper IDL processing in the `fixTypes` function, preventing the program from being created and causing subsequent "Program not available" errors. This fix ensures reliable program initialization and USDT deposit functionality for users interacting with the Solairus Core smart contract.

## Requirements

### Requirement 1

**User Story:** As a user, I want the Solairus program to initialize successfully, so that I can access deposit and other functionality without encountering program initialization errors.

#### Acceptance Criteria

1. WHEN the getProgram function is called THEN it SHALL successfully create an Anchor program instance without "Cannot read properties of undefined" errors
2. WHEN the IDL is processed by fixTypes THEN it SHALL preserve all required properties and structure for Anchor v0.32.1 compatibility
3. WHEN the program is initialized THEN it SHALL have a valid address field and properly formatted type definitions
4. IF the IDL processing fails THEN the system SHALL provide clear error messages indicating the specific IDL structure issue

### Requirement 2

**User Story:** As a developer, I want the deposit functionality to have proper error handling, so that users receive clear feedback when deposits fail.

#### Acceptance Criteria

1. WHEN a deposit transaction fails THEN the error message SHALL clearly indicate the specific failure reason
2. WHEN the program method doesn't exist THEN the system SHALL log available methods for debugging
3. WHEN account validation fails THEN the error SHALL specify which account is invalid
4. IF the transaction is rejected THEN the user SHALL receive actionable error information

### Requirement 3

**User Story:** As a developer, I want the deposit implementation to be robust and handle edge cases, so that the system works reliably across different scenarios.

#### Acceptance Criteria

1. WHEN ATAs don't exist THEN the system SHALL create them automatically before attempting the deposit
2. WHEN the vault ATA is missing THEN it SHALL be created with the correct PDA as owner
3. WHEN the user ATA is missing THEN it SHALL be created with the user as owner
4. IF ATA creation fails THEN the system SHALL provide clear error messaging

### Requirement 4

**User Story:** As a developer, I want the IDL processing to follow Anchor v0.32.1 compatibility rules, so that the program initializes correctly and all methods are available.

#### Acceptance Criteria

1. WHEN the IDL is processed THEN it SHALL have a root-level address field copied from metadata.address
2. WHEN type definitions are processed THEN all "publicKey" types SHALL be converted to "pubkey" for Anchor compatibility
3. WHEN defined types are processed THEN string format SHALL be converted to object format (e.g., "Role" → {"name": "Role"})
4. IF account types are inline THEN they SHALL be moved to the types array with proper discriminators

### Requirement 5

**User Story:** As a developer, I want comprehensive error handling for IDL processing failures, so that I can quickly diagnose and fix program initialization issues.

#### Acceptance Criteria

1. WHEN IDL processing fails THEN the error message SHALL clearly indicate which IDL structure rule was violated
2. WHEN the program constructor fails THEN it SHALL log the processed IDL structure for debugging
3. WHEN type conversion fails THEN it SHALL specify which type definition caused the failure
4. IF the address field is missing THEN the system SHALL provide a clear error message with the fix

### Requirement 6

**User Story:** As a user, I want to successfully deposit USDT after program initialization is fixed, so that I can participate in the Solairus platform without encountering transaction errors.

#### Acceptance Criteria

1. WHEN the program is successfully initialized THEN deposit methods SHALL be available and callable
2. WHEN a deposit transaction is built THEN all required accounts SHALL be properly included and validated
3. WHEN the deposit transaction is submitted THEN it SHALL complete successfully or provide clear error messages
4. IF the deposit method doesn't exist in the IDL THEN the system SHALL log available methods for debugging