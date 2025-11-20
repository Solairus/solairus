import { useEffect, useMemo, useState } from 'react'
import { Connection } from '@solana/web3.js'
import { API_CONFIG, ApiClient } from '@/config/service-endpoints'

type Result = { url: string; ok: boolean; error?: string }

function getFrontendRpcUrls(): string[] {
  const keys = [
    'VITE_SOLANA_RPC_URL_MAINNET', 'VITE_SOLANA_RPC_URL_MAINNET_2', 'VITE_SOLANA_RPC_URL_MAINNET_3', 'VITE_SOLANA_RPC_URL_MAINNET_4', 'VITE_SOLANA_RPC_URL_MAINNET_5',
    'VITE_SOLANA_RPC_URL_DEVNET', 'VITE_SOLANA_RPC_URL_DEVNET_2', 'VITE_SOLANA_RPC_URL_DEVNET_3',
    'VITE_SOLANA_RPC_URL_TESTNET', 'VITE_SOLANA_RPC_URL_TESTNET_2', 'VITE_SOLANA_RPC_URL_TESTNET_3',
  ]
  const urls = keys.map(k => (import.meta.env as any)[k]).filter(Boolean)
  return Array.from(new Set(urls))
}

function normalizeUrl(u: string): string { return u.endsWith('/') ? u : `${u}/` }

function isCuExpiredReason(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('cu') || m.includes('compute') || m.includes('insufficient')
}

export default function DappSpecial() {
  const [frontendResults, setFrontendResults] = useState<Result[]>([])
  const [backendResults, setBackendResults] = useState<Result[]>([])
  const [running, setRunning] = useState(false)
  const urls = useMemo(getFrontendRpcUrls, [])

  const runOnce = async () => {
    if (running) return
    setRunning(true)
    const now = Date.now()
    localStorage.setItem('rpcHealthLastRunAt', String(now))

    const front = await Promise.all(urls.map(async (u) => {
      try {
        const conn = new Connection(normalizeUrl(u), 'confirmed')
        await conn.getLatestBlockhash()
        return { url: u, ok: true } as Result
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (isCuExpiredReason(msg)) {
          const blacklist = JSON.parse(localStorage.getItem('rpcExpiredUntil') || '{}')
          blacklist[u] = now + 24 * 60 * 60 * 1000
          localStorage.setItem('rpcExpiredUntil', JSON.stringify(blacklist))
        }
        return { url: u, ok: false, error: msg } as Result
      }
    }))
    setFrontendResults(front)

    try {
      const resp = await ApiClient.get(`${API_CONFIG.getBaseUrl()}/rpc/health`)
      const data = await resp.json()
      const back = (data?.backend || []).map((r: any) => ({ url: r.url, ok: !!r.ok, error: r.error })) as Result[]
      setBackendResults(back)
    } catch (e) {
      setBackendResults(urls.map(u => ({ url: u, ok: false, error: 'backend health route error' })))
    }
    setRunning(false)
  }

  useEffect(() => {
    const lastStr = localStorage.getItem('rpcHealthLastRunAt')
    const last = lastStr ? Number(lastStr) : 0
    if (!last || (Date.now() - last) > 60 * 60 * 1000) {
      runOnce()
    }
  }, [])

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">RPC Health Check</h2>
      <button
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        disabled={running}
        onClick={runOnce}
      >{running ? 'Checking…' : 'Run Health Check'}</button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium">Frontend RPCs</h3>
          <ul className="mt-2 space-y-1">
            {urls.map(u => {
              const r = frontendResults.find(x => x.url === u)
              const status = r ? (r.ok ? 'OK' : `ERR: ${r.error?.slice(0,120)}`) : '—'
              return <li key={u} className="text-sm">{u} → {status}</li>
            })}
          </ul>
        </div>
        <div>
          <h3 className="font-medium">Backend RPCs</h3>
          <ul className="mt-2 space-y-1">
            {backendResults.map(r => (
              <li key={r.url} className="text-sm">{r.url} → {r.ok ? 'OK' : `ERR: ${r.error?.slice(0,120)}`}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}