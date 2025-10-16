# Implementation Plan

- [x] 1. Update UserProfile struct with affiliate earnings fields

  - Add total_affiliate_earnings, total_affiliate_withdrawn fields to UserProfile
  - Add level1_earnings, level2_earnings, level3_earnings for accounting
  - Update UserProfile size calculation for new fields
  - _Requirements: 1.3, 2.3_

- [x] 2. Create ReferralTracker struct for referral network tracking

  - Define ReferralTracker struct with owner and level-based referral vectors
  - Add total_referrals counter field
  - Implement add_referral function with duplicate prevention
  - Calculate appropriate account size for referral lists
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Remove AffiliateEarnings struct and related code

  - Remove AffiliateEarnings struct definition
  - Remove accrue_affiliate function
  - Clean up unused affiliate-related imports and references
  - _Requirements: 1.2_

- [x] 4. Update license activation to use simplified affiliate system

  - Modify ActivateLicenseUsdt context to include sponsor profiles and referral trackers
  - Update activate_license_usdt function to update sponsor profiles directly
  - Implement referral tracking during license activation
  - Implement sponsor validation with fallback to dev account
  - Remove affiliate PDA creation and management code
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 5.2_

- [x] 5. Implement affiliate earnings withdrawal function

  - Create WithdrawAffiliateEarnings account context
  - Implement withdraw_affiliate_earnings function with amount validation
  - Add proper authorization checks (profile owner only)
  - Update profile balances after successful withdrawal
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6. Add new error types for affiliate system

  - Add InsufficientFunds error for withdrawal validation
  - Add SponsorNotRegistered error for sponsor validation
  - Update error handling throughout affiliate-related functions
  - _Requirements: 4.1, 3.1_

- [x] 7. Update account contexts and remove affiliate PDAs

  - Remove affiliate PDA accounts from ActivateLicenseUsdt context
  - Remove WithdrawCommissions context (replaced by new withdrawal)
  - Update all account context space calculations
  - Clean up unused account context structs
  - _Requirements: 1.2, 4.1_

- [x] 8. Close existing program and deploy new version

  - Create script to close current program and reclaim rent
  - Update program ID in contract and configuration files
  - Build and deploy new contract version
  - Update IDL files for frontend integration
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Create migration and cleanup scripts

  - Script to close old affiliate PDA accounts and reclaim rent
  - Script to verify existing UserProfile compatibility
  - Documentation for deployment and migration process
  - _Requirements: 5.3, 5.4_

- [x] 10. Update frontend integration

  - Update IDL imports and program references
  - Modify license activation calls to use new structure
  - Implement new affiliate withdrawal functionality
  - Add referral network display and tracking UI
  - Update affiliate earnings display logic
  - _Requirements: 1.1, 4.1, 5.1_

- [x] 11. Write comprehensive tests
  - Unit tests for affiliate earnings accumulation in UserProfile
  - Unit tests for referral tracking and duplicate prevention
  - Integration tests for license activation with simplified affiliate system
  - Tests for withdrawal validation and authorization
  - Tests for sponsor fallback to dev account behavior
  - Tests for referral network tracking across multiple levels
  - _Requirements: 1.1, 2.1, 3.3, 4.1, 5.2, 5.3_
