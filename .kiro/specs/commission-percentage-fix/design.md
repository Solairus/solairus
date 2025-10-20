# Design Document

## Overview

This design addresses the commission percentage configuration issues in the solairus_main program. The current implementation has incorrect percentage distributions for both license activation (wrong allocations to marketers, admin, dev, reserve) and agent activation (missing reserve field, incorrect percentages, zero affiliate commissions). The solution involves updating the contract structure, fixing percentage calculations, and correcting initialization values.

## Architecture

### Current State Analysis

**License Activation Issues:**
- Admin: 20% → Should be 30%
- Dev: 20% → Should be 30% 
- Marketer1: 10% → Should be 5%
- Marketer2: 10% → Should be 5%
- Reserve: 30% → Should be 20%
- Affiliates: Correct (5%, 3%, 2%)

**Agent Activation Issues:**
- Admin: 20% → Should be 10%
- Dev: 20% → Should be 10%
- Marketer1: 10% → Should be 5%
- Marketer2: 10% → Should be 5%
- Trader: 40% → Should be 15%
- Reserve: Missing field → Should be 45%
- Affiliates: 0% each → Should be (5%, 3%, 2%)

### Solution Architecture

The fix involves three main components:
1. **Contract Structure Updates**: Add missing agent_reserve_pct field
2. **Percentage Corrections**: Update all incorrect percentage values
3. **Validation Logic**: Ensure proper percentage sum validation

## Components and Interfaces

### 1. Config Struct Updates

**Current Structure:**
```rust
pub struct Config {
    // ... existing fields ...
    // License percentages (some incorrect)
    pub license_admin_pct: u16,     // 20% → 30%
    pub license_dev_pct: u16,       // 20% → 30%
    pub license_marketer1_pct: u16, // 10% → 5%
    pub license_marketer2_pct: u16, // 10% → 5%
    pub license_reserve_pct: u16,   // 30% → 20%
    pub license_aff_l1_pct: u16,    // 5% ✓
    pub license_aff_l2_pct: u16,    // 3% ✓
    pub license_aff_l3_pct: u16,    // 2% ✓
    
    // Agent percentages (all incorrect)
    pub agent_admin_pct: u16,       // 20% → 10%
    pub agent_dev_pct: u16,         // 20% → 10%
    pub agent_marketer1_pct: u16,   // 10% → 5%
    pub agent_marketer2_pct: u16,   // 10% → 5%
    pub agent_trader_pct: u16,      // 40% → 15%
    // MISSING: agent_reserve_pct   // → 45%
    pub agent_aff_l1_pct: u16,      // 0% → 5%
    pub agent_aff_l2_pct: u16,      // 0% → 3%
    pub agent_aff_l3_pct: u16,      // 0% → 2%
}
```

**Updated Structure:**
```rust
pub struct Config {
    // ... existing fields ...
    // License percentages (corrected)
    pub license_admin_pct: u16,     // 30%
    pub license_dev_pct: u16,       // 30%
    pub license_marketer1_pct: u16, // 5%
    pub license_marketer2_pct: u16, // 5%
    pub license_reserve_pct: u16,   // 20%
    pub license_aff_l1_pct: u16,    // 5%
    pub license_aff_l2_pct: u16,    // 3%
    pub license_aff_l3_pct: u16,    // 2%
    
    // Agent percentages (corrected)
    pub agent_admin_pct: u16,       // 10%
    pub agent_dev_pct: u16,         // 10%
    pub agent_marketer1_pct: u16,   // 5%
    pub agent_marketer2_pct: u16,   // 5%
    pub agent_trader_pct: u16,      // 15%
    pub agent_reserve_pct: u16,     // 45% (NEW FIELD)
    pub agent_aff_l1_pct: u16,      // 5%
    pub agent_aff_l2_pct: u16,      // 3%
    pub agent_aff_l3_pct: u16,      // 2%
}
```

### 2. SetConfigArgs Updates

**Add Missing Field:**
```rust
pub struct SetConfigArgs {
    // ... existing fields ...
    pub agent_trader_pct: u16,
    pub agent_reserve_pct: u16,     // NEW FIELD
    pub agent_aff_l1_pct: u16,
    // ... rest of fields ...
}
```

### 3. Agent Activation Function Updates

**Current Implementation (Missing Reserve):**
```rust
pub fn hire_agent(ctx: Context<HireAgent>, amount: u64) -> Result<()> {
    // ... existing logic ...
    let admin_amt = pct_of(amount, cfg.agent_admin_pct)?;
    let dev_amt = pct_of(amount, cfg.agent_dev_pct)?;
    let m1_amt = pct_of(amount, cfg.agent_marketer1_pct)?;
    let m2_amt = pct_of(amount, cfg.agent_marketer2_pct)?;
    let trader_amt = pct_of(amount, cfg.agent_trader_pct)?;
    // MISSING: reserve allocation
    let aff_l1_amt = pct_of(amount, cfg.agent_aff_l1_pct)?;
    let aff_l2_amt = pct_of(amount, cfg.agent_aff_l2_pct)?;
    let aff_l3_amt = pct_of(amount, cfg.agent_aff_l3_pct)?;
}
```

**Updated Implementation (With Reserve):**
```rust
pub fn hire_agent(ctx: Context<HireAgent>, amount: u64) -> Result<()> {
    // ... existing logic ...
    let admin_amt = pct_of(amount, cfg.agent_admin_pct)?;
    let dev_amt = pct_of(amount, cfg.agent_dev_pct)?;
    let m1_amt = pct_of(amount, cfg.agent_marketer1_pct)?;
    let m2_amt = pct_of(amount, cfg.agent_marketer2_pct)?;
    let trader_amt = pct_of(amount, cfg.agent_trader_pct)?;
    let reserve_amt = pct_of(amount, cfg.agent_reserve_pct)?; // NEW
    let aff_l1_amt = pct_of(amount, cfg.agent_aff_l1_pct)?;
    let aff_l2_amt = pct_of(amount, cfg.agent_aff_l2_pct)?;
    let aff_l3_amt = pct_of(amount, cfg.agent_aff_l3_pct)?;
    
    // Add reserve to bucket tracking
    cfg.bucket_systemreserve_usdt = cfg.bucket_systemreserve_usdt
        .checked_add(reserve_amt)
        .ok_or(ErrorCode::Overflow)?;
}
```

## Data Models

### Percentage Distribution Models

**License Activation Distribution:**
```
Total: 100%
├── Admin: 30%
├── Dev: 30%
├── Marketer1: 5%
├── Marketer2: 5%
├── Reserve: 20%
└── Affiliates: 10%
    ├── L1: 5%
    ├── L2: 3%
    └── L3: 2%
```

**Agent Activation Distribution:**
```
Total: 100%
├── Admin: 10%
├── Dev: 10%
├── Marketer1: 5%
├── Marketer2: 5%
├── Trader: 15%
├── Reserve: 45%
└── Affiliates: 10%
    ├── L1: 5%
    ├── L2: 3%
    └── L3: 2%
```

### Configuration Validation Model

**Validation Rules:**
- Each percentage field: 0 ≤ value ≤ 100
- License sum: license_admin_pct + license_dev_pct + license_marketer1_pct + license_marketer2_pct + license_reserve_pct + license_aff_l1_pct + license_aff_l2_pct + license_aff_l3_pct = 100
- Agent sum: agent_admin_pct + agent_dev_pct + agent_marketer1_pct + agent_marketer2_pct + agent_trader_pct + agent_reserve_pct + agent_aff_l1_pct + agent_aff_l2_pct + agent_aff_l3_pct = 100

## Error Handling

### Validation Errors

**New Error Types:**
```rust
#[error_code]
pub enum ErrorCode {
    // ... existing errors ...
    #[msg("Agent percentage sum must equal 100")]
    InvalidAgentConfigSum,
    #[msg("License percentage sum must equal 100")]
    InvalidLicenseConfigSum,
    #[msg("Individual percentage must be between 0 and 100")]
    InvalidPercentageRange,
}
```

**Validation Implementation:**
```rust
// License validation
let license_sum = cfg.license_admin_pct as u32
    + cfg.license_dev_pct as u32
    + cfg.license_marketer1_pct as u32
    + cfg.license_marketer2_pct as u32
    + cfg.license_reserve_pct as u32
    + cfg.license_aff_l1_pct as u32
    + cfg.license_aff_l2_pct as u32
    + cfg.license_aff_l3_pct as u32;
require!(license_sum == 100, ErrorCode::InvalidLicenseConfigSum);

// Agent validation
let agent_sum = cfg.agent_admin_pct as u32
    + cfg.agent_dev_pct as u32
    + cfg.agent_marketer1_pct as u32
    + cfg.agent_marketer2_pct as u32
    + cfg.agent_trader_pct as u32
    + cfg.agent_reserve_pct as u32  // NEW FIELD
    + cfg.agent_aff_l1_pct as u32
    + cfg.agent_aff_l2_pct as u32
    + cfg.agent_aff_l3_pct as u32;
require!(agent_sum == 100, ErrorCode::InvalidAgentConfigSum);
```

## Testing Strategy

### Unit Tests

1. **Percentage Validation Tests**
   - Test license percentage sum validation
   - Test agent percentage sum validation
   - Test individual percentage range validation
   - Test error handling for invalid configurations

2. **Distribution Calculation Tests**
   - Test license activation fund distribution with correct percentages
   - Test agent activation fund distribution with correct percentages
   - Test affiliate commission calculations
   - Test reserve allocation for agent activation

3. **Configuration Update Tests**
   - Test setting configuration with correct percentages
   - Test rejection of invalid percentage configurations
   - Test handling of missing agent_reserve_pct field

### Integration Tests

1. **End-to-End Activation Tests**
   - Test complete license activation flow with corrected percentages
   - Test complete agent activation flow with corrected percentages
   - Verify bucket balance updates match expected distributions

2. **Migration Tests**
   - Test configuration update from current incorrect values to correct values
   - Verify system continues to function after percentage corrections

### Deployment Validation

1. **Pre-deployment Checks**
   - Verify initialization script has correct percentage values
   - Validate that all percentage sums equal 100
   - Confirm agent_reserve_pct field is properly added

2. **Post-deployment Verification**
   - Test license activation produces correct fund distribution
   - Test agent activation produces correct fund distribution
   - Verify affiliate commissions are properly distributed for both activation types