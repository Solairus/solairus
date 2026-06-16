import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ApiClient, API_CONFIG } from '@/config/service-endpoints'

interface AdminUserRow {
  user_address: string
  sponsor_address?: string
  license_status: 'none' | 'active' | 'expired' | 'revoked'
  license_expiration?: string
  total_agents: number
  total_agent_amount?: number | string
  registration_date: string
  total_withdrawn: number | string
}

function formatUsdtMicro(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  const units = Math.floor(n) / 1_000_000
  return units.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateISO(iso?: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString() } catch { return '—' }
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function AdminUsersTable() {
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AdminUserRow | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const base = API_CONFIG.getBaseUrl()
        const url = `${base}/admin/users/list${query ? `?search=${encodeURIComponent(query)}` : ''}`
        const resp = await ApiClient.get(url)
        const data = await resp.json()
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [query])

  const renderedRows = useMemo(() => rows, [rows])

  const short = (addr?: string) => {
    if (!addr) return '—'
    const s = addr.toString()
    return `${s.slice(0, 8)}...${s.slice(-8)}`
  }

  return (
    <>
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Registered Users</CardTitle>
            <p className="text-gray-400 text-sm">Search by wallet address</p>
          </div>
          <Input
            placeholder="Search user wallet..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white w-80"
            disabled={loading}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800">
              <TableHead className="text-gray-300">User Address</TableHead>
              <TableHead className="text-gray-300">Sponsor</TableHead>
              <TableHead className="text-gray-300">License</TableHead>
              <TableHead className="text-gray-300">Total Activated</TableHead>
              <TableHead className="text-gray-300">Registered</TableHead>
              <TableHead className="text-gray-300">Total Withdrawn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderedRows.map((r) => (
              <TableRow key={r.user_address} className="border-gray-800 cursor-pointer hover:bg-gray-800/50" onClick={() => setSelected(r)}>
                <TableCell className="text-white font-mono">{short(r.user_address)}</TableCell>
                <TableCell className="text-gray-300 font-mono">{short(r.sponsor_address)}</TableCell>
                <TableCell className="text-gray-300">
                  <div className="flex items-center gap-2">
                    <Badge className={
                      r.license_status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      r.license_status === 'expired' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }>
                      <span className="capitalize">{r.license_status}</span>
                    </Badge>
                    <span className="text-xs text-gray-500">{formatDateISO(r.license_expiration)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-300">{`$${formatUsdtMicro(r.total_agent_amount || 0)} USDT (${r.total_agents})`}</TableCell>
                <TableCell className="text-gray-300">{formatDateISO(r.registration_date)}</TableCell>
                <TableCell className="text-gray-300">{`$${formatUsdtMicro(r.total_withdrawn)} USDT`}</TableCell>
              </TableRow>
            ))}
            {renderedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                  {loading ? 'Loading users...' : 'No users found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">User Details</DialogTitle>
        </DialogHeader>
        {selected && (
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex justify-between"><span>User</span><span className="font-mono">{selected.user_address}</span></div>
            <div className="flex justify-between"><span>Sponsor</span><span className="font-mono">{selected.sponsor_address || '—'}</span></div>
            <div className="flex justify-between"><span>License</span><span className="font-mono capitalize">{selected.license_status}</span></div>
            <div className="flex justify-between"><span>Expiration</span><span className="font-mono">{formatDateISO(selected.license_expiration)}</span></div>
            <div className="flex justify-between"><span>Total Activated</span><span className="font-mono">{`$${formatUsdtMicro(selected.total_agent_amount || 0)} USDT (${selected.total_agents})`}</span></div>
            <div className="flex justify-between"><span>Registered</span><span className="font-mono">{formatDateISO(selected.registration_date)}</span></div>
            <div className="flex justify-between"><span>Total Withdrawn</span><span className="font-mono">{`$${formatUsdtMicro(selected.total_withdrawn)} USDT`}</span></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}