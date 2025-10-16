# Simplified Affiliate System Requirements

## Introduction

This feature simplifies the affiliate earnings system by removing the complex PDA-based AffiliateEarnings accounts and tracking earnings directly in user profiles. This eliminates unnecessary complexity, reduces costs, and makes the system more straightforward.

## Glossary

- **Affiliate System**: The referral commission system that rewards sponsors for bringing new users
- **UserProfile**: The main account that stores user data including affiliate earnings
- **Sponsor**: A registered user who refers new users to the platform
- **Dev Account**: The default fallback account that receives affiliate commissions when sponsors are unregistered

## Requirements

### Requirement 1

**User Story:** As a platform user, I want affiliate earnings to be tracked simply in my profile, so that I don't need complex PDA accounts.

#### Acceptance Criteria

1. WHEN a user activates a license, THE system SHALL track affiliate earnings directly in sponsor UserProfile accounts
2. THE system SHALL eliminate AffiliateEarnings PDA accounts completely
3. THE UserProfile SHALL include fields for total affiliate earnings and withdrawn amounts
4. THE system SHALL support tracking earnings from different referral levels (L1, L2, L3)

### Requirement 2

**User Story:** As a sponsor, I want my earnings to accumulate in my profile regardless of how many people I refer, so that all my commissions are in one place.

#### Acceptance Criteria

1. WHEN multiple users activate licenses with me as sponsor, THE system SHALL accumulate all earnings in my single UserProfile
2. THE system SHALL track total earnings across all referral levels
3. THE system SHALL maintain separate counters for L1, L2, and L3 earnings for accounting purposes
4. THE system SHALL update earnings atomically during license activation

### Requirement 3

**User Story:** As a user, I want unregistered sponsors to default to the dev account, so that affiliate commissions are not lost.

#### Acceptance Criteria

1. WHEN a sponsor is not registered (no UserProfile exists), THE system SHALL default affiliate earnings to the dev account
2. THE system SHALL validate sponsor registration during license activation
3. IF a sponsor UserProfile does not exist, THEN THE system SHALL use the dev account as the sponsor
4. THE system SHALL log when sponsor defaults to dev for transparency

### Requirement 4

**User Story:** As a sponsor, I want to withdraw my affiliate earnings by specifying an amount, so that I can access my commissions.

#### Acceptance Criteria

1. WHEN I request a withdrawal, THE system SHALL verify the requested amount is less than or equal to my available earnings
2. THE system SHALL transfer USDT from the vault to my wallet
3. THE system SHALL update my profile to reflect the withdrawn amount
4. THE system SHALL prevent withdrawal of more than available earnings
5. THE system SHALL require proper authorization (only the profile owner can withdraw)

### Requirement 5

**User Story:** As a sponsor, I want to see a list of all my referrals organized by level, so that I can track my network growth.

#### Acceptance Criteria

1. THE system SHALL maintain a ReferralTracker account for each sponsor
2. WHEN a user activates a license, THE system SHALL add the user to appropriate referral lists for L1, L2, and L3 sponsors
3. THE system SHALL prevent duplicate entries in referral lists
4. THE system SHALL track total referral counts across all levels
5. THE system SHALL organize referrals by level (L1 = direct, L2 = indirect, L3 = third level)

### Requirement 6

**User Story:** As a developer, I want to deploy a new contract version, so that I can implement the simplified affiliate system.

#### Acceptance Criteria

1. THE system SHALL close the existing program to reclaim rent
2. THE system SHALL deploy a new contract with the simplified affiliate structure
3. THE system SHALL maintain compatibility with existing user profiles where possible
4. THE system SHALL provide migration scripts for any necessary data updates