# Implementation Plan

- [x] 1. Update solairus_main smart contract for license expiration tracking

  - Modify UserProfile struct to include license_expires_at field
  - Update Config struct to include license_duration_days field
  - Modify activate_license_usdt instruction to set license expiration timestamp
  - Add license validation helper methods to UserProfile
  - _Requirements: 2.1, 3.3, 5.1_

- [ ] 2. Create license service layer for smart contract integration

  - [x] 2.1 Create LicenseService class with solairus_main contract integration

    - Implement checkUserProfile method to fetch UserProfile data
    - Implement getConfig method to fetch license configuration
    - Implement isLicenseActive method for expiration validation
    - Implement getLicenseExpiryDate method for date calculations
    - _Requirements: 2.1, 3.3, 5.3_

  - [x] 2.2 Add license activation transaction handling
    - Implement activateLicense method with USDT payment flow
    - Add proper error handling for transaction failures
    - Include transaction confirmation and retry logic
    - _Requirements: 2.1, 2.2, 2.4_

- [ ] 3. Create reusable license UI components

  - [x] 3.1 Create LicenseStatusCard component

    - Design card layout following existing UI patterns
    - Implement different states (active, expired, near-expiry, none)
    - Add license expiration countdown display
    - Include activation button for inactive licenses
    - _Requirements: 4.2, 4.3, 5.1, 5.2_

  - [x] 3.2 Create CountdownTimer component

    - Implement real-time countdown with days, hours, minutes
    - Add automatic updates and cleanup on unmount
    - Include expiry callback handling
    - Style according to existing design patterns
    - _Requirements: 5.2, 4.4_

  - [ ] 3.3 Write unit tests for license components
    - Test LicenseStatusCard rendering in different states
    - Test CountdownTimer calculations and updates
    - Mock smart contract interactions for testing
    - _Requirements: 5.4, 5.5_

- [ ] 4. Implement LicenseGuard higher-order component

  - [x] 4.1 Create LicenseGuard wrapper component

    - Implement license status checking logic
    - Add automatic redirection to license activation page
    - Include loading states during license validation
    - Handle wallet connection requirements
    - _Requirements: 1.1, 3.1, 3.2, 5.3_

  - [x] 4.2 Add license expiry notifications

    - Implement near-expiry warning (7 days before)
    - Add renewal reminder UI components
    - Include dismissible notification system
    - _Requirements: 3.4, 5.1_

  - [ ] 4.3 Write integration tests for LicenseGuard
    - Test license validation scenarios
    - Test redirection logic for different states
    - Test wallet connection integration
    - _Requirements: 1.1, 3.1, 3.2_

- [ ] 5. Create license activation page

  - [x] 5.1 Build LicenseActivationPage component structure

    - Create page layout with TopBar and BottomNav integration
    - Add welcome message and Solairus branding
    - Implement responsive design within 390px container
    - Follow existing dApp page patterns
    - _Requirements: 1.2, 4.1, 4.4_

  - [x] 5.2 Implement license fee display and payment flow

    - Fetch and display current license fee from smart contract
    - Add prominent activation button with clear pricing
    - Implement USDT balance checking and validation
    - Include payment confirmation dialog
    - _Requirements: 1.3, 1.4, 2.1, 2.3_

  - [x] 5.3 Add success and error state handling

    - Create success state with congratulations message
    - Implement license countdown display after activation
    - Add comprehensive error handling with user-friendly messages
    - Include retry mechanisms for failed transactions
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.4 Write end-to-end tests for activation flow
    - Test complete license activation process
    - Test error scenarios and recovery
    - Test success state and redirection
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [ ] 6. Integrate license guard with existing dApp routes

  - [x] 6.1 Update dApp routing to include license protection

    - Wrap existing dApp routes with LicenseGuard
    - Add license activation route to router configuration
    - Ensure proper route protection for all /dapp paths
    - _Requirements: 1.1, 3.1_

  - [x] 6.2 Update wallet context for license integration

    - Add license status to wallet context state
    - Implement license status caching and refresh logic
    - Include license validation in wallet connection flow
    - _Requirements: 3.3, 5.3, 5.5_

  - [x] 6.3 Add license status to existing UI components
    - Update user profile displays with license information
    - Add license status indicators to relevant components
    - Include license renewal prompts in appropriate locations
    - _Requirements: 3.4, 5.1_

- [ ] 7. Implement error handling and user experience improvements

  - [x] 7.1 Add comprehensive error handling

    - Implement specific error messages for different failure types
    - Add network error recovery with exponential backoff
    - Include wallet rejection handling
    - Create fallback UI for offline scenarios
    - _Requirements: 2.4, 5.4_

  - [x] 7.2 Optimize performance and caching

    - Implement license status caching in localStorage
    - Add background refresh for license data
    - Optimize smart contract calls with request deduplication
    - Include loading states for all async operations
    - _Requirements: 5.3, 5.5_

  - [ ] 7.3 Add accessibility and responsive design
    - Ensure keyboard navigation support
    - Add ARIA labels for screen readers
    - Test responsive behavior across different screen sizes
    - Validate color contrast and accessibility standards
    - _Requirements: 4.4_

- [ ] 8. Final integration and testing

  - [x] 8.1 Deploy smart contract updates

    - Deploy updated solairus_main contract with license expiration fields
    - Run migration for existing UserProfile accounts
    - Verify contract functionality on devnet/testnet
    - _Requirements: 2.1, 3.3_

  - [x] 8.2 Update solairus-main.ts library integration

    - Update TypeScript interfaces to match new contract structure
    - Add new methods for license validation
    - Update existing methods to handle new fields
    - _Requirements: 2.1, 3.3, 5.1_

  - [ ] 8.3 Perform comprehensive testing
    - Test complete user flow from wallet connection to license activation
    - Verify license expiration and renewal scenarios
    - Test error handling and edge cases
    - Validate performance and user experience
    - _Requirements: 1.1, 2.1, 3.1, 5.1_
