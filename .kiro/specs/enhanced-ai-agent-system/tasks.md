# Enhanced AI Agent System Implementation Plan

## Overview

This implementation plan converts the Enhanced AI Agent System design into actionable coding tasks. The plan builds incrementally on the existing smart contract foundation, adding tier-based agent management, individual ROI tracking, yield caps, and withdrawal limits. Each task is designed to be implemented and tested independently while maintaining system integrity.

## Implementation Tasks

- [x] 1. Enhance smart contract data structures for agent tiers and tracking

  - Update UserAgentActivation struct to include tier, ROI tracking, and yield cap status
  - Add tier configuration constants and helper functions
  - Update UserProfile struct to track total deposits and withdrawals for global limits
  - _Requirements: 3.3, 4.2, 5.1, 7.1_

- [x] 2. Implement tier-based agent activation with validation

  - [x] 2.1 Create activate_agent_usdt_with_tier function

    - Add tier parameter validation (0-3 for NOVA, VEGA, ORION, PRIME)
    - Store tier information in UserAgentActivation PDA
    - Update user's total_agent_deposits for withdrawal limit tracking
    - Emit enhanced AgentActivatedEvent with tier information
    - _Requirements: 3.2, 3.3, 7.2_

  - [x] 2.2 Create activate_agent_credit_with_tier function

    - Mirror USDT activation logic for credit-based activations
    - Ensure tier selection works with both payment methods
    - Maintain existing credit balance validation
    - _Requirements: 3.2, 3.3_

  - [x] 2.3 Update existing activation functions for backward compatibility
    - Modify existing activate_agent_usdt to default to NOVA tier
    - Ensure existing UI components continue to work
    - _Requirements: 3.3_

- [x] 3. Implement random ROI generation within tier ranges

  - [x] 3.1 Create calculate_random_roi helper function

    - Use timestamp + user pubkey + activation_id as randomness seed
    - Implement tier-specific yield ranges (NOVA: 1.00%-1.75%, VEGA: 1.75%-2.15%, ORION: 2.15%-3.00%, PRIME: 3.00%-5.00%)
    - Return ROI amount based on agent's principal and random percentage
    - Add comprehensive testing for randomness distribution
    - _Requirements: 4.1, 4.4_

  - [x] 3.2 Create tier configuration constants
    - Define TIER_CONFIGS array with min/max yield basis points and yield caps
    - Add helper functions to get tier configuration by index
    - Validate tier configurations sum to expected ranges
    - _Requirements: 4.1, 4.2_

- [ ] 4. Implement individual agent ROI withdrawal system

  - [x] 4.1 Create withdraw_agent_roi instruction

    - Validate 24-hour delay since agent activation
    - Validate 24-hour delay since last withdrawal for specific agent
    - Check agent hasn't reached yield cap (not retired)
    - Generate random ROI within tier range using calculate_random_roi
    - _Requirements: 2.2, 2.3, 4.4, 8.2_

  - [x] 4.2 Implement yield cap enforcement

    - Calculate maximum total yield based on tier (175%-250% of activation amount)
    - Check if withdrawal would exceed agent's yield cap
    - Mark agent as retired when yield cap reached
    - Adjust final withdrawal to exact yield cap amount
    - _Requirements: 4.2, 4.3_

  - [x] 4.3 Implement global withdrawal limit validation

    - Calculate 200x limit based on user's total_agent_deposits
    - Check user's total_roi_withdrawn against global limit
    - Exempt privileged users (admin, dev, marketer1, marketer2, trader)
    - Prevent withdrawal if global limit would be exceeded
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 4.4 Add USDT transfer and state updates

    - Transfer ROI amount from system reserve to user
    - Update agent's total_roi_withdrawn and last_roi_withdraw_at
    - Update user's total_roi_withdrawn for global tracking
    - Emit AgentRoiWithdrawalEvent with comprehensive details
    - _Requirements: 2.4, 5.2_

  - [x] 4.5 Create WithdrawAgentRoi account context
    - Define account structure for withdraw_agent_roi instruction
    - Include user, activation PDA, profile, config, vault, and token accounts
    - Add proper constraints and validations
    - _Requirements: 2.2, 4.4_

- [x] 5. Create agent querying and dashboard backend services

  - [x] 5.1 Implement getUserAgents service function

    - Query all UserAgentActivation PDAs for specific user
    - Use memcmp filter on user field for efficient querying
    - Parse and format agent data for frontend consumption
    - Handle pagination for users with many agents
    - _Requirements: 1.2, 7.3_

  - [x] 5.2 Implement getWithdrawalLimitStatus service function

    - Calculate user's total deposits and withdrawals
    - Determine remaining withdrawable amount (200x - withdrawn)
    - Check if user is privileged (exempt from limits)
    - Return comprehensive withdrawal limit status
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 5.3 Create agent ROI withdrawal service function

    - Build and send withdraw_agent_roi transaction
    - Handle transaction confirmation and error states
    - Update local state after successful withdrawal
    - Provide user feedback for withdrawal status
    - _Requirements: 2.2, 2.4_

  - [x] 5.4 Update solairus-main.ts library with agent functions
    - Add deriveAgentActivationPda function (already exists)
    - Add UserAgentActivation interface
    - Add agent tier types and constants
    - Add helper functions for agent operations
    - _Requirements: 1.2, 3.1, 7.3_

- [ ] 6. Build agent dashboard UI components

  - [x] 6.1 Create AgentDashboard main component

    - Display user's agent portfolio in grid/list format
    - Show agent tier, activation amount, and current status
    - Integrate withdrawal limit status display
    - Handle empty state when user has no agents
    - Create NEW component separate from existing AgentsOutcomesCard (keep simulation intact)
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 6.2 Create AgentCard component for individual agents

    - Display agent tier with emoji and styling (🪶 NOVA, 🔮 VEGA, ⚡ ORION, 🧠 PRIME)
    - Show activation date, investment amount, and ROI status
    - Display yield cap progress and retirement status
    - Include individual ROI withdrawal button with availability status
    - Create completely NEW styling and design
    - _Requirements: 1.3, 4.5, 6.5_

  - [x] 6.3 Create WithdrawalLimitDisplay component

    - Show total deposits, withdrawals, and remaining limit
    - Display progress bar for withdrawal limit usage
    - Show warning messages when approaching limits
    - Handle privileged user status (show "Unlimited")
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 6.4 Create TierSelection component for agent activation
    - Display four tier options with characteristics
    - Show daily yield ranges and yield caps for each tier
    - Include tier descriptions and target user types
    - Integrate with existing agent activation flow
    - Create completely NEW tier metadata and styling
    - _Requirements: 3.1, 3.4, 3.5_

- [x] 7. Implement withdrawal timing and validation UI

  - [x] 7.1 Create WithdrawalTimer component

    - Display countdown for 24-hour activation delay
    - Show time remaining until next withdrawal available
    - Handle multiple agents with different timing states
    - Provide clear messaging for withdrawal availability
    - _Requirements: 8.4, 8.5_

  - [x] 7.2 Add withdrawal validation feedback
    - Show specific error messages for timing violations
    - Display yield cap reached notifications
    - Handle global withdrawal limit error states
    - Provide actionable guidance for users
    - _Requirements: 2.5, 4.5, 5.4_

- [x] 8. Update existing agent activation UI for tier selection

  - [x] 8.1 Enhance agent activation modal/page

    - Add tier selection step before amount input
    - Show selected tier characteristics and limits
    - Update activation flow to include tier parameter
    - Maintain backward compatibility with existing flows
    - Find and update existing agent activation components
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 8.2 Update agent activation confirmation
    - Display selected tier in confirmation dialog
    - Show expected yield range and cap for selected tier
    - Include tier-specific activation success messaging
    - _Requirements: 3.4, 3.5_

- [x] 9. Add comprehensive error handling and user feedback

  - [x] 9.1 Implement smart contract error codes

    - Add InvalidTier, AgentRetired, WithdrawalTooEarly error codes
    - Add GlobalWithdrawalLimitReached and InsufficientSystemReserve errors
    - Ensure error messages are clear and actionable
    - _Requirements: 2.5, 4.5, 5.4, 8.3_

  - [x] 9.2 Create user-friendly error handling in UI
    - Map contract errors to user-friendly messages
    - Provide specific guidance for each error type
    - Include retry mechanisms where appropriate
    - Show helpful context for timing-related errors
    - Update existing error handling utilities
    - _Requirements: 2.5, 4.5, 5.4, 8.3_

- [x] 10. Implement comprehensive testing suite

  - [x] 10.1 Create smart contract unit tests

    - Test tier validation and configuration
    - Test random ROI generation within expected ranges
    - Test yield cap calculations and enforcement
    - Test global withdrawal limit validation
    - Test 24-hour delay enforcement
    - _Requirements: All requirements validation_

  - [x] 10.2 Create integration tests for agent lifecycle

    - Test complete agent activation with tier selection (partially done)
    - Test daily ROI withdrawals over multiple days
    - Test agent retirement when yield cap reached
    - Test global limit enforcement and recovery
    - Test privileged user exemptions
    - _Requirements: All requirements end-to-end validation_

  - [x] 10.3 Create frontend component tests
    - Test agent dashboard displays correct information
    - Test tier selection component functionality
    - Test withdrawal limit display accuracy
    - Test error handling and user feedback
    - _Requirements: UI component validation_

- [x] 11. Update deployment and configuration scripts

  - [x] 11.1 Update smart contract deployment

    - Ensure new instruction handlers are included
    - Validate tier configurations are correct
    - Test contract upgrade compatibility
    - _Requirements: System deployment_

  - [x] 11.2 Update frontend configuration
    - Add tier metadata and styling configurations (partially done in AgentsOutcomesCard)
    - Update service endpoints for new functionality
    - Ensure proper error handling configuration
    - _Requirements: Frontend deployment_

## Current Implementation Status

### ✅ Completed (Smart Contract):

- **Tasks 1-3**: All smart contract foundations are complete
  - Enhanced data structures with tier support
  - Tier-based agent activation (both USDT and credit)
  - Random ROI generation with tier-specific ranges
  - Comprehensive tier validation and configuration
  - Backward compatibility maintained

### ✅ Partially Completed:

- **Task 9.1**: Error codes implemented in smart contract
- **Task 10.1**: Basic tier activation tests implemented
- **Task 11.1**: Smart contract deployment ready

### 🚧 In Progress / Remaining:

- **Task 4**: Individual agent ROI withdrawal system (smart contract instruction needed)
- **Tasks 5-6**: Backend services and UI components for agent dashboard
- **Tasks 7-8**: Agent activation UI updates and withdrawal timing
- **Tasks 9.2, 10.2-10.3**: Frontend error handling and comprehensive testing
- **Task 11.2**: Frontend configuration updates

## Task Dependencies

### Critical Path:

1. **✅ Data Structures** (Task 1) → **✅ Tier Activation** (Task 2) → **✅ ROI Generation** (Task 3) → **🚧 ROI Withdrawal** (Task 4)
2. **🚧 Backend Services** (Task 5) → **🚧 UI Components** (Task 6) → **🚧 Integration** (Tasks 7-8)
3. **🚧 Error Handling** (Task 9.2) runs parallel to UI implementation
4. **🚧 Testing** (Task 10.2-10.3) validates each completed task
5. **🚧 Frontend Config** (Task 11.2) finalizes the implementation

### Next Priority Tasks:

1. **Task 4.1-4.5**: Complete individual agent ROI withdrawal system
2. **Task 5.1-5.4**: Implement backend services for agent querying
3. **Task 6.1-6.4**: Build agent dashboard UI components

## Success Criteria

### Smart Contract:

- ✅ All four agent tiers properly configured and validated
- ✅ Random ROI generation produces expected distribution within tier ranges
- ✅ Individual agent yield caps enforced correctly
- ✅ Global withdrawal limits prevent system abuse
- ✅ 24-hour delays properly enforced for activations and withdrawals

### Frontend:

- ✅ Agent dashboard displays complete portfolio with accurate status
- ✅ Tier selection provides clear information and smooth activation flow
- ✅ Withdrawal limits clearly communicated with real-time updates
- ✅ Error handling provides actionable guidance to users
- ✅ Timing constraints clearly displayed with countdown timers

### System Integration:

- ✅ All existing functionality remains intact and compatible
- ✅ New features integrate seamlessly with current user flows
- ✅ Performance remains acceptable with multiple agents per user
- ✅ Security controls prevent abuse while maintaining usability
