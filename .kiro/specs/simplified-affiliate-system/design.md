# Simplified Affiliate System Design

## Overview

This design eliminates the complex AffiliateEarnings PDA system and moves affiliate earnings tracking directly into UserProfile accounts. This simplifies the architecture, reduces costs, and makes the system more maintainable while preserving all functionality.

## Architecture

### Current vs New Architecture

**Current (Complex):**
```
License Activation → Creates AffiliateEarnings PDAs → Tracks earnings in separate accounts
```

**New (Simplified):**
```
License Activation → Updates sponsor UserProfile directly → All earnings in one place
```

### Key Changes

1. **Remove AffiliateEarnings struct and PDAs**
2. **Add affiliate fields to UserProfile**
3. **Simplify license activation logic**
4. **Add direct withdrawal from UserProfile**

## Components and Interfaces

### Updated UserProfile Structure

```rust
#[account]
pub struct UserProfile {
    // Existing fields
    pub user: Pubkey,
    pub sponsor_l1: Pubkey,
    pub sponsor_l2: Pubkey,
    pub sponsor_l3: Pubkey,
    pub created_at: i64,
    pub active_principal_usdt: u64,
    pub last_roi_withdraw_at: i64,
    pub license_expires_at: i64,
    
    // NEW: Affiliate earnings tracking
    pub total_affiliate_earnings: u64,    // Total earned from all referrals
    pub total_affiliate_withdrawn: u64,   // Total amount withdrawn
    pub level1_earnings: u64,             // Earnings from L1 referrals (accounting)
    pub level2_earnings: u64,             // Earnings from L2 referrals (accounting)  
    pub level3_earnings: u64,             // Earnings from L3 referrals (accounting)
}
```

### New ReferralTracker Structure

```rust
#[account]
pub struct ReferralTracker {
    pub owner: Pubkey,                    // The sponsor who owns this tracker
    pub level1_referrals: Vec<Pubkey>,    // Direct referrals (L1)
    pub level2_referrals: Vec<Pubkey>,    // L2 referrals (referrals of referrals)
    pub level3_referrals: Vec<Pubkey>,    // L3 referrals (3rd level down)
    pub total_referrals: u32,             // Total count across all levels
}
```

### Simplified License Activation with Referral Tracking

```rust
pub fn activate_license_usdt(ctx: Context<ActivateLicenseUsdt>, amount: u64) -> Result<()> {
    // ... existing license logic ...
    
    // Calculate affiliate amounts
    let aff_l1_amt = pct_of(amount, cfg.license_aff_l1_pct)?;
    let aff_l2_amt = pct_of(amount, cfg.license_aff_l2_pct)?;
    let aff_l3_amt = pct_of(amount, cfg.license_aff_l3_pct)?;
    
    let user_pubkey = ctx.accounts.user.key();
    
    // Update sponsor profiles and referral tracking
    update_sponsor_earnings(&mut ctx.accounts.sponsor_l1_profile, aff_l1_amt, 1)?;
    update_sponsor_earnings(&mut ctx.accounts.sponsor_l2_profile, aff_l2_amt, 2)?;
    update_sponsor_earnings(&mut ctx.accounts.sponsor_l3_profile, aff_l3_amt, 3)?;
    
    // Track referrals for each sponsor level
    add_referral(&mut ctx.accounts.sponsor_l1_tracker, user_pubkey, 1)?;
    add_referral(&mut ctx.accounts.sponsor_l2_tracker, user_pubkey, 2)?;
    add_referral(&mut ctx.accounts.sponsor_l3_tracker, user_pubkey, 3)?;
    
    Ok(())
}
```

### Referral Tracking Functions

```rust
fn add_referral(
    tracker: &mut Option<Account<ReferralTracker>>, 
    referral: Pubkey, 
    level: u8
) -> Result<()> {
    if let Some(tracker) = tracker {
        match level {
            1 => {
                if !tracker.level1_referrals.contains(&referral) {
                    tracker.level1_referrals.push(referral);
                    tracker.total_referrals += 1;
                }
            },
            2 => {
                if !tracker.level2_referrals.contains(&referral) {
                    tracker.level2_referrals.push(referral);
                    tracker.total_referrals += 1;
                }
            },
            3 => {
                if !tracker.level3_referrals.contains(&referral) {
                    tracker.level3_referrals.push(referral);
                    tracker.total_referrals += 1;
                }
            },
            _ => return Err(ErrorCode::InvalidAmount.into()),
        }
    }
    Ok(())
}
```

### New Withdrawal Function

```rust
pub fn withdraw_affiliate_earnings(ctx: Context<WithdrawAffiliateEarnings>, amount: u64) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    
    // Validate withdrawal amount
    let available = profile.total_affiliate_earnings - profile.total_affiliate_withdrawn;
    require!(amount <= available, ErrorCode::InsufficientFunds);
    
    // Transfer USDT from vault to user
    // ... transfer logic ...
    
    // Update profile
    profile.total_affiliate_withdrawn += amount;
    
    Ok(())
}
```

## Data Models

### Account Context Changes

**Remove:**
- `AffiliateEarnings` struct
- All affiliate PDA account contexts
- `accrue_affiliate` function

**Add:**
- Affiliate fields to `UserProfile`
- `ReferralTracker` struct for tracking referral networks
- `WithdrawAffiliateEarnings` context
- Sponsor profile accounts and referral trackers in license activation context

**Update:**
- `ActivateLicenseUsdt` context to include sponsor profiles instead of affiliate PDAs
- `UserProfile` size calculation for new fields

## Error Handling

### New Error Types
```rust
#[error_code]
pub enum ErrorCode {
    // ... existing errors ...
    #[msg("Insufficient affiliate earnings")]
    InsufficientFunds,
    #[msg("Sponsor not registered")]
    SponsorNotRegistered,
}
```

### Sponsor Validation Logic
```rust
fn update_sponsor_earnings(
    sponsor_profile: &mut Option<Account<UserProfile>>, 
    dev_profile: &mut Account<UserProfile>,
    amount: u64, 
    level: u8
) -> Result<()> {
    let target_profile = match sponsor_profile {
        Some(profile) => profile,
        None => {
            msg!("Sponsor not registered, defaulting to dev");
            dev_profile
        }
    };
    
    // Update earnings
    target_profile.total_affiliate_earnings += amount;
    match level {
        1 => target_profile.level1_earnings += amount,
        2 => target_profile.level2_earnings += amount,
        3 => target_profile.level3_earnings += amount,
        _ => return Err(ErrorCode::InvalidAmount.into()),
    }
    
    Ok(())
}
```

## Testing Strategy

### Unit Tests
- Test affiliate earnings accumulation in UserProfile
- Test withdrawal validation and limits
- Test sponsor fallback to dev account
- Test earnings tracking across multiple activations

### Integration Tests
- Test complete license activation flow with affiliate earnings
- Test withdrawal flow from profile to wallet
- Test multiple referral levels and earnings distribution
- Test unregistered sponsor handling

### Migration Tests
- Test deployment of new contract
- Test compatibility with existing user profiles
- Test data migration if needed

## Deployment Strategy

### Program Closure and Redeployment

1. **Close Current Program**
   ```bash
   solana program close <PROGRAM_ID> --keypair <AUTHORITY_KEYPAIR>
   ```

2. **Deploy New Program**
   ```bash
   anchor build
   anchor deploy
   ```

3. **Update Program ID**
   - Update `declare_id!()` in contract
   - Update IDL files
   - Update frontend configuration

### Migration Considerations

- Existing UserProfile accounts remain compatible (new fields default to 0)
- No data migration needed for core functionality
- Affiliate PDA accounts can be closed to reclaim rent
- Frontend needs updates to use new withdrawal function

## Benefits of New Design

1. **Simplified Architecture**: No complex PDA management
2. **Lower Costs**: No affiliate PDA creation fees
3. **Better Performance**: Fewer account lookups and validations
4. **Easier Maintenance**: Single source of truth for user data
5. **Clearer Logic**: Direct earnings tracking in user profiles
6. **Reduced Complexity**: Fewer account contexts and validations

This design maintains all existing functionality while significantly simplifying the implementation and reducing operational complexity.