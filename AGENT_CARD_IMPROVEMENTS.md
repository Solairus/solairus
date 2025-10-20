# Agent Card UI Improvements

## ✅ **Improvements Implemented**

### 1. Tooltip for Withdrawal Cooldown Notice
**Problem**: Withdrawal cooldown notice was prominently displayed, taking up space
**Solution**: Moved to a tooltip next to the countdown timer

**Before**:
```
Withdrawal Cooldown
Each agent has a cooldown period between ROI withdrawals.
[Large notice taking up card space]
```

**After**:
```
[Countdown Timer] ℹ️  <- Hover for cooldown info
[Clean, minimal display]
```

**Implementation**:
- Added `Info` icon next to withdrawal timer
- Tooltip shows context-aware message:
  - New agents: "New agents must wait for the activation delay before the first ROI withdrawal."
  - Existing agents: "Each agent has a cooldown period between ROI withdrawals."
- Only shows when agent cannot withdraw (not for retired agents)

### 2. Live ROI Display
**Problem**: No real-time indication of withdrawable ROI amount
**Solution**: Added live ROI calculation updated every minute

**Features**:
- **Real-time calculation**: Based on on-chain agent data
- **Contract timing aware**: Uses actual SECONDS_PER_DAY (5 min debug / 24 hr production)
- **Efficient updates**: Refreshes every 60 seconds to avoid rate limiting
- **Visual indicator**: Green badge showing available amount

**Display**:
```
💰 $12.45 Available
[When ROI is ready to withdraw]
```

## 🔧 **Technical Implementation**

### Live ROI Service (`src/services/agent/live-roi-service.ts`)
```typescript
// Calculates withdrawable ROI based on:
// - Agent activation data from contract
// - Contract timing (debug vs production)
// - Tier yield rates (min/max average)
// - Elapsed time since last withdrawal

export function useLiveRoi(connection, userPublicKey, activationId, refreshInterval = 60000)
```

### Agent Card Updates (`src/components/agent/AgentCard.tsx`)
```typescript
// Added live ROI hook
const { liveRoi } = useLiveRoi(connection, userPublicKey, activationId, 60000);

// Live ROI display (when available)
{liveRoi && liveRoi.currentWithdrawableAmount > 0 && (
  <div className="text-green-400 bg-green-500/10">
    💰 ${liveRoi.currentWithdrawableAmount.toFixed(2)} Available
  </div>
)}

// Tooltip for cooldown info
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger><Info icon /></TooltipTrigger>
    <TooltipContent>Cooldown explanation</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## 🎯 **User Experience Improvements**

### Before
- ❌ Large cooldown notice taking up space
- ❌ No indication of current withdrawable amount
- ❌ Static display, no real-time updates

### After
- ✅ Clean, minimal card layout
- ✅ Tooltip provides info on demand
- ✅ Live ROI amount prominently displayed
- ✅ Updates every minute automatically
- ✅ Works with both debug (5 min) and production (24 hr) timing

## 🧪 **Debug Mode Testing**

### Expected Behavior
1. **Agent activated**: Live ROI starts at $0.00
2. **After 5 minutes**: Live ROI shows calculated amount (e.g., $2.50)
3. **Display updates**: "💰 $2.50 Available" appears
4. **After withdrawal**: ROI resets, countdown restarts
5. **Tooltip**: Shows appropriate cooldown message

### Live ROI Calculation
```
Daily ROI = (Investment × Average Yield Rate) / 10000
Example: ($100 × 137.5 bps) / 10000 = $1.375 per day
Debug mode: Updates every 5 minutes instead of 24 hours
```

The agent cards now provide a much cleaner, more informative experience with real-time ROI tracking! 🎉