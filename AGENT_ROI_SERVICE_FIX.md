# Agent ROI Service Fix - Debug Mode Timing

## Issue Found
The agent ROI withdrawal was still failing with "Must wait 24 hours after activation" even after fixing the UI timing, because the **agent-roi-service** was still using hardcoded timing validation.

## Root Cause
The `withdrawAgentRoi` function was calling `canWithdrawRoi(agentData.accountData)` without passing the contract timing parameter, so it defaulted to 86400 seconds (24 hours) instead of using the debug mode timing (300 seconds).

## Files Fixed

### 1. Agent ROI Service (`src/services/agent/agent-roi-service.ts`)
**Problem**: Hardcoded timing validation
```typescript
// BEFORE: Used default 24-hour timing
const withdrawalCheck = canWithdrawRoi(agentData.accountData);

// AFTER: Uses contract timing (5 minutes in debug mode)
const secondsPerDay = await getContractSecondsPerDay(connection);
const withdrawalCheck = canWithdrawRoi(agentData.accountData, Math.floor(Date.now() / 1000), secondsPerDay);
```

### 2. Withdrawal Validation Utils (`src/components/agent/withdrawal-validation-utils.ts`)
**Problem**: Hardcoded "24 hours" in error messages
```typescript
// BEFORE: Hardcoded timing in messages
'New agents must wait 24 hours after activation before the first ROI withdrawal.'
'Each agent has a 24-hour cooldown between ROI withdrawals.'

// AFTER: Generic timing messages
'New agents must wait for the activation delay before the first ROI withdrawal.'
'Each agent has a cooldown period between ROI withdrawals.'
```

### 3. Withdrawal Validation Feedback (`src/components/agent/WithdrawalValidationFeedback.tsx`)
**Problem**: Hardcoded "24 hours" in UI messages
```typescript
// BEFORE: Hardcoded timing in UI
'New agents must wait 24 hours after activation before the first ROI withdrawal.'
'Withdrawal too early - 24 hour activation delay required'

// AFTER: Generic timing messages
'New agents must wait for the activation delay before the first ROI withdrawal.'
'Withdrawal too early - activation delay required'
```

## Key Changes

### Contract Timing Integration
- Added `getContractSecondsPerDay(connection)` call to get actual contract timing
- Pass timing parameter to `canWithdrawRoi` function
- Log the timing being used for debugging

### Dynamic Error Messages
- Removed hardcoded "24 hours" from all error messages
- Made messages generic so they work for both debug (5 minutes) and production (24 hours) modes
- Timer components still show the exact countdown with correct timing

## Testing Results

### Before Fix
```
❌ Error: Must wait 24 hours after activation
❌ Agent ROI withdrawal failed: Error: Must wait 24 hours after activation
```

### After Fix (Debug Mode)
```
✅ Using contract timing: 300 seconds per day
✅ Agent withdrawal timing check passed
✅ Withdrawal successful after 5 minutes
```

## Debug Mode Flow (Fixed)
1. **Agent activated**: 12:00:00 PM
2. **Contract timing detected**: 300 seconds (5 minutes)
3. **UI shows countdown**: "4m 59s remaining"
4. **Withdrawal button active**: 12:05:00 PM
5. **Withdrawal succeeds**: No more "24 hours" errors

The agent ROI service now correctly uses the contract's debug timing instead of hardcoded 24-hour validation! 🎉