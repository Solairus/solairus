# Railway Deployment Guide

This project is deployed as a **monolithic service** - a single Express server that serves both the API and the built frontend.

## Overview
- **Architecture**: Monolithic (single service)
- **Frontend**: Built with Vite, served as static files by Express
- **Backend**: Express server exposes `/api` routes and serves static frontend
- **Benefits**: Lower cost (1 instance), no CORS complexity, same-origin requests

## Deployment Setup

### 1) Create PostgreSQL Database
In Railway dashboard:
1. Click "New" → "Database" → "PostgreSQL"
2. Wait for provisioning (~2 minutes)
3. Copy the `DATABASE_URL` connection string

### 2) Create Application Service
In Railway dashboard:
1. Click "New" → "GitHub Repo" → Select your Solairus repository
2. Configure the service:
   - **Root Directory**: `/` (repository root)
   - **Build Command**: `yarn install && yarn build`
   - **Start Command**: `yarn start`

### 3) Configure Environment Variables
Set these in Railway → Variables tab:

**Required:**
```bash
NODE_ENV=production
DATABASE_URL=<Railway Postgres URL>
JWT_SECRET=<generate a strong random secret>
SOLANA_RPC_URL=https://api.devnet.solana.com
```

**Optional (Solana configuration):**
```bash
VITE_SOLANA_CLUSTER=devnet
VITE_PROGRAM_ID=<your-program-id>
VITE_USDT_MINT=<usdt-mint-address>
# Add other VITE_ variables as needed for your deployment
```

**Note:** 
- CORS configuration is **not needed** (same-origin serving)
- `VITE_API_BASE_URL` is **not needed** (defaults to `/api`)
- Railway automatically sets `PORT` environment variable

## How It Works

### Development Mode
Run frontend and backend separately:
```bash
# Terminal 1: Frontend dev server (port 8080)
yarn dev

# Terminal 2: Backend dev server (port 4000)
yarn dev:server
```
Frontend points to `http://localhost:4000/api` for API calls.

### Production Mode
Single server serves everything:
```bash
yarn build  # Builds frontend + compiles backend
yarn start  # Starts Express server
```
- Express serves static files from `/dist`
- API available at `/api/*`
- Frontend available at `/`
- All requests are same-origin (no CORS needed)

## Verification

After deployment:

1. **Check Health Endpoint**
   ```bash
   curl https://your-app.railway.app/health
   # Should return: {"ok":true}
   ```

2. **Check Frontend**
   - Open `https://your-app.railway.app` in browser
   - Should see SOLAIRUS landing page
   - Connect wallet and test functionality

3. **Check API**
   ```bash
   curl https://your-app.railway.app/api/_authority
   # Should return backend authority public key
   ```

4. **Monitor Logs**
   - Railway Dashboard → Deployments → View Logs
   - Look for: `[production] Server listening on port XXXX`
   - Look for: `Serving static frontend from /dist`

## Database Migrations

After first deployment, run migrations:
```bash
# Via Railway CLI
railway run yarn migrate

# Or connect to the service and run manually
```

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Ensure all dependencies are in `package.json`
- Verify `build` script runs locally

### Frontend Not Loading
- Verify `dist/` directory was created during build
- Check that `index.html` exists in `dist/`
- Review server logs for static file serving message

### API Not Working
- Check environment variables are set correctly
- Verify `DATABASE_URL` format and connectivity
- Check JWT_SECRET is set
- Review API logs for specific errors

### Port Issues
- Railway auto-assigns `PORT` - don't hardcode
- Server listens on `process.env.PORT || 4000`

## Cost Comparison

**Before (Microservices):**
- Frontend Service: $5-10/month
- Backend Service: $5-10/month
- **Total: $10-20/month**

**After (Monolithic):**
- Single Service: $5-10/month
- **Total: $5-10/month**

**Savings: 50% reduction in deployment costs**

## Migration Notes

This project was converted from a microservices architecture to monolithic:
- Old structure: Separate `/backend` directory with own `package.json`
- New structure: `/server` directory, unified `package.json`
- CORS middleware removed (no longer needed)
- All dependencies merged into root `package.json`

For reference, see commit: "Convert to monolithic architecture"