/**
 * Payment order routes (contract-free HD-wallet payments).
 *  POST /orders/init        create a per-order deposit address (license | agent | deposit)
 *  GET  /orders/:ref        poll order status
 *  POST /orders/:ref/verify force one on-chain detection pass
 *  POST /orders/:ref/cancel cancel a pending order
 * Auth: requireAuth (mounted in index.ts) → res.locals.auth { sub, addr }
 */
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query } from '../db'
import { createOrder, getOrderByRef, findActiveOrder, cancelOrder, type OrderRow } from '../services/orders'
import { verifyAndSettleOrder } from '../services/order-monitor'

const router = Router()

const DEFAULT_TTL_MS = 3_600_000 // 60 min — license/agent purchase window
const DEPOSIT_TTL_MS_DEFAULT = 86_400_000 // 24 h — deposits fund slowly

function ttlForType(type: string): number {
  if (type === 'deposit') return Number(process.env.DEPOSIT_TTL_MS ?? DEPOSIT_TTL_MS_DEFAULT)
  return Number(process.env.ORDER_TTL_MS ?? DEFAULT_TTL_MS)
}

function parseSettingMicro(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') { const n = Number(value); return Number.isFinite(n) ? n : null }
  if (typeof value === 'object' && value !== null) {
    const inner = (value as Record<string, unknown>).value
    const n = typeof inner === 'number' ? inner : Number(inner as string)
    return Number.isFinite(n) ? n : null
  }
  return null
}

async function getLicenseFeeMicro(): Promise<number | null> {
  const r = await query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'license.fee_usdt' LIMIT 1")
  return parseSettingMicro(r.rows[0]?.value)
}

function publicOrder(o: OrderRow) {
  return {
    order_ref: o.order_ref,
    type: o.type,
    address: o.address,
    expected_micro: o.expected_micro ? Number(o.expected_micro) : null,
    status: o.status,
    tx_signature: o.tx_signature,
    transaction_id: o.transaction_id,
    expires_at: o.expires_at,
    mint: process.env.USDT_MINT_ADDRESS ?? null,
    cluster: process.env.SOLANA_CLUSTER ?? 'mainnet-beta',
  }
}

const InitSchema = z.object({
  type: z.enum(['license', 'agent', 'deposit']),
  amountMicro: z.number().int().positive().optional(),
  tierId: z.number().int().positive().optional(),
})

router.post('/orders/init', async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string }
    if (!auth?.sub || !auth?.addr) return res.status(401).json({ error: 'Unauthorized' })

    const parsed = InitSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const { type, amountMicro, tierId } = parsed.data

    // Collision: an existing live order is informational (HTTP 200), not an error.
    const active = await findActiveOrder(auth.sub)
    if (active) {
      return res.status(200).json({ info: 'active_order_exists', order: publicOrder(active) })
    }

    // Resolve expected amount + tier per type.
    let expectedMicro: number | null = null
    let resolvedTierId: number | null = tierId ?? null

    if (type === 'license') {
      const fee = await getLicenseFeeMicro()
      if (fee === null) return res.status(500).json({ error: 'Missing setting: license.fee_usdt' })
      expectedMicro = Math.round(fee)
    } else if (type === 'agent') {
      if (!amountMicro) return res.status(400).json({ error: 'amountMicro required for agent order' })
      const tier = await query<{ id: number }>(
        'SELECT id FROM agent_tiers WHERE $1::bigint BETWEEN min_amount AND max_amount LIMIT 1',
        [amountMicro]
      )
      if (!tier.rows[0]) return res.status(400).json({ error: 'amountMicro does not match any agent tier' })
      expectedMicro = amountMicro
      resolvedTierId = tier.rows[0].id
    } // deposit → expectedMicro stays null (open-ended)

    const order = await createOrder({
      userId: auth.sub,
      type,
      expectedMicro,
      tierId: resolvedTierId,
      ttlMs: ttlForType(type),
    })

    return res.status(201).json({ order: publicOrder(order) })
  } catch (err) {
    console.error('[orders/init] error', err)
    return res.status(500).json({ error: 'Failed to create order' })
  }
})

router.get('/orders/:ref', async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number }
    if (!auth?.sub) return res.status(401).json({ error: 'Unauthorized' })
    const ref = String(req.params.ref)
    const order = await getOrderByRef(ref, auth.sub)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    return res.json({ order: publicOrder(order) })
  } catch (err) {
    console.error('[orders/:ref] error', err)
    return res.status(500).json({ error: 'Failed to fetch order' })
  }
})

router.post('/orders/:ref/verify', async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string }
    if (!auth?.sub || !auth?.addr) return res.status(401).json({ error: 'Unauthorized' })
    const ref = String(req.params.ref)
    const order = await getOrderByRef(ref, auth.sub)
    if (!order) return res.status(404).json({ error: 'Order not found' })

    if (order.status === 'pending') {
      await verifyAndSettleOrder({ ...order, user_address: auth.addr })
      const refreshed = await getOrderByRef(ref, auth.sub)
      return res.json({ order: publicOrder(refreshed ?? order) })
    }
    return res.json({ order: publicOrder(order) })
  } catch (err) {
    console.error('[orders/:ref/verify] error', err)
    return res.status(500).json({ error: 'Verification failed' })
  }
})

router.post('/orders/:ref/cancel', async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number }
    if (!auth?.sub) return res.status(401).json({ error: 'Unauthorized' })
    const ref = String(req.params.ref)
    const ok = await cancelOrder(ref, auth.sub)
    if (!ok) return res.status(409).json({ error: 'Order not cancellable (not pending or not found)' })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[orders/:ref/cancel] error', err)
    return res.status(500).json({ error: 'Cancel failed' })
  }
})

export default router
