/**
 * License router: Backend-only license info and activation
 * Purpose: Provide license status and activation when smart contract integration is disabled
 * Security: Protected by JWT (requireAuth applied at server wiring)
 */
import { Router, Request, Response } from 'express'
import { query, pool } from '../db'
import { distributeLicense } from '../services/buckets'
import { getBackendAuthorityPublicKey } from '../lib/solana'
import { applyBalanceBucketChange, getOrCreateBalanceId } from '../services/balance'
import { distributeAffiliateBonuses } from '../services/affiliate'

const router = Router()

/**
 * GET /license/info
 * Returns current user's license status and expiration, plus fee and term from settings
 */
router.get('/license/info', async (_req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string } | undefined
    if (!auth?.sub || !auth?.addr) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Fetch user license status
    const userSql = 'SELECT license_status, license_expiration FROM users WHERE id = $1'
    const userRes = await query<{ license_status: string | null; license_expiration: string | null }>(userSql, [auth.sub])
    const { license_status: rawStatus, license_expiration } = userRes.rows[0] || { license_status: 'none', license_expiration: null }
    const license_status = rawStatus || 'none'

    // Fetch settings for license cost (USDT, whole tokens) and term (days)
    const settingsSql = "SELECT key, value, type FROM settings WHERE key IN ('license.fee_usdt','license.term_days')"
    const settingsRes = await query<{ key: string; value: unknown; type: string }>(settingsSql)

    // Settings: read license fee in micro USDT and term in days
    let feeUsdtMicro: number | null = null
    let termDays: number | null = null

    for (const row of settingsRes.rows) {
      if (row.key === 'license.fee_usdt') {
        const raw = row.value
        if (typeof raw === 'number') feeUsdtMicro = raw
        else if (typeof raw === 'string') feeUsdtMicro = Number(raw)
        else if (typeof raw === 'object' && raw !== null) {
          const v = raw as Record<string, unknown>
          const inner = typeof v.value === 'number' ? v.value : Number(v.value as string)
          if (!Number.isNaN(inner)) feeUsdtMicro = inner as number
        }
      } else if (row.key === 'license.term_days') {
        if (typeof row.value === 'number') termDays = row.value
        else if (typeof row.value === 'string') termDays = Number(row.value)
        else if (typeof row.value === 'object' && row.value !== null) {
          const v = row.value as Record<string, unknown>
          const inner = typeof v.value === 'number' ? v.value : Number(v.value as string)
          if (!Number.isNaN(inner)) termDays = inner
        }
      }
    }

    if (feeUsdtMicro === null || Number.isNaN(feeUsdtMicro)) {
      return res.status(500).json({ error: 'Missing or invalid setting: license.fee_usdt (micro USDT)' })
    }

    const cost_usdt_micro = Math.round(feeUsdtMicro)
    const cost_usdt = cost_usdt_micro / 1_000_000

    return res.json({
      user_address: auth.addr,
      license_status,
      license_expiration,
      cost_usdt_micro,
      cost_usdt,
      term_days: termDays,
    })
  } catch (err) {
    console.error('[license] info error', err)
    return res.status(500).json({ error: 'Failed to fetch license info' })
  }
})

/**
 * POST /license/activate
 * Activates or extends the current user's license based on configured term
 */
router.post('/license/activate', async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string } | undefined
    if (!auth?.sub || !auth?.addr) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Load license term from settings
    const termSql = "SELECT value, type FROM settings WHERE key = 'license.term_days' LIMIT 1"
    const termRes = await query<{ value: unknown; type: string }>(termSql)
    let termDays = 365
    const termRow = termRes.rows[0]
    if (termRow) {
      if (typeof termRow.value === 'number') termDays = termRow.value
      else if (typeof termRow.value === 'string') termDays = Number(termRow.value)
      else if (typeof termRow.value === 'object' && termRow.value !== null) {
        const v = termRow.value as Record<string, unknown>
        const inner = typeof v.value === 'number' ? v.value : Number(v.value as string)
        if (!Number.isNaN(inner)) termDays = inner
      }
    }

    const now = Date.now()
    const expiresAt = new Date(now + termDays * 24 * 60 * 60 * 1000)

    // Require an existing transaction reference (id or signature) from the paid flow
    const body = (req.body ?? {}) as Record<string, unknown>
    const bodyTxId = typeof body.transaction_id === 'number' ? body.transaction_id : Number(body.transaction_id as string)
    const bodySig = typeof body.signature === 'string' ? (body.signature as string) : undefined

    let txId: number | null = null
    let feeUsdtMicro = 0
    let costUsdt = 0

    if (Number.isFinite(bodyTxId) && bodyTxId > 0) {
      const txRes = await query<{ id: number; amount: number; decimals: number }>(
        'SELECT id, amount, decimals FROM transactions WHERE id = $1 LIMIT 1',
        [bodyTxId]
      )
      const row = txRes.rows[0]
      if (!row) return res.status(404).json({ error: 'Transaction not found for provided transaction_id' })
      txId = row.id
      feeUsdtMicro = Number(row.amount || 0)
      const decimals = Number(row.decimals || 6)
      costUsdt = decimals === 6 ? feeUsdtMicro / 1_000_000 : feeUsdtMicro / Math.pow(10, decimals)
    } else if (bodySig && bodySig.length >= 32) {
      const txRes = await query<{ id: number; amount: number; decimals: number }>(
        'SELECT id, amount, decimals FROM transactions WHERE signature = $1 LIMIT 1',
        [bodySig]
      )
      const row = txRes.rows[0]
      if (!row) return res.status(404).json({ error: 'Transaction not found for provided signature' })
      txId = row.id
      feeUsdtMicro = Number(row.amount || 0)
      const decimals = Number(row.decimals || 6)
      costUsdt = decimals === 6 ? feeUsdtMicro / 1_000_000 : feeUsdtMicro / Math.pow(10, decimals)
    } else {
      return res.status(400).json({ error: 'Missing transaction reference: provide transaction_id or signature' })
    }

    // Update user license status
    const updateSql = 'UPDATE users SET license_status = $1, license_expiration = $2 WHERE id = $3'
    await query(updateSql, ['active', expiresAt.toISOString(), auth.sub])

    // Distribute 90% per configured shares; include transaction_id in histories via helper
    await distributeLicense(costUsdt, txId as number)

    // Multi-level affiliate distribution (L1→L3) via helper with dev fallback
    await distributeAffiliateBonuses(auth.sub, feeUsdtMicro, txId as number)

    return res.json({
      ok: true,
      license_status: 'active',
      license_expiration: expiresAt.toISOString(),
      term_days: termDays,
      transaction_id: txId,
    })
  } catch (err) {
    console.error('[license] activate error', err)
    return res.status(500).json({ error: 'License activation failed' })
  }
})

/**
 * POST /license/activate/manual
 * Admin/dev-only: update license without triggering bucket distributions.
 * Records a transaction for traceability with type=license_activation and manual flag.
 */
router.post('/license/activate/manual', async (_req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string } | undefined
    if (!auth?.sub || !auth?.addr) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Authorization: only backend authority (dev) and admins from env may invoke
    const devAuthority = await getBackendAuthorityPublicKey().catch((e) => {
      console.warn('[license] manual: failed to load backend authority', e?.message || e)
      return null
    })
    const adminList = (process.env.ADMIN_PUBKEYS || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const allowed = new Set<string>([...adminList])
    if (devAuthority) allowed.add(devAuthority)

    if (!allowed.has(auth.addr)) {
      return res.status(403).json({ error: 'Forbidden: admin/dev only' })
    }

    // Load license term from settings
    const termSql = "SELECT value, type FROM settings WHERE key = 'license.term_days' LIMIT 1"
    const termRes = await query<{ value: unknown; type: string }>(termSql)
    let termDays = 365
    const termRow = termRes.rows[0]
    if (termRow) {
      if (typeof termRow.value === 'number') termDays = termRow.value
      else if (typeof termRow.value === 'string') termDays = Number(termRow.value)
      else if (typeof termRow.value === 'object' && termRow.value !== null) {
        const v = termRow.value as Record<string, unknown>
        const inner = typeof v.value === 'number' ? v.value : Number(v.value as string)
        if (!Number.isNaN(inner)) termDays = inner
      }
    }

    const now = Date.now()
    const expiresAt = new Date(now + termDays * 24 * 60 * 60 * 1000)

    // Update user license status to active with new expiration
    const updateSql = 'UPDATE users SET license_status = $1, license_expiration = $2 WHERE id = $3'
    await query(updateSql, ['active', expiresAt.toISOString(), auth.sub])

    // Fetch license fee and compute micro amount
    const feeSql = "SELECT value, type FROM settings WHERE key = 'license.fee_usdt' LIMIT 1"
    const feeRes = await query<{ value: unknown; type: string }>(feeSql)
    let feeUsdtMicro = 1_000_000 // default 1 USDT in micro
    const feeRow = feeRes.rows[0]
    if (feeRow) {
      if (typeof feeRow.value === 'number') feeUsdtMicro = feeRow.value
      else if (typeof feeRow.value === 'string') feeUsdtMicro = Number(feeRow.value)
      else if (typeof feeRow.value === 'object' && feeRow.value !== null) {
        const v = feeRow.value as Record<string, unknown>
        const inner = typeof v.value === 'number' ? v.value : Number(v.value as string)
        if (!Number.isNaN(inner)) feeUsdtMicro = inner
      }
    }

    // Record a manual activation transaction with actual license fee amount
    const txSql = `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata)
                   VALUES ($1::text, $2::text, NULL, $3::text, NULL, NULL, $4::bigint, $5::text, $6::smallint, $7::jsonb)
                   RETURNING id`
    const txParams = [
      'license_activation',
      'confirmed',
      auth.addr,
      feeUsdtMicro,
      'USDT_DEVNET',
      6,
      { source: 'backend', route: 'license/activate/manual', manual: true },
    ]
    const txRes = await query<{ id: number }>(txSql, txParams)
    const txId = txRes.rows[0]?.id
    if (!txId) {
      throw new Error('Failed to create transaction for manual license activation')
    }

    // IMPORTANT: Do not call distribution for manual activation

    return res.json({
      ok: true,
      license_status: 'active',
      license_expiration: expiresAt.toISOString(),
      term_days: termDays,
      transaction_id: txId,
      manual: true,
    })
  } catch (err) {
    console.error('[license] manual activate error', err)
    return res.status(500).json({ error: 'Manual license activation failed' })
  }
})

export default router