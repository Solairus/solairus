# Requirements Document

## Introduction

The Solairus system currently has incorrect commission percentage distributions for both license activation and agent activation functions. The license activation has wrong percentage allocations for marketers, admin, dev, and reserve buckets, while agent activation is missing the reserve percentage field entirely and has completely incorrect distribution percentages. This feature will correct both commission structures to match the designed business logic.

## Glossary

- **Solairus_Main_Program**: The main smart contract program managing license and agent activations
- **License_Activation**: Function that processes user license purchases with commission distribution
- **Agent_Activation**: Function that processes agent hiring with commission distribution  
- **Commission_Distribution**: The percentage-based allocation of activation fees to different system buckets
- **Config_Struct**: The on-chain configuration structure storing all percentage values
- **System_Buckets**: Individual accounts tracking balances for admin, dev, marketers, trader, and reserve
- **Affiliate_Commission**: Multi-level commission structure (L1: 5%, L2: 3%, L3: 2%) paid to sponsors
- **Reserve_Bucket**: System reserve account for operational funds
- **Initialization_Script**: JavaScript script that sets initial configuration values

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want license activation to distribute funds according to the correct business model percentages, so that each system bucket receives the proper allocation.

#### Acceptance Criteria

1. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 30% to admin bucket
2. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 30% to dev bucket  
3. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 5% to marketer1 bucket
4. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 5% to marketer2 bucket
5. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 20% to reserve bucket
6. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 5% to L1 affiliate commission
7. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 3% to L2 affiliate commission
8. WHEN a license activation occurs, THE Solairus_Main_Program SHALL allocate 2% to L3 affiliate commission

### Requirement 2

**User Story:** As a system administrator, I want agent activation to distribute funds according to the correct business model percentages, so that each system bucket receives the proper allocation including the missing reserve allocation.

#### Acceptance Criteria

1. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 10% to admin bucket
2. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 10% to dev bucket
3. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 5% to marketer1 bucket
4. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 5% to marketer2 bucket
5. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 15% to trader bucket
6. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 45% to reserve bucket
7. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 5% to L1 affiliate commission
8. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 3% to L2 affiliate commission
9. WHEN an agent activation occurs, THE Solairus_Main_Program SHALL allocate 2% to L3 affiliate commission

### Requirement 3

**User Story:** As a system administrator, I want the Config_Struct to include all necessary percentage fields, so that both license and agent activations can access their required distribution percentages.

#### Acceptance Criteria

1. THE Config_Struct SHALL include agent_reserve_pct field for agent activation reserve allocation
2. THE Config_Struct SHALL maintain all existing license percentage fields
3. THE Config_Struct SHALL maintain all existing agent percentage fields
4. THE Config_Struct SHALL update size calculation to account for additional field
5. THE Config_Struct SHALL support percentage validation for all fields

### Requirement 4

**User Story:** As a system administrator, I want the initialization script to set correct percentage values, so that the system launches with proper commission distributions.

#### Acceptance Criteria

1. THE Initialization_Script SHALL set license_admin_pct to 30
2. THE Initialization_Script SHALL set license_dev_pct to 30
3. THE Initialization_Script SHALL set license_marketer1_pct to 5
4. THE Initialization_Script SHALL set license_marketer2_pct to 5
5. THE Initialization_Script SHALL set license_reserve_pct to 20
6. THE Initialization_Script SHALL set agent_admin_pct to 10
7. THE Initialization_Script SHALL set agent_dev_pct to 10
8. THE Initialization_Script SHALL set agent_marketer1_pct to 5
9. THE Initialization_Script SHALL set agent_marketer2_pct to 5
10. THE Initialization_Script SHALL set agent_trader_pct to 15
11. THE Initialization_Script SHALL set agent_reserve_pct to 45
12. THE Initialization_Script SHALL maintain affiliate percentages at 5, 3, 2 for both license and agent

### Requirement 5

**User Story:** As a system administrator, I want percentage validation to ensure configuration integrity, so that invalid percentage combinations cannot be deployed.

#### Acceptance Criteria

1. THE Solairus_Main_Program SHALL validate that license percentage fields sum to exactly 100
2. THE Solairus_Main_Program SHALL validate that agent percentage fields sum to exactly 100
3. THE Solairus_Main_Program SHALL validate that each individual percentage field is within valid range (0-100)
4. IF percentage validation fails, THEN THE Solairus_Main_Program SHALL reject the configuration update
5. THE Solairus_Main_Program SHALL provide clear error messages for validation failures