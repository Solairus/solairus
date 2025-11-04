/**
 * Backend entrypoint: Express server wiring
 * Purpose: Expose REST API for transaction tracking
 */
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
import { getAuthorityPublicKeyBase58 } from './lib/authority'
import agentsRouter from './routes/agents'

const app = express()
app.use(express.json())

// CORS headers for local dev and Railway
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:8080'
  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, X-User-Agent, X-App-Version, X-Request-ID, Accept'
  )
  res.header('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

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

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  console.log(`[solairus-backend] listening on port ${port}`)
})