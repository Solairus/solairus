# Implementation Plan

- [x] 1. Add missing agent_reserve_pct field to contract structures

  - Add agent_reserve_pct field to Config struct in solairus_main/src/lib.rs
  - Add agent_reserve_pct field to SetConfigArgs struct
  - Update Config::SIZE calculation to include new field
  - _Requirements: 3.1, 3.4_

- [x] 2. Update percentage validation logic

  - [x] 2.1 Fix license percentage sum validation

    - Update license percentage sum calculation to use correct field names
    - Ensure validation requires exactly 100% total
    - _Requirements: 5.1_

  - [x] 2.2 Fix agent percentage sum validation

    - Update agent percentage sum calculation to include agent_reserve_pct
    - Ensure validation requires exactly 100% total
    - Add proper error handling for agent configuration validation
    - _Requirements: 5.2, 3.1_

  - [x] 2.3 Add individual percentage range validation
    - Implement validation that each percentage field is between 0-100
    - Add error handling for out-of-range percentage values
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 3. Update agent activation function to handle reserve allocation

  - [x] 3.1 Add reserve percentage calculation to hire_agent function

    - Calculate reserve_amt using pct_of(amount, cfg.agent_reserve_pct)
    - Add reserve amount to bucket_systemreserve_usdt tracking
    - Include reserve amount in total distribution calculation
    - _Requirements: 2.6_

  - [x] 3.2 Update agent activation fund distribution logic
    - Ensure all percentage calculations use correct config fields
    - Verify affiliate commission calculations are properly implemented
    - Update sum validation to include reserve amount
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9_

- [x] 4. Fix initialization script percentage values

  - [x] 4.1 Update license activation percentages in initialize_solairus_main.mjs

    - Set license_admin_pct to 30
    - Set license_dev_pct to 30
    - Set license_marketer1_pct to 5
    - Set license_marketer2_pct to 5
    - Set license_reserve_pct to 20
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 Update agent activation percentages in initialize_solairus_main.mjs

    - Set agent_admin_pct to 10
    - Set agent_dev_pct to 10
    - Set agent_marketer1_pct to 5
    - Set agent_marketer2_pct to 5
    - Set agent_trader_pct to 15
    - Add agent_reserve_pct set to 45
    - Set agent_aff_l1_pct to 5
    - Set agent_aff_l2_pct to 3
    - Set agent_aff_l3_pct to 2
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [x] 4.3 Update initialization script validation
    - Add agent_reserve_pct to percentFields array for validation
    - Verify all percentage calculations sum to 100
    - _Requirements: 4.12_

- [x] 5. Add comprehensive testing for percentage corrections

  - [x] 5.1 Create unit tests for percentage validation

    - Test license percentage sum validation with correct values
    - Test agent percentage sum validation with correct values
    - Test individual percentage range validation
    - Test error handling for invalid configurations
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.2 Create integration tests for fund distribution
    - Test license activation produces correct fund distribution
    - Test agent activation produces correct fund distribution including reserve
    - Test affiliate commission calculations for both activation types
    - Verify bucket balance updates match expected percentages
    - _Requirements: 1.1-1.8, 2.1-2.9_

- [x] 6. Deploy and verify percentage corrections

  - [x] 6.1 Update contract configuration with correct percentages

    - Deploy updated contract with agent_reserve_pct field
    - Run initialization script with corrected percentage values
    - Verify configuration validation accepts correct percentages
    - _Requirements: 3.1, 4.1-4.12_

  - [x] 6.2 Validate corrected fund distributions
    - Test license activation with corrected percentages
    - Test agent activation with corrected percentages including reserve
    - Verify affiliate commissions are properly distributed
    - Confirm all bucket allocations match design specifications
    - _Requirements: 1.1-1.8, 2.1-2.9_
