# Enhanced AI Agent System Requirements

## Introduction

The Solairus platform currently has basic agent activation functionality but lacks comprehensive agent management features. Users need the ability to view all their activated agents, withdraw ROI from individual agents with proper timing controls, select agent tiers with different characteristics, and have withdrawal limits to ensure system sustainability. This feature will enhance the existing agent system to provide a complete AI trading agent experience with proper security controls and tier-based yield management.

## Glossary

- **Solairus_Main_Program**: The main smart contract program managing agent activations and ROI withdrawals
- **Agent_Activation**: The process of hiring/purchasing an AI trading agent using USDT or credits
- **Agent_Tier**: Classification levels for agents (NOVA, VEGA, ORION, PRIME) with different yield characteristics
- **ROI_Withdrawal**: Daily withdrawal of returns from activated agents
- **Agent_Dashboard**: UI interface showing all user's activated agents and their status
- **Withdrawal_Limit**: Maximum total amount a user can withdraw (200x their total deposits)
- **Principal_Amount**: The total USDT amount a user has invested in agent activations
- **Agent_Mapping**: System to track and query all agents activated by a specific user
- **Yield_Cap**: Maximum total ROI percentage each individual agent can generate (175%-250% based on tier)
- **Daily_Yield_Range**: Random daily ROI percentage range specific to each agent tier

## Requirements

### Requirement 1

**User Story:** As a user, I want to view all my activated AI agents in a dashboard, so that I can track my investments and manage my agent portfolio.

#### Acceptance Criteria

1. WHEN a user activates an agent, THE Solairus_Main_Program SHALL create a unique agent record with activation ID
2. WHEN a user accesses the agent dashboard, THE System SHALL display all agents activated by that user
3. WHEN displaying agent information, THE System SHALL show agent tier, activation date, investment amount, and ROI status
4. WHEN a user has no activated agents, THE System SHALL display an empty state with activation call-to-action
5. THE System SHALL support pagination for users with many activated agents

### Requirement 2

**User Story:** As a user, I want to withdraw daily ROI from each of my agents individually, so that I can manage returns from specific agent investments.

#### Acceptance Criteria

1. WHEN an agent is activated, THE System SHALL enforce a 24-hour waiting period before first ROI withdrawal
2. WHEN a user requests ROI withdrawal, THE System SHALL allow withdrawal only after 24 hours from last withdrawal per agent
3. WHEN calculating ROI, THE System SHALL generate random daily yields within tier-specific ranges
4. WHEN a user withdraws ROI, THE System SHALL update the agent's last withdrawal timestamp
5. ONLY the user who activated an agent SHALL be able to withdraw ROI from that specific agent

### Requirement 3

**User Story:** As a user, I want to select different agent tiers during activation, so that I can choose agents with different characteristics and earning potential.

#### Acceptance Criteria

1. THE System SHALL support four agent tiers: NOVA, VEGA, ORION, and PRIME
2. WHEN a user activates an agent, THE System SHALL require tier selection
3. WHEN storing agent activation, THE Solairus_Main_Program SHALL record the selected tier (0=NOVA, 1=VEGA, 2=ORION, 3=PRIME)
4. WHEN displaying agents, THE System SHALL show the agent's tier with appropriate visual styling
5. THE System SHALL maintain tier-specific metadata (persona, tagline, accent color)

### Requirement 4

**User Story:** As a user, I want my agents to have tier-specific yield caps and daily yield ranges, so that different tiers provide distinct earning characteristics and lifecycle management.

#### Acceptance Criteria

1. WHEN calculating daily ROI, THE System SHALL use tier-specific yield ranges: NOVA (1.00%-1.75%), VEGA (1.75%-2.15%), ORION (2.15%-3.00%), PRIME (3.00%-5.00%)
2. WHEN an agent is activated, THE System SHALL assign tier-specific yield caps: NOVA (175%), VEGA (200%), ORION (220%), PRIME (250%)
3. WHEN an agent reaches its yield cap, THE System SHALL stop generating ROI for that agent
4. WHEN generating daily yields, THE System SHALL use cryptographically secure pseudo-random calculation within each tier's range
5. THE System SHALL track individual agent yield cap progress and display retirement status when reached

### Requirement 5

**User Story:** As a user, I want my total withdrawals to be limited to 200x my total deposits, so that the system remains sustainable while allowing substantial returns.

#### Acceptance Criteria

1. THE Solairus_Main_Program SHALL track total USDT deposits for each user across all agent activations
2. THE Solairus_Main_Program SHALL track total ROI withdrawals for each user
3. WHEN a user attempts ROI withdrawal, THE System SHALL verify total withdrawals do not exceed 200x total deposits
4. WHEN withdrawal limit is reached, THE System SHALL prevent further ROI withdrawals with clear error message
5. THE System SHALL exempt admin, dev, marketer1, marketer2, and trader roles from withdrawal limits

### Requirement 6

**User Story:** As a user, I want to see my withdrawal limit status, so that I can understand how much I can still withdraw from my investments.

#### Acceptance Criteria

1. WHEN a user views their dashboard, THE System SHALL display current withdrawal limit status
2. THE System SHALL show total deposits, total withdrawals, and remaining withdrawable amount
3. WHEN a user approaches their withdrawal limit, THE System SHALL display warning messages
4. THE System SHALL calculate and display the withdrawal limit as 200x total deposits
5. THE System SHALL update withdrawal limit status in real-time after each withdrawal

### Requirement 7

**User Story:** As a system administrator, I want agent activations to be properly mapped and queryable, so that the system can efficiently retrieve user agent data.

#### Acceptance Criteria

1. THE Solairus_Main_Program SHALL create unique PDAs for each agent activation using user address and activation ID
2. THE System SHALL emit AgentActivatedEvent with all relevant agent information for blockchain indexing
3. THE System SHALL support querying agents by user address using memcmp filters
4. THE System SHALL maintain agent counter per user for unique activation IDs
5. THE System SHALL ensure agent activation records are immutable once created

### Requirement 8

**User Story:** As a user, I want my agent ROI withdrawals to start only after 24 hours from activation, so that the system has time to generate initial returns.

#### Acceptance Criteria

1. WHEN an agent is activated, THE System SHALL record the activation timestamp
2. WHEN a user attempts first ROI withdrawal, THE System SHALL verify 24 hours have passed since activation
3. WHEN the 24-hour period has not elapsed, THE System SHALL prevent withdrawal with clear error message
4. WHEN the 24-hour period has elapsed, THE System SHALL allow normal daily ROI withdrawals
5. THE System SHALL display countdown timer showing time remaining until first withdrawal is available