# Backend RPC Configuration Guide

## Overview

The backend uses a simple RPC failover system to ensure reliability when connecting to the Solana blockchain.

## Environment Variables

### Network Selection

```bash
# Determines which Solana network to use
SOLANA_CLUSTER=devnet  # Options: devnet, mainnet-beta
```

### RPC Endpoints

**Railway-Friendly Configuration** (separate variables for each endpoint):

#### Devnet (Development/Testing)
```bash
# Primary devnet endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com

# Additional devnet endpoints (optional, for failover)
SOLANA_RPC_URL_DEVNET_1=https://api.devnet.solana.com
SOLANA_RPC_URL_DEVNET_2=https://devnet.helius.xyz
SOLANA_RPC_URL_DEVNET_3=https://rpc.ankr.com/solana_devnet
# ... up to _DEVNET_5
```

#### Mainnet (Production)
```bash
# Primary mainnet endpoint (use paid RPC for production!)
SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Additional mainnet endpoints (optional, for failover)
SOLANA_RPC_URL_MAINNET_1=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
SOLANA_RPC_URL_MAINNET_2=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
SOLANA_RPC_URL_MAINNET_3=https://solana-mainnet.core.chainstack.com/YOUR_API_KEY
SOLANA_RPC_URL_MAINNET_4=https://rpc.ankr.com/solana
# ... up to _MAINNET_5
```

## How It Works

### RPC Manager Features

1. **Automatic Failover**: If one RPC fails, automatically tries the next endpoint
2. **Retry Mechanism**: 3 attempts across different endpoints before failing
3. **Round-Robin**: Cycles through available endpoints to distribute load
4. **Network-Aware**: Separate endpoint pools for devnet and mainnet
5. **Fallback**: Always falls back to public Solana Labs endpoints

### Failure Detection

The RPC manager automatically retries on these errors:
- HTTP 429 (Rate limit exceeded)
- HTTP 503/504 (Service unavailable)
- Network timeouts
- Connection resets
- Fetch failures

### Usage in Code

```typescript
import { getConnection, retryOperation } from './lib/rpc-manager'

// Simple connection
const connection = getConnection()
const info = await connection.getAccountInfo(publicKey)

// With automatic retry
const info = await retryOperation(
  async (connection) => connection.getAccountInfo(publicKey),
  'getAccountInfo'
)
```

## Railway Configuration

### Single RPC (Minimum)
```bash
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Multiple RPCs (Recommended for Production)
```bash
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL_MAINNET_1=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
SOLANA_RPC_URL_MAINNET_2=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_RPC_URL_MAINNET_3=https://rpc.ankr.com/solana
```

**Note:** Railway handles separate variables much better than comma-separated values.

## Recommended RPC Providers

### Free/Public (Good for Development)
- Solana Labs: `https://api.devnet.solana.com`
- Ankr: `https://rpc.ankr.com/solana_devnet`

### Paid (Recommended for Production)
- **Helius** (Best for Solana): https://helius.xyz
- **QuickNode**: https://quicknode.com
- **Alchemy**: https://alchemy.com
- **Chainstack**: https://chainstack.com

### Why Paid RPCs for Production?
- Higher rate limits (vs 100 req/10s for public)
- Better reliability and uptime
- Faster response times
- Priority support
- WebSocket support
- Historical data access

## Monitoring

The RPC manager logs all operations:
```
🌐 Backend RPC Manager initialized for devnet
📡 devnet RPC endpoints configured: 2
  1. Devnet RPC 1: https://api.devnet.solana.com
  2. Devnet RPC 2: https://devnet.helius.xyz
🔗 Using Devnet RPC 1 for devnet
```

On failure:
```
⚠️ getAccountInfo failed on attempt 1/3: Error: 429 Too Many Requests
🔄 Switched to Devnet RPC 2
✅ getAccountInfo succeeded on attempt 2
```

## Troubleshooting

### All RPCs Failing
1. Check network connectivity
2. Verify RPC URLs are correct
3. Check for rate limiting (use paid RPCs)
4. Verify cluster setting matches your program deployment

### Backend Not Starting
1. Check logs for RPC manager initialization messages
2. Verify at least one RPC URL is configured
3. Test RPC URLs manually with curl

### Performance Issues
1. Add more RPC endpoints to distribute load
2. Upgrade to paid RPC providers
3. Check RPC provider status pages
4. Monitor rate limits in logs

## Best Practices

1. **Always configure multiple RPCs** for production
2. **Use paid RPCs** for mainnet deployments
3. **Keep devnet on public RPCs** (sufficient for development)
4. **Monitor logs** for RPC switching patterns
5. **Test failover** by temporarily using invalid first endpoint

