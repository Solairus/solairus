import { Router, Request, Response } from 'express'
import { Connection } from '@solana/web3.js'
import { getRpcManager } from '../lib/rpc-manager'

const router = Router()

function collectEnvUrls(prefix: string): string[] {
  const urls: string[] = []
  const direct = process.env[prefix]
  if (direct) urls.push(direct)
  for (let i = 2; i <= 5; i++) {
    const k = `${prefix}_${i}`
    const v = process.env[k]
    if (v) urls.push(v)
  }
  return urls
}

async function ping(url: string) {
  try {
    const conn = new Connection(url, 'confirmed')
    const v = await conn.getVersion()
    return { url, ok: true, version: v['solana-core'] || String(v) }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)) || 'unknown'
    return { url, ok: false, error: msg }
  }
}

router.get('/rpc/health', async (_req: Request, res: Response) => {
  const frontendUrls = [
    ...collectEnvUrls('VITE_SOLANA_RPC_URL_MAINNET'),
    ...collectEnvUrls('VITE_SOLANA_RPC_URL_DEVNET'),
    ...collectEnvUrls('VITE_SOLANA_RPC_URL_TESTNET'),
  ]
  const backendUrls = [
    ...collectEnvUrls('SOLANA_RPC_URL_MAINNET'),
    ...collectEnvUrls('SOLANA_RPC_URL_DEVNET'),
    ...collectEnvUrls('SOLANA_RPC_URL_TESTNET'),
  ]

  const uniqueFrontend = Array.from(new Set(frontendUrls)).filter(Boolean)
  const uniqueBackend = Array.from(new Set(backendUrls)).filter(Boolean)

  const frontResults = await Promise.all(uniqueFrontend.map(ping))
  const backResults = await Promise.all(uniqueBackend.map(ping))

  res.json({ frontend: frontResults, backend: backResults })
})

export default router

// Status: current backend RPC endpoint in use
router.get('/rpc/status', (_req: Request, res: Response) => {
  const mgr = getRpcManager()
  const current = mgr.getCurrentEndpoint()
  // Note: returns only cluster-visible info; does not modify state
  res.json({
    cluster: mgr.getCluster(),
    currentEndpoint: current,
    // For safety we don’t enumerate secrets; health route already pings configured URLs
    fallbackPolicy: 'single-fallback-on-explicit-error',
  })
})
