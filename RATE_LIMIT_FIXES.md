# Rate Limit Prevention Fixes

## 🚫 Disabled Aggressive Polling/Retries

### **1. Bucket Balances Auto-Refresh**
- **File**: `src/hooks/useBucketBalances.ts`
- **Disabled**: 30-second auto-refresh interval
- **Impact**: Users must manually refresh bucket balances

### **2. Live ROI Service Polling**
- **File**: `src/services/agent/live-roi-service.ts`
- **Disabled**: Automatic ROI updates via setInterval
- **Impact**: ROI data only updates on manual refresh

### **3. Profile Health Monitoring**
- **File**: `src/services/profile/profile-monitoring.ts`
- **Disabled**: 5-minute health check intervals
- **Impact**: No automatic profile health monitoring

### **4. License Service Retries**
- **File**: `src/services/license/license-service.ts`
- **Disabled**: Automatic retry mechanisms with delays
- **Impact**: License operations fail fast, user controls retries

### **5. Price Polling**
- **File**: `src/components/AgentsOutcomesCard.tsx`
- **Disabled**: 10-second price update intervals
- **Impact**: Prices only update on page load/manual refresh

## ✅ Smart RPC Switching Added

### **1. RPC Connection Manager**
- **File**: `src/utils/rpc-connection-manager.ts`
- **Feature**: Switches RPC endpoints on 403/429/plan upgrade errors
- **No Retries**: Just switches endpoint, user controls retry

### **2. Agent Dashboard RPC Handling**
- **File**: `src/components/agent/AgentDashboard.tsx`
- **Feature**: Detects RPC errors and switches endpoints
- **User Message**: "RPC endpoint issue detected. Please try again - we've switched to a different server."

## 🎯 Result

- **No automatic retries** - All retries are user-controlled
- **No polling intervals** - All data updates are manual
- **Smart RPC switching** - Automatically uses next endpoint on failures
- **Cost efficient** - Minimal RPC calls, no rate limit exhaustion

## 🔧 Available RPC Endpoints

From `.env`:
1. `VITE_SOLANA_RPC_URL_MAINNET` - Chainstack (primary)
2. `VITE_SOLANA_RPC_URL_MAINNET_2` - Alchemy
3. `VITE_SOLANA_RPC_URL_MAINNET_3` - Solana Labs Official
4. `VITE_SOLANA_RPC_URL_MAINNET_4` - Project Serum

System will cycle through these endpoints when rate limits are hit.