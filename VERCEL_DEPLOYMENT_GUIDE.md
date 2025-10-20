# Vercel Deployment Guide

## Environment Variable Configuration Issues & Solutions

### Problem
Your app works locally but fails on Vercel with these errors:
- `AppKitProvider: Failed to initialize AppKit: TypeError: s.initialize is not a function`
- `POST https://api.mainnet-beta.solana.com/ 403 (Forbidden)`

### Root Causes
1. **Comma-separated environment variables** don't parse correctly on Vercel
2. **Long environment variable values** may be truncated
3. **RPC rate limiting** on public endpoints
4. **Environment variable character limits** on Vercel

### Solutions

#### 1. Environment Variable Format
Instead of using comma-separated values in single variables:

❌ **Don't do this:**
```env
VITE_WALLETCONNECT_PROJECT_ID=id1,id2,id3,id4,id5,id6,id7,id8,id9,id10,id11,id12,id13
VITE_SOLANA_RPC_URL_MAINNET=url1,url2,url3,url4
```

✅ **Do this instead:**
```env
# Primary values
VITE_WALLETCONNECT_PROJECT_ID=f12eb32ab1253eaf43b4473befef05fc
VITE_SOLANA_RPC_URL_MAINNET=https://solana-mainnet.core.chainstack.com/31b504e5061038deb849fef18ca51009

# Fallback values (separate variables)
VITE_WALLETCONNECT_PROJECT_ID_2=333a77e27a636843e26cf8c97dce49f7
VITE_WALLETCONNECT_PROJECT_ID_3=ab5c3658066a17e831dc057e14683908
VITE_SOLANA_RPC_URL_MAINNET_2=https://solana-mainnet.g.alchemy.com/v2/NTfRANLBBSl4wOmIIX3Xc
VITE_SOLANA_RPC_URL_MAINNET_3=https://api.mainnet-beta.solana.com
```

#### 2. Vercel Environment Variable Setup

1. **Go to your Vercel project dashboard**
2. **Navigate to Settings → Environment Variables**
3. **Add each variable individually:**

**Required Variables:**
```
VITE_SOLANA_CLUSTER=mainnet-beta
VITE_SOLAIRUS_MAIN_PROGRAM_ID=EeyQpZxE1KqmsAinGaJf7kcTGVAHXu2KT2AzepwYRysf
VITE_DEFAULT_SPONSOR_ADDRESS=4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez
VITE_ENABLE_WALLET_GUARD=true
VITE_ENABLE_LICENSE_GUARD=true
```

**WalletConnect Project IDs:**
```
VITE_WALLETCONNECT_PROJECT_ID=f12eb32ab1253eaf43b4473befef05fc
VITE_WALLETCONNECT_PROJECT_ID_2=333a77e27a636843e26cf8c97dce49f7
VITE_WALLETCONNECT_PROJECT_ID_3=ab5c3658066a17e831dc057e14683908
VITE_WALLETCONNECT_PROJECT_ID_4=bdd4a1047bbe7c091d2e174b02677f82
```

**RPC URLs (use your premium endpoints first):**
```
VITE_SOLANA_RPC_URL_MAINNET=https://solana-mainnet.core.chainstack.com/31b504e5061038deb849fef18ca51009
VITE_SOLANA_RPC_URL_MAINNET_2=https://solana-mainnet.g.alchemy.com/v2/NTfRANLBBSl4wOmIIX3Xc
VITE_SOLANA_RPC_URL_MAINNET_3=https://api.mainnet-beta.solana.com
VITE_SOLANA_RPC_URL_MAINNET_4=https://solana-api.projectserum.com
```

#### 3. RPC Endpoint Recommendations

**Priority Order (use premium endpoints first):**
1. **Chainstack** (your current primary) - has API key, should work well
2. **Alchemy** (your current secondary) - has API key, reliable
3. **Solana Labs Official** - public, rate limited but stable
4. **Project Serum** - public, backup option

**Avoid these issues:**
- Don't put `api.mainnet-beta.solana.com` first (gets rate limited quickly)
- Use your premium endpoints (Chainstack, Alchemy) as primary
- Keep public endpoints as fallbacks only

#### 4. Deployment Steps

1. **Update your environment variables in Vercel dashboard**
2. **Redeploy your application:**
   ```bash
   # Trigger a new deployment
   git add .
   git commit -m "Fix environment variables for Vercel"
   git push origin main
   ```
3. **Monitor the build logs** for any environment variable issues
4. **Test the deployed app** and check browser console for errors

#### 5. Debugging

**Check if environment variables are loaded correctly:**
1. Open browser console on your deployed app
2. Look for these log messages:
   - `✅ Found X WalletConnect project ID(s)`
   - `✅ Found X Solana RPC URL(s)`
   - `🔗 Initializing AppKit with project IDs...`
   - `✅ AppKit initialized successfully`

**If you see errors:**
- `❌ Environment validation failed` - Check your Vercel environment variables
- `No WalletConnect project IDs found` - Add the project ID variables
- `403 Forbidden` from RPC - Your primary RPC endpoint is rate limited, check order

#### 6. Testing Locally

To test the new environment variable format locally:

1. **Backup your current .env:**
   ```bash
   cp .env .env.backup
   ```

2. **Use the new format:**
   ```bash
   cp .env.production .env
   ```

3. **Test locally:**
   ```bash
   npm run dev
   ```

4. **Verify it works, then deploy**

### Expected Results

After implementing these changes:
- ✅ AppKit should initialize without errors
- ✅ Wallet connections should work properly  
- ✅ RPC calls should succeed (using your premium endpoints first)
- ✅ No more 403 errors from rate-limited public RPCs
- ✅ Environment variables should load correctly on Vercel

### Monitoring

After deployment, monitor:
1. **Vercel Function Logs** - for any runtime errors
2. **Browser Console** - for client-side initialization issues
3. **Network Tab** - for failed RPC requests
4. **WalletConnect Analytics** - for connection success rates

If you still see issues after implementing these changes, the problem may be with specific WalletConnect project IDs or RPC endpoints being blocked/rate-limited.