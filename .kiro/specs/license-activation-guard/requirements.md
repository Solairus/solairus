# Requirements Document

## Introduction

This feature implements a license activation guard system for the Solairus dApp that ensures users have an active yearly license before accessing the main application features. The system integrates with the solairus_main smart contract using the `activate_license_usdt` instruction to handle USDT payments and license validation, providing a seamless user experience within the established dApp UI framework.

## Requirements

### Requirement 1

**User Story:** As a user without an active license, I want to be redirected to a license activation page so that I can purchase access to the Solairus platform.

#### Acceptance Criteria

1. WHEN a user accesses any /dapp route AND they don't have an active license THEN the system SHALL redirect them to /dapp/license-activation
2. WHEN a user is on the license activation page THEN the system SHALL display a welcoming message about Solairus AI Trading Agents Portal
3. WHEN a user views the license activation page THEN the system SHALL show the current USDT price for yearly license activation
4. WHEN a user views the license activation page THEN the system SHALL provide a clear call-to-action button to activate their license

### Requirement 2

**User Story:** As a user, I want to activate my yearly license by paying USDT so that I can access the full Solairus platform features.

#### Acceptance Criteria

1. WHEN a user clicks the license activation button THEN the system SHALL call the activate_license_usdt instruction from solairus_main contract to pay the required USDT amount
2. WHEN the license activation transaction is successful THEN the system SHALL display a congratulations message
3. WHEN the license activation is complete THEN the system SHALL show the license expiration countdown
4. WHEN a license activation transaction fails THEN the system SHALL display an appropriate error message with retry option
5. WHEN a user completes license activation THEN the system SHALL automatically redirect them to the main dApp after a brief success display

### Requirement 3

**User Story:** As a user with an active license, I want to access the dApp normally without being blocked by the license activation page.

#### Acceptance Criteria

1. WHEN a user has an active license AND accesses any /dapp route THEN the system SHALL allow normal navigation
2. WHEN a user's license is expired THEN the system SHALL redirect them to the license activation page
3. WHEN checking license status THEN the system SHALL validate against the solairus_main contract UserProfile data
4. WHEN a user's license is near expiration (within 7 days) THEN the system SHALL display a renewal reminder

### Requirement 4

**User Story:** As a user, I want the license activation page to follow the same design patterns as other dApp pages so that the experience feels consistent.

#### Acceptance Criteria

1. WHEN a user views the license activation page THEN the system SHALL use the same TopBar and BottomNav components as other dApp pages
2. WHEN displaying license information THEN the system SHALL use the established card-based UI components
3. WHEN showing the activation button THEN the system SHALL follow the existing button design patterns
4. WHEN displaying status messages THEN the system SHALL use consistent typography and spacing
5. WHEN the page loads THEN the system SHALL fit within the 390px mobile container layout

### Requirement 5

**User Story:** As a user, I want to see real-time license status information so that I understand my current access level and expiration details.

#### Acceptance Criteria

1. WHEN a user has an active license THEN the system SHALL display the exact expiration date and time
2. WHEN displaying license countdown THEN the system SHALL show days, hours, minutes remaining in a visually appealing format
3. WHEN license data is loading THEN the system SHALL show appropriate loading states
4. WHEN license data fails to load THEN the system SHALL show error state with retry option
5. WHEN license status changes THEN the system SHALL update the UI reactively without requiring page refresh