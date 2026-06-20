import { Router, Request, Response } from 'express'
import { Connection } from '@solana/web3.js'
import { getRpcManager } from '../lib/rpc-manager'

const router = Router()

// Collects the base key plus _0.._9 suffixed variants.
function collectEnvUrls(prefix: string): string[] {
  const urls: string[] = []
  const direct = process.env[prefix]
  if (direct) urls.push(direct)
  for (let i = 0; i <= 9; i++) {
    const v = process.env[`${prefix}_${i}`]
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
  // Mainnet only. Frontend URLs are pinged client-side by the browser (the only
  // place VITE_* vars and the browser's own connectivity exist), so the server
  // only checks its own backend RPC endpoints here.
  const backendUrls = Array.from(new Set(collectEnvUrls('SOLANA_RPC_URL_MAINNET'))).filter(Boolean)
  const backend = await Promise.all(backendUrls.map(ping))
  res.json({ backend })
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
