# Earnings History Implementation TODO

## Current Status
- **REMOVED**: EarningsHistoryCard temporarily removed from Affiliate page
- **REASON**: Implementation was causing excessive RPC calls and 429 rate limiting errors

## Issues with Previous Implementation
1. **Not using RPC fallback system**: The codebase has comma-separated RPC URLs in .env with automatic fallbacks, but the earnings history service wasn't using this system
2. **Too aggressive RPC calls**: Making too many `getSignaturesForAddress` and `getTransactions` calls
3. **Not following established patterns**: Other services like `useBucketBalances.ts` use the existing connection from wallet context

## What We Learned
- User profile data shows: Total earnings: 1792.47 USDT, Total withdrawn: 1.25 USDT
- The smart contract emits `AffiliateEarningsWithdrawalEvent` only for withdrawals, not for earnings crediting
- Earnings are credited via `distribute_affiliate_earnings!` macro but no events are emitted for this
- **CRITICAL**: Profile data alone is insufficient for accurate withdrawal history estimation
  - We only have cumulative totals, not individual transaction details
  - To estimate accurately, we'd need to know how much money was spent by referrals to generate those earnings
  - Multiple withdrawals could have occurred, but we can't determine individual amounts or timing from profile data

## Proper Implementation Plan

### 1. Use Existing RPC Infrastructure
- Use the connection from `useWallet()` context (like other components do)
- Leverage the RPC switcher utility (`src/utils/rpc-switcher.ts`)
- Follow the pattern from `useBucketBalances.ts` for connection handling

### 2. Conservative Approach
- Implement caching with longer duration (like 10-15 minutes)
- Use smaller batch sizes for transaction fetching
- Add proper error handling with exponential backoff

### 3. Alternative Approaches to Consider
- **Option A**: Only show current balances (what we do now) - simplest and most reliable
- **Option B**: Use a blockchain indexer service (Helius, QuickNode, etc.) for historical data
- **Option C**: Implement proper event parsing with the existing RPC infrastructure
- **Option D**: Add a backend service that indexes events and provides an API

### 4. Event Parsing Challenges
- Anchor events in transaction logs need proper decoding
- Need to handle different transaction versions
- Event data is base64 encoded and requires proper deserialization
- **Profile data limitations**: Cumulative totals don't provide enough detail for accurate history reconstruction

## Recommended Next Steps
1. **Short term**: Keep current balance display only (what we have now) - this is actually the most accurate approach
2. **Medium term**: Only implement withdrawal history if we can parse actual `AffiliateEarningsWithdrawalEvent` events from blockchain
3. **Long term**: Consider a proper indexing solution that tracks both earnings crediting AND withdrawal events
4. **Important**: Do NOT attempt to estimate/reconstruct history from profile totals - this leads to inaccurate data

## Files Affected
- `src/components/EarningsHistoryCard.tsx` - Component (currently unused)
- `src/services/affiliate/earnings-history-service.ts` - Service (needs rewrite)
- `src/pages/Dapp/Affiliate/index.tsx` - Page (card commented out)

## Key Learnings for Future Implementation
- Always use the existing wallet connection and RPC infrastructure
- Follow the established patterns in the codebase
- Test with rate limiting in mind
- Consider user experience - current balance is more important than history