# Implementation Plan

- [x] 1. Replace conditional sponsor earnings logic with loop-based approach

  - Keep existing ActivateLicenseUsdt context structure unchanged
  - Replace the current if-statement logic with a loop that iterates through sponsor accounts
  - Maintain existing account validation and constraints
  - _Requirements: 1.1, 2.1_

- [x] 2. Implement loop-based earnings distribution logic

  - [x] 2.1 Create sponsor data array with addresses, amounts, and levels

    - Extract sponsor addresses from user profile
    - Pair each address with corresponding affiliate amount and level number
    - _Requirements: 1.1, 1.3_

  - [x] 2.2 Implement earnings update loop without PDA validation

    - Iterate through sponsor accounts and amounts
    - Update affiliate_earnings_usdt directly on each account
    - Let Anchor handle account validation automatically
    - _Requirements: 1.1, 1.2, 3.4_

  - [x] 2.3 Add cumulative earnings calculation
    - Update affiliate_earnings_usdt field with checked addition
    - Handle math overflow scenarios
    - Skip empty sponsor levels (default pubkey)
    - _Requirements: 1.2, 1.4, 3.4_

- [-] 3. Verify frontend compatibility with loop-based approach

  - [x] 3.1 Test existing license activation transaction building
    - Ensure current frontend code works with loop-based contract logic
    - Verify that passing same PDA multiple times works correctly
    - Test cases where user has same sponsor at multiple levels
    - _Requirements: 3.1, 3.2, 3.3_

- [ ]\* 5. Create comprehensive tests for loop-based earnings

  - [ ]\* 5.1 Write unit tests for same sponsor at multiple levels

    - Test cumulative earnings when same sponsor appears at L1, L2, L3
    - Verify earnings accumulate correctly across multiple activations
    - _Requirements: 1.2, 3.4_

  - [ ]\* 5.2 Write tests for mixed sponsor scenarios

    - Test cases with different sponsors at each level
    - Verify correct earnings distribution to each sponsor
    - Test empty sponsor levels are skipped
    - _Requirements: 1.4_

  - [ ]\* 5.3 Write integration tests for full activation flow
    - Test complete license activation with duplicate sponsors
    - Verify transaction succeeds without access violations
    - Test earnings persistence across multiple activations
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 4. Update existing tests for loop-based logic

  - [x] 4.1 Update existing license activation tests

    - Modify test assertions to match new loop-based earnings distribution
    - Test scenarios with same sponsor at multiple levels
    - _Requirements: 3.1, 3.3_

  - [x] 4.2 Verify no breaking changes to existing functionality
    - Ensure all existing tests still pass with loop-based approach
    - Confirm earnings calculations remain accurate
    - _Requirements: 1.2, 3.5_
