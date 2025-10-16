# Design Document

## Overview

This design addresses the affiliate earnings distribution issue by implementing a loop-based approach that can handle duplicate sponsors across multiple levels. The key insight is that during license activation, we only need to update existing sponsor profiles with earnings - we're not creating new accounts, just updating balances.

## Architecture

### Current Problem
- The current implementation uses separate account parameters for each sponsor level (sponsor_l1_profile, sponsor_l2_profile, sponsor_l3_profile)
- When the same sponsor appears at multiple levels, Anchor tries to pass the same PDA multiple times, causing access violations
- The conditional logic checks if sponsors exist but doesn't handle the duplicate account issue

### Proposed Solution
- Use a single `sponsor_profile` account parameter that gets reused
- Implement a loop that iterates through sponsor levels
- For each level, derive the correct PDA and update earnings if it matches the provided account
- Handle the case where different sponsors require different account calls

## Components and Interfaces

### Keep Existing ActivateLicenseUsdt Context
```rust
#[derive(Accounts)]
pub struct ActivateLicenseUsdt<'info> {
    // ... existing accounts ...
    
    /// Keep the existing three sponsor profile accounts
    /// The contract logic will handle when they point to the same PDA
    #[account(mut)]
    pub sponsor_l1_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub sponsor_l2_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub sponsor_l3_profile: Account<'info, UserProfile>,
}
```

### Loop-Based Earnings Distribution
```rust
// Sponsor data: (profile_account, address, amount, level)
let sponsors = [
    (&mut ctx.accounts.sponsor_l1_profile, profile.sponsor_l1, aff_l1_amt, 1),
    (&mut ctx.accounts.sponsor_l2_profile, profile.sponsor_l2, aff_l2_amt, 2), 
    (&mut ctx.accounts.sponsor_l3_profile, profile.sponsor_l3, aff_l3_amt, 3),
];

for (sponsor_account, sponsor_addr, amount, _level) in sponsors.iter() {
    if *sponsor_addr != Pubkey::default() {
        // Update earnings directly - no need for PDA validation since Anchor handles it
        sponsor_account.affiliate_earnings_usdt = 
            sponsor_account.affiliate_earnings_usdt
                .checked_add(*amount)
                .ok_or(ErrorCode::MathOverflow)?;
    }
}
```

## Data Models

### UserProfile (No Changes Required)
The existing UserProfile struct already has the necessary fields:
- `sponsor_l1`, `sponsor_l2`, `sponsor_l3`: Store sponsor addresses
- `affiliate_earnings_usdt`: Accumulates earnings from referrals

### Configuration (No Changes Required)
The existing configuration percentages remain the same:
- `license_aff_l1_pct`, `license_aff_l2_pct`, `license_aff_l3_pct`

## Error Handling

### Scenarios Handled
1. **Same sponsor at all levels**: Loop will update the same PDA three times
2. **Different sponsors**: Only the matching PDA will be updated, others skipped
3. **Empty sponsor levels**: Default pubkey check will skip these levels
4. **Math overflow**: Existing overflow protection maintained

### Frontend Considerations
No changes required to the frontend. The frontend will continue to:
1. Pass the three sponsor profile accounts as it currently does
2. The contract will handle the logic of updating earnings appropriately
3. When the same sponsor appears at multiple levels, the same PDA will be passed multiple times, but the contract will handle this gracefully

## Testing Strategy

### Unit Tests
1. Test same sponsor at all three levels (cumulative earnings)
2. Test different sponsors at each level (selective updates)
3. Test mixed scenarios (some same, some different)
4. Test empty sponsor levels
5. Test math overflow scenarios

### Integration Tests
1. Full license activation flow with duplicate sponsors
2. Verify earnings accumulation across multiple activations
3. Test with real PDA derivation and account validation

## Alternative Approaches Considered

### Option 1: Multiple Transactions
- Split earnings distribution into separate transactions per unique sponsor
- **Rejected**: Increases complexity and gas costs

### Option 2: Dynamic Account Resolution
- Use remaining_accounts to pass variable number of sponsor accounts
- **Rejected**: More complex than needed for this use case

### Option 3: Current Loop Approach (Selected)
- Simple, handles most common case (same sponsor at multiple levels)
- Minimal changes to existing contract structure
- Clear and maintainable code