# Requirements Document

## Introduction

Fix the affiliate earnings distribution in the license activation process to use a simple loop-based approach that can handle the same sponsor appearing at multiple levels, allowing cumulative earnings for sponsors who appear at multiple levels in the referral chain.

## Glossary

- **Solairus_Main**: The main smart contract handling license activations and affiliate earnings
- **User_Profile**: Account storing user registration data including sponsor relationships
- **Sponsor_Level**: The hierarchical position in the referral chain (L1, L2, L3)
- **Affiliate_Earnings**: USDT amounts distributed to sponsors during license activation
- **PDA**: Program Derived Account used to store user profile data

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the affiliate earnings distribution to handle duplicate sponsors across levels, so that sponsors can receive cumulative earnings from multiple referral levels.

#### Acceptance Criteria

1. WHEN a license activation occurs, THE Solairus_Main SHALL iterate through all three sponsor levels using a loop
2. WHEN the same sponsor appears at multiple levels, THE Solairus_Main SHALL update their earnings multiple times cumulatively
3. WHEN a sponsor level contains a valid address, THE Solairus_Main SHALL add the corresponding level earnings to that sponsor's profile
4. WHEN a sponsor level is empty (default pubkey), THE Solairus_Main SHALL skip that level without error
5. THE Solairus_Main SHALL use a single sponsor profile account parameter that gets reused for all levels

### Requirement 2

**User Story:** As a developer, I want the contract to use a simplified account structure, so that we don't need separate sponsor profile accounts for each level.

#### Acceptance Criteria

1. THE Solairus_Main SHALL accept only one sponsor_profile account parameter in the ActivateLicenseUsdt context
2. THE Solairus_Main SHALL reuse this single account for updating earnings at all sponsor levels
3. WHEN the same PDA is updated multiple times, THE Solairus_Main SHALL accumulate the earnings correctly
4. THE Solairus_Main SHALL validate that the sponsor_profile account matches each sponsor address before updating
5. THE Solairus_Main SHALL handle the case where different sponsors at different levels require different PDA accounts

### Requirement 3

**User Story:** As a user activating a license, I want the transaction to succeed even when my sponsor chain has duplicate sponsors, so that I can complete my license activation without errors.

#### Acceptance Criteria

1. WHEN a user has the same sponsor at multiple levels, THE Solairus_Main SHALL process the activation successfully
2. WHEN sponsor addresses are duplicated across levels, THE Solairus_Main SHALL not throw access violation errors
3. THE Solairus_Main SHALL complete all earnings distributions within a single transaction
4. WHEN all sponsor levels point to the same address, THE Solairus_Main SHALL update that sponsor's earnings three times
5. THE Solairus_Main SHALL maintain transaction atomicity for all earnings updates