# Sponsor Tree Fix Summary

## Issue
License activation was failing with error: "Cannot read properties of undefined (reading 'toString')"

## Root Cause
The `sponsor-tree.ts` file was trying to access `userProfile.sponsorL1`, `userProfile.sponsorL2`, and `userProfile.sponsorL3` fields that don't exist in the UserProfile structure.

The actual UserProfile structure only has:
- `sponsor: PublicKey` (single direct sponsor field)

## Fix Applied

### 1. Updated `getUserSponsors` function
- **Before**: Tried to access non-existent `sponsorL1`, `sponsorL2`, `sponsorL3` fields
- **After**: Renamed to `getUserSponsor` and returns only the single `sponsor` field

### 2. Updated `buildSponsorHierarchy` function
- **Before**: Expected L1/L2/L3 fields from user profile
- **After**: Builds hierarchy by traversing the sponsor chain:
  - L1 = user's direct sponsor (from profile)
  - L2 = L1's sponsor (looked up on-chain)
  - L3 = L2's sponsor (looked up on-chain)

### 3. Updated `getUserReferralTree` function
- **Before**: Accessed non-existent sponsor fields directly
- **After**: Uses `buildSponsorHierarchy` to construct the complete tree

## How It Works Now

1. **User Profile Storage**: Only stores direct sponsor (L1)
2. **Hierarchy Construction**: L2 and L3 are computed by traversing the sponsor chain
3. **Fallback Logic**: Uses default sponsor (dev key) when sponsors aren't found
4. **Error Handling**: Gracefully handles missing profiles and network errors

## Result
License activation now works correctly with proper sponsor hierarchy construction from the simplified UserProfile structure.