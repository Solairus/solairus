# License Contract Deployment Guide

## Overview

This document outlines the deployment process for the updated solairus_main contract with license expiration tracking features.

## Contract Changes

### 1. UserProfile Struct Updates

The UserProfile struct has been updated to include license expiration tracking:

```rust
#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub sponsor_l1: Pubkey,
    pub sponsor_l2: Pubkey,
    pub sponsor_l3: Pubkey,
    pub created_at: i64,
    pub active_principal_usdt: u64,
    pub last_roi_withdraw_at: i64,
    pub license_expires_at: i64, // NEW FIELD
}
```

### 2. Config Struct Updates

The Config struct has been updated to include configurable license duration:

```rust
#[account]
pub struct Config {
    // ... existing fields
    pub license_duration_days: u16, // NEW FIELD (default: 365)
    // ... rest of existing fields
}
```

### 3. Instruction Updates

The `activate_license_usdt` instruction has been updated to set license expiration:

```rust
pub fn activate_license_usdt(ctx: Context<ActivateLicenseUsdt>, amount: u64) -> Result<()> {
    // ... existing payment logic
    
    // NEW: Set license expiration
    let clock = Clock::get()?;
    let config = &ctx.accounts.config;
    let license_duration_seconds = (config.license_duration_days as i64) * 24 * 60 * 60;
    
    ctx.accounts.profile.license_expires_at = clock.unix_timestamp + license_duration_seconds;
    
    // ... rest of existing logic
}
```

## Deployment Steps

### 1. Pre-deployment Checklist

- [ ] Update contract code with new fields
- [ ] Test on devnet/testnet
- [ ] Verify IDL compatibility
- [ ] Prepare migration scripts
- [ ] Backup existing data

### 2. Contract Deployment

```bash
# Build the updated contract
anchor build

# Deploy to devnet for testing
anchor deploy --provider.cluster devnet

# Verify deployment
anchor test --provider.cluster devnet

# Deploy to mainnet (when ready)
anchor deploy --provider.cluster mainnet-beta
```

### 3. Data Migration

Since we're adding new fields to existing accounts, we need to handle backward compatibility:

```rust
// Migration helper for existing UserProfile accounts
pub fn migrate_user_profile(ctx: Context<MigrateUserProfile>) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    
    // If license_expires_at is 0 (uninitialized), calculate from created_at
    if profile.license_expires_at == 0 {
        let default_duration_seconds = 365 * 24 * 60 * 60; // 365 days
        profile.license_expires_at = profile.created_at + default_duration_seconds;
    }
    
    Ok(())
}
```

### 4. Frontend Updates

Update the IDL file and TypeScript interfaces:

```bash
# Copy updated IDL to frontend
cp target/idl/solairus_main.json src/idl/

# Update TypeScript interfaces
# (Already done in src/lib/solairus-main.ts)
```

## Migration Strategy

### Phase 1: Contract Deployment
1. Deploy updated contract to devnet
2. Test all functionality
3. Deploy to mainnet

### Phase 2: Data Migration
1. Run migration script for existing UserProfile accounts
2. Verify data integrity
3. Monitor for issues

### Phase 3: Frontend Rollout
1. Deploy frontend with license guard features
2. Enable license checking gradually
3. Monitor user experience

## Rollback Plan

If issues are encountered:

1. **Frontend Rollback**: Disable license guard via environment variable
2. **Contract Rollback**: Revert to previous contract version
3. **Data Recovery**: Restore from backups if necessary

## Testing Checklist

### Contract Testing
- [ ] License activation works correctly
- [ ] Expiration timestamps are set properly
- [ ] Migration handles existing accounts
- [ ] All existing functionality still works

### Frontend Testing
- [ ] License status displays correctly
- [ ] Activation flow works end-to-end
- [ ] Error handling works properly
- [ ] Performance is acceptable

### Integration Testing
- [ ] Wallet connection works
- [ ] Transaction signing works
- [ ] Network switching works
- [ ] Offline handling works

## Monitoring

After deployment, monitor:

1. **Transaction Success Rate**: License activation transactions
2. **Error Rates**: Failed license checks or activations
3. **Performance**: License status check times
4. **User Experience**: Support tickets related to licensing

## Environment Variables

Configure the following environment variables:

```env
# Enable/disable license guard
VITE_ENABLE_LICENSE_GUARD=true

# Contract addresses
VITE_SOLAIRUS_MAIN_PROGRAM_ID=CXK63PkidRsKhnYCF3kMHqEX3RGgy9JJkebN3S91VHD3

# Network configuration
VITE_SOLANA_CLUSTER=mainnet-beta
```

## Support Documentation

Update user documentation to include:

1. License activation process
2. Troubleshooting guide
3. FAQ about licensing
4. Contact information for support

## Post-Deployment Tasks

1. Monitor system health
2. Gather user feedback
3. Optimize performance based on usage
4. Plan future enhancements