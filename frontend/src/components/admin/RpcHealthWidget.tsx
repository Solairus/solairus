import { useEffect, useState } from 'react'
import { API_CONFIG, ApiClient } from '@/config/service-endpoints'

type Result = { url: string; ok: boolean; error?: string }

function collectFrontendUrls(): string[] {
  const keys = [
    'VITE_SOLANA_RPC_URL_MAINNET','VITE_SOLANA_RPC_URL_MAINNET_2','VITE_SOLANA_RPC_URL_MAINNET_3','VITE_SOLANA_RPC_URL_MAINNET_4','VITE_SOLANA_RPC_URL_MAINNET_5',
    'VITE_SOLANA_RPC_URL_DEVNET','VITE_SOLANA_RPC_URL_DEVNET_2','VITE_SOLANA_RPC_URL_DEVNET_3',
    'VITE_SOLANA_RPC_URL_TESTNET','VITE_SOLANA_RPC_URL_TESTNET_2','VITE_SOLANA_RPC_URL_TESTNET_3',
  ]
  const urls = keys.map(k => (import.meta.env as any)[k]).filter(Boolean)
  return Array.from(new Set(urls))
}

export default function RpcHealthWidget() {
  const [running, setRunning] = useState(false)
  const [frontend, setFrontend] = useState<Result[]>([])
  const [backend, setBackend] = useState<Result[]>([])
  const urls = collectFrontendUrls()

  const run = async () => {
    if (running) return
    setRunning(true)
    const now = Date.now()
    localStorage.setItem('rpcHealthLastRunAt', String(now))
    try {
      const resp = await ApiClient.get(`${API_CONFIG.getBaseUrl()}/rpc/health`)
      const data = await resp.json()
      const back = (data?.backend || []).map((r: any) => ({ url: r.url, ok: !!r.ok, error: r.error })) as Result[]
      setBackend(back)
      const front = (data?.frontend || []).map((r: any) => ({ url: r.url, ok: !!r.ok, error: r.error })) as Result[]
      setFrontend(front.length ? front : urls.map(u => ({ url: u, ok: false, error: 'no frontend result' })))
    } catch (e) {
      setBackend(urls.map(u => ({ url: u, ok: false, error: 'backend route error' })))
    }
    setRunning(false)
  }

  useEffect(() => {
    const last = Number(localStorage.getItem('rpcHealthLastRunAt') || 0)
    if (!last || (Date.now() - last) > 60 * 60 * 1000) run()
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">RPC Health</h4>
        <button className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50" disabled={running} onClick={run}>
          {running ? 'Checking…' : 'Run Health Check'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-400 mb-1">Frontend</div>
          <ul className="text-xs text-gray-300 space-y-1">
            {urls.map(u => {
              const r = frontend.find(x => x.url === u)
              const status = r ? (r.ok ? 'OK' : `ERR: ${r.error?.slice(0,80)}`) : '—'
              return <li key={u}>{u} → {status}</li>
            })}
          </ul>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-1">Backend</div>
          <ul className="text-xs text-gray-300 space-y-1">
            {backend.map(r => (
              <li key={r.url}>{r.url} → {r.ok ? 'OK' : `ERR: ${r.error?.slice(0,80)}`}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}