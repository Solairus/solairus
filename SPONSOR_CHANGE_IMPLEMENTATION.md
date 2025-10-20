# Sponsor Change Implementation

## Current Problem
The existing `update_user_profile` function has critical flaws:
- Only updates user's sponsor field
- Doesn't remove user from old sponsor's referral list
- Doesn't add user to new sponsor's referral list
- No validation against self-sponsorship or duplicate sponsor

## Required Smart Contract Changes

### 1. Add `remove_referral` function to `MyReferrals`

```rust
impl MyReferrals {
    // ... existing add_referral function ...
    
    pub fn remove_referral(&mut self, user: Pubkey) -> Result<()> {
        if let Some(pos) = self.referrals.iter().position(|&x| x == user) {
            self.referrals.remove(pos);
            self.total_count = self.referrals.len() as u32;
        }
        Ok(())
    }
}
```

### 2. Enhanced `update_user_profile` function

```rust
pub fn update_user_profile(
    ctx: Context<UpdateUserProfileEnhanced>, 
    new_sponsor: Pubkey
) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    let config = &ctx.accounts.config;
    let authority = ctx.accounts.authority.key();
    let user = ctx.accounts.user.key();
    
    // Authorization check
    require!(
        authority == config.admin || authority == config.dev,
        ErrorCode::Unauthorized
    );
    
    // Validation checks
    require!(user != new_sponsor, ErrorCode::SelfSponsorNotAllowed);
    require!(profile.sponsor != new_sponsor, ErrorCode::SameSponsorNotAllowed);
    
    let old_sponsor = profile.sponsor;
    
    // Remove from old sponsor's referral list (if not default sponsor)
    if old_sponsor != Pubkey::default() {
        let old_sponsor_referrals = &mut ctx.accounts.old_sponsor_referrals;
        old_sponsor_referrals.remove_referral(user)?;
    }
    
    // Add to new sponsor's referral list (if not default sponsor)
    if new_sponsor != Pubkey::default() {
        let new_sponsor_referrals = &mut ctx.accounts.new_sponsor_referrals;
        if new_sponsor_referrals.sponsor == Pubkey::default() {
            new_sponsor_referrals.sponsor = new_sponsor;
        }
        new_sponsor_referrals.add_referral(user)?;
    }
    
    // Update user's sponsor
    profile.sponsor = new_sponsor;
    
    // Emit event for tracking
    emit!(SponsorChangedEvent {
        user,
        old_sponsor,
        new_sponsor,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}
```

### 3. Enhanced Account Structure

```rust
#[derive(Accounts)]
pub struct UpdateUserProfileEnhanced<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [b"profile", user.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, UserProfile>,
    
    /// CHECK: The user whose profile is being updated
    pub user: AccountInfo<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    // Old sponsor's referral list (to remove user from)
    #[account(
        mut,
        seeds = [b"referrals", profile.sponsor.as_ref()],
        bump,
        constraint = profile.sponsor != Pubkey::default()
    )]
    pub old_sponsor_referrals: Option<Account<'info, MyReferrals>>,
    
    // New sponsor's referral list (to add user to)
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + MyReferrals::SIZE,
        seeds = [b"referrals", new_sponsor.as_ref()],
        bump
    )]
    pub new_sponsor_referrals: Account<'info, MyReferrals>,
    
    pub system_program: Program<'info, System>,
}
```

### 4. New Event and Error Types

```rust
#[event]
pub struct SponsorChangedEvent {
    pub user: Pubkey,
    pub old_sponsor: Pubkey,
    pub new_sponsor: Pubkey,
    pub timestamp: i64,
}

// Add to ErrorCode enum
#[error_code]
pub enum ErrorCode {
    // ... existing errors ...
    #[msg("Cannot set self as sponsor")]
    SelfSponsorNotAllowed,
    #[msg("Cannot update to same sponsor")]
    SameSponsorNotAllowed,
}
```

## Frontend Implementation

### Service Function

```typescript
// src/services/admin/sponsor-management-service.ts
export async function updateUserSponsor(
  program: anchor.Program,
  userPubkey: PublicKey,
  newSponsorPubkey: PublicKey,
  authorityPubkey: PublicKey
): Promise<string> {
  // Validation
  if (userPubkey.equals(newSponsorPubkey)) {
    throw new Error('User cannot sponsor themselves');
  }
  
  // Get current user profile to check existing sponsor
  const { profile: userProfile } = derivePdas(userPubkey);
  const currentProfile = await program.account['userProfile'].fetch(userProfile);
  
  if (currentProfile.sponsor.equals(newSponsorPubkey)) {
    throw new Error('User already has this sponsor');
  }
  
  // Derive PDAs
  const { config } = derivePdas();
  const oldSponsorReferrals = PublicKey.findProgramAddressSync(
    [Buffer.from("referrals"), currentProfile.sponsor.toBuffer()],
    program.programId
  )[0];
  
  const newSponsorReferrals = PublicKey.findProgramAddressSync(
    [Buffer.from("referrals"), newSponsorPubkey.toBuffer()],
    program.programId
  )[0];
  
  // Execute transaction
  const txSignature = await program.methods
    .updateUserProfile(newSponsorPubkey)
    .accounts({
      config,
      profile: userProfile,
      user: userPubkey,
      authority: authorityPubkey,
      oldSponsorReferrals: currentProfile.sponsor.equals(PublicKey.default()) ? null : oldSponsorReferrals,
      newSponsorReferrals,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
    
  return txSignature;
}
```

### Admin UI Component

```typescript
// Add to UserSponsorManagement.tsx
const handleSponsorChange = async (userPubkey: string, newSponsorPubkey: string) => {
  try {
    setIsUpdating(true);
    
    const userKey = new PublicKey(userPubkey);
    const newSponsorKey = new PublicKey(newSponsorPubkey);
    const authorityKey = new PublicKey(account!);
    
    const signature = await updateUserSponsor(
      program,
      userKey,
      newSponsorKey,
      authorityKey
    );
    
    toast.success(`Sponsor updated successfully! Tx: ${signature.slice(0, 8)}...`);
    
    // Refresh data
    await loadUserData();
    
  } catch (error) {
    console.error('Sponsor update failed:', error);
    toast.error(error instanceof Error ? error.message : 'Sponsor update failed');
  } finally {
    setIsUpdating(false);
  }
};
```

## Migration Strategy

1. **Deploy contract changes** with the enhanced `update_user_profile` function
2. **Test thoroughly** on devnet with various scenarios
3. **Update admin interface** to use the new function
4. **Document the process** for admin users

## Key Benefits

- ✅ Proper referral list management
- ✅ Prevents self-sponsorship
- ✅ Prevents duplicate sponsor updates
- ✅ Maintains data consistency
- ✅ Emits events for tracking
- ✅ Admin-only access control

## Testing Scenarios

1. Normal sponsor change (A → B)
2. Change from default sponsor to real sponsor
3. Change from real sponsor to default sponsor
4. Attempt self-sponsorship (should fail)
5. Attempt same sponsor update (should fail)
6. Unauthorized access attempt (should fail)