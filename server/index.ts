/**
 * Server entrypoint: Express server for API and static frontend
 * Purpose: Monolithic server serving both REST API and static frontend
 */
import 'dotenv/config'
import express, { Request, Response } from 'express'
import { serveStatic, log as viteProdLog } from './vite-prod'
import transactionsRouter from './routes/transactions'
import authRouter from './routes/auth'
import { requireAuth } from './middleware/auth'
import tiersRouter from './routes/tiers'
import settingsRouter from './routes/settings'
import licenseRouter from './routes/license'
import affiliateRouter from './routes/affiliate'
import withdrawalsRouter from './routes/withdrawals'
import { pingAllRpcEndpoints } from './lib/rpc-manager'
import { getAuthorityPublicKeyBase58 } from './lib/authority'
import agentsRouter from './routes/agents'
import adminRouter from './routes/admin'
import rpcRouter from './routes/rpc'
import unclaimedRouter from './routes/unclaimed'
import { runDailyAgentEarnings } from './services/agent_results'

const app = express()
app.use(express.json())

// Production static serving flag
const isProduction = process.env.NODE_ENV === 'production';

// Development CORS: allow frontend dev server origin when running separately
// In production, frontend is served from same origin and CORS is not needed
if (!isProduction) {
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:8080'
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin)
    res.header('Vary', 'Origin')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-User-Agent, X-App-Version, X-Request-ID'
    )
    res.header('Access-Control-Allow-Credentials', 'true')
    if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }
    next()
  })
}

// Healthcheck
app.get('/health', (req: Request, res: Response) => res.json({ ok: true }))

// Authority verification (safe): returns backend authority public key
app.get('/api/_authority', (_req: Request, res: Response) => {
  try {
    const pubkey = getAuthorityPublicKeyBase58()
    return res.json({ authority: pubkey })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
})

// API routes
app.use('/api', authRouter)
app.use('/api', tiersRouter)
app.use('/api', settingsRouter)
app.use('/api', requireAuth, transactionsRouter)
app.use('/api', requireAuth, licenseRouter)
app.use('/api', requireAuth, affiliateRouter)
app.use('/api', requireAuth, withdrawalsRouter)
app.use('/api', requireAuth, agentsRouter)
app.use('/api', requireAuth, adminRouter)
app.use('/api', requireAuth, rpcRouter)
app.use('/api', requireAuth, unclaimedRouter)

// Secured cron trigger (optional): requires X-Cron-Secret header matching env CRON_SECRET
app.post('/api/cron/agents/daily', async (req: Request, res: Response) => {
  const secret = req.header('X-Cron-Secret') || req.header('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const out = await runDailyAgentEarnings()
    res.json({ ok: true, ...out })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

// Start server
const port = Number(process.env.PORT || 4000)

async function startServer() {
  // Serve static frontend in production
  if (isProduction) {
    serveStatic(app);
    viteProdLog("Serving static frontend from /dist");
  }

  app.listen(port, '0.0.0.0', () => {
    const mode = isProduction ? 'production' : 'development';
    console.log(`[${mode}] Server listening on port ${port}`)
    if (isProduction) {
      console.log(`Frontend served at http://localhost:${port}`)
    }
    console.log(`API available at http://localhost:${port}/api`)
    setTimeout(() => { pingAllRpcEndpoints().catch(() => { }) }, 5000)
    setInterval(() => { pingAllRpcEndpoints().catch(() => { }) }, 24 * 60 * 60 * 1000)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
