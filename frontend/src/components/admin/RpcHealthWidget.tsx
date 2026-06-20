import { useEffect, useMemo, useState } from 'react'
import { API_CONFIG, ApiClient } from '@/config/service-endpoints'

type Result = { url: string; ok: boolean; error?: string; version?: string; pending?: boolean }

// Mainnet only. Vars are the base key plus _0.._N suffixes.
function collectFrontendUrls(): string[] {
  const keys = ['VITE_SOLANA_RPC_URL_MAINNET']
  for (let i = 0; i <= 9; i++) keys.push(`VITE_SOLANA_RPC_URL_MAINNET_${i}`)
  const urls = keys.map(k => (import.meta.env as any)[k]).filter(Boolean)
  return Array.from(new Set(urls))
}

// Ping an RPC endpoint directly from the browser. This is the real "frontend"
// health check: it exercises the exact network path the app uses, including
// CORS/CSP and the browser's own connectivity — something the backend can't
// verify on the client's behalf.
async function pingFromBrowser(url: string): Promise<Result> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getVersion' }),
      signal: controller.signal,
    })
    if (!resp.ok) return { url, ok: false, error: `HTTP ${resp.status}` }
    const data = await resp.json()
    if (data?.error) return { url, ok: false, error: data.error?.message || 'rpc error' }
    return { url, ok: true, version: data?.result?.['solana-core'] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // fetch throws a generic "Failed to fetch" on CORS/CSP/network failures
    return { url, ok: false, error: msg === 'Failed to fetch' ? 'unreachable (CORS / network)' : msg }
  } finally {
    clearTimeout(timer)
  }
}

function RpcCard({ r }: { r: Result }) {
  const tone = r.pending
    ? 'border-white/10 bg-white/5'
    : r.ok
      ? 'border-green-500/30 bg-green-500/10'
      : 'border-red-500/30 bg-red-500/10'
  const dot = r.pending ? 'bg-gray-500' : r.ok ? 'bg-green-400' : 'bg-red-400'
  const label = r.pending ? '—' : r.ok ? 'OK' : 'ERR'
  const labelTone = r.pending ? 'text-gray-400' : r.ok ? 'text-green-300' : 'text-red-300'
  const right = r.ok ? (r.version ? `v${r.version}` : '') : r.pending ? '' : r.error || ''
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1 ${tone}`}
      title={r.url + (r.error ? ` — ${r.error}` : '')}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className={`w-8 shrink-0 text-[11px] font-semibold ${labelTone}`}>{label}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-gray-300">{r.url}</span>
      {right && (
        <span className={`shrink-0 text-[10px] ${r.ok ? 'text-gray-500' : 'text-red-300/80'}`}>{right}</span>
      )}
    </div>
  )
}

export default function RpcHealthWidget() {
  const [running, setRunning] = useState(false)
  const [frontend, setFrontend] = useState<Result[]>([])
  const [backend, setBackend] = useState<Result[]>([])
  const urls = useMemo(collectFrontendUrls, [])

  const run = async () => {
    if (running) return
    setRunning(true)
    localStorage.setItem('rpcHealthLastRunAt', String(Date.now()))

    // Frontend: ping each configured RPC URL directly from the browser.
    const frontPromise = Promise.all(urls.map(pingFromBrowser)).then(setFrontend)

    // Backend: ask the API which pings the backend's own (non-VITE) RPC URLs.
    const backPromise = (async () => {
      try {
        const resp = await ApiClient.get(`${API_CONFIG.getBaseUrl()}/rpc/health`)
        const data = await resp.json()
        const back = (data?.backend || []).map((r: any) => ({
          url: r.url, ok: !!r.ok, error: r.error, version: r.version,
        })) as Result[]
        setBackend(back)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'backend route error'
        setBackend([{ url: 'backend /rpc/health', ok: false, error: msg }])
      }
    })()

    await Promise.all([frontPromise, backPromise])
    setRunning(false)
  }

  useEffect(() => {
    const last = Number(localStorage.getItem('rpcHealthLastRunAt') || 0)
    if (!last || (Date.now() - last) > 60 * 60 * 1000) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Always show the configured frontend URLs, merging in results as they arrive.
  const frontendCards: Result[] = urls.map(
    u => frontend.find(r => r.url === u) ?? { url: u, ok: false, pending: true }
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">RPC Health</h4>
        <button
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
          disabled={running}
          onClick={run}
        >
          {running ? 'Checking…' : 'Run Health Check'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="text-sm text-gray-400">Frontend <span className="text-gray-500">(pinged from browser)</span></div>
          {frontendCards.length ? (
            <div className="grid grid-cols-1 gap-1.5">
              {frontendCards.map(r => <RpcCard key={r.url} r={r} />)}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No VITE_SOLANA_RPC_URL_* configured</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-gray-400">Backend <span className="text-gray-500">(pinged from server)</span></div>
          {backend.length ? (
            <div className="grid grid-cols-1 gap-1.5">
              {backend.map(r => <RpcCard key={r.url} r={r} />)}
            </div>
          ) : (
            <div className="text-xs text-gray-500">{running ? 'Checking…' : 'No backend results'}</div>
          )}
        </div>
      </div>
    </div>
  )
}
