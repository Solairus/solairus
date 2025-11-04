/**
 * Server entrypoint: Express server for API and static frontend
 * Purpose: Monolithic server serving both REST API and static frontend
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

// Production static serving flag
const isProduction = process.env.NODE_ENV === 'production';

// CORS is no longer needed - frontend served from same origin in production
// In development, run separate dev servers (vite + tsx server/index.ts)

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

// Start server
const port = Number(process.env.PORT || 4000)

async function startServer() {
  // Serve static frontend in production
  if (isProduction) {
    const { serveStatic, log } = require('./vite-prod');
    serveStatic(app);
    log("Serving static frontend from /dist");
  }

  app.listen(port, '0.0.0.0', () => {
    const mode = isProduction ? 'production' : 'development';
    console.log(`[${mode}] Server listening on port ${port}`)
    if (isProduction) {
      console.log(`Frontend served at http://localhost:${port}`)
    }
    console.log(`API available at http://localhost:${port}/api`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})