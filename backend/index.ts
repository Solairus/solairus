import 'dotenv/config'
import express, { Request, Response } from 'express'
import transactionsRouter from './routes/transactions'
import authRouter from './routes/auth'
import { requireAuth } from './middleware/auth'
import tiersRouter from './routes/tiers'
import settingsRouter from './routes/settings'
import licenseRouter from './routes/license'
import affiliateRouter from './routes/affiliate'
import withdrawalsRouter from './routes/withdrawals'
import { pingAllRpcEndpoints } from './lib/rpc-manager'
import { getTreasuryAddress } from './lib/hd-wallet'
import agentsRouter from './routes/agents'
import adminRouter from './routes/admin'
import rpcRouter from './routes/rpc'
import unclaimedRouter from './routes/unclaimed'
import ordersRouter from './routes/orders'
import { startOrderMonitor } from './services/order-monitor'
import { runDailyAgentEarnings } from './services/agent_results'

const app = express()
app.use(express.json())

// CORS — allow frontend origin in all environments (frontend is now a separate service)
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

// Healthcheck
app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }))

// Authority verification: returns backend authority public key
app.get('/api/_authority', (_req: Request, res: Response) => {
  try {
    const pubkey = getTreasuryAddress()
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
app.use('/api', requireAuth, ordersRouter)
app.use('/api', requireAuth, adminRouter)
app.use('/api', requireAuth, rpcRouter)
app.use('/api', requireAuth, unclaimedRouter)

// Cron trigger — requires X-Cron-Secret header
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

const port = Number(process.env.PORT || 4000)

async function startServer() {
  app.listen(port, '0.0.0.0', () => {
    console.log(`[API] Listening on port ${port}`)
    console.log(`[API] CORS origin: ${allowedOrigin}`)
    setTimeout(() => { pingAllRpcEndpoints().catch(() => { }) }, 5000)
    setInterval(() => { pingAllRpcEndpoints().catch(() => { }) }, 24 * 60 * 60 * 1000)
    startOrderMonitor()

    // Daily agent-yield scheduler. Runs hourly (idempotent: one result per agent per
    // UTC day + 24h cooldown), so each active agent is credited shortly after it becomes
    // eligible without depending on an external cron or a user loading the agents page.
    const runEarnings = () => runDailyAgentEarnings()
      .then((r) => console.log(`[earnings-cron] processed=${r.processed} credited=${r.credited} skipped=${r.skipped}`))
      .catch((e) => console.error('[earnings-cron] failed:', e instanceof Error ? e.message : e))
    setTimeout(runEarnings, 20000)
    setInterval(runEarnings, 60 * 60 * 1000)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
