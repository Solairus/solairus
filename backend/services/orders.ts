/**
 * Payment order service: per-transaction HD index allocation + order lifecycle.
 * The order row IS the address map. hd_index 0 is reserved for the treasury.
 */
import type { PoolClient } from 'pg'
import { pool, query } from '../db'
import { getOrderAddress, TREASURY_HD_INDEX } from '../lib/hd-wallet'

export type OrderType = 'license' | 'agent' | 'deposit'
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'expired'

export interface OrderRow {
  id: number
  order_ref: string
  user_id: number
  hd_index: number | string
  address: string
  type: OrderType
  tier_id: number | null
  expected_micro: string | null
  status: OrderStatus
  tx_signature: string | null
  transaction_id: number | null
  metadata: Record<string, unknown>
  expires_at: string
  created_at?: string
}

// Serialize index allocation across concurrent order creations (advisory lock key).
const ALLOC_LOCK_KEY = 824_517_001

/**
 * Allocate a per-order HD index: always MAX+1, never reused. Reusing indices from
 * cancelled/expired orders is unsafe without an on-chain zero-balance check — a late
 * payment to an old order's address would settle whichever order holds the index next
 * (and every user saw the same deposit address). The index space is unbounded; fresh
 * per order is both safer and clearer. Never returns the reserved treasury index.
 * Must be called inside a transaction that holds the advisory lock.
 */
async function allocateHdIndex(client: PoolClient): Promise<number> {
  const maxRes = await client.query<{ max: string | null }>('SELECT MAX(hd_index) AS max FROM payment_orders')
  const next = Number(maxRes.rows[0]?.max ?? 0) + 1
  return Math.max(next, TREASURY_HD_INDEX + 1)
}

function genOrderRef(type: OrderType): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${rand}`
}

export interface CreateOrderInput {
  userId: number
  type: OrderType
  expectedMicro: number | null
  tierId?: number | null
  ttlMs: number
  metadata?: Record<string, unknown>
}

/** Existing live (pending/processing) order for collision handling. */
export async function findActiveOrder(userId: number): Promise<OrderRow | null> {
  const res = await query<OrderRow>(
    `SELECT * FROM payment_orders
       WHERE user_id = $1 AND status IN ('pending','processing')
       ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  return res.rows[0] ?? null
}

export async function getOrderByRef(orderRef: string, userId: number): Promise<OrderRow | null> {
  const res = await query<OrderRow>(
    'SELECT * FROM payment_orders WHERE order_ref = $1 AND user_id = $2 LIMIT 1',
    [orderRef, userId]
  )
  return res.rows[0] ?? null
}

/** Create a new pending order, allocating + deriving a unique deposit address. */
export async function createOrder(input: CreateOrderInput): Promise<OrderRow> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [ALLOC_LOCK_KEY])

    const hdIndex = await allocateHdIndex(client)
    const address = getOrderAddress(hdIndex)
    const orderRef = genOrderRef(input.type)
    const expiresAt = new Date(Date.now() + input.ttlMs).toISOString()

    const res = await client.query<OrderRow>(
      `INSERT INTO payment_orders
         (order_ref, user_id, hd_index, address, type, tier_id, expected_micro, status, metadata, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8::jsonb,$9)
       RETURNING *`,
      [
        orderRef,
        input.userId,
        hdIndex,
        address,
        input.type,
        input.tierId ?? null,
        input.expectedMicro,
        JSON.stringify(input.metadata ?? {}),
        expiresAt,
      ]
    )
    await client.query('COMMIT')
    return res.rows[0]
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

/** Cancel a still-pending order (its HD index/address is retired, never reassigned). */
export async function cancelOrder(orderRef: string, userId: number): Promise<boolean> {
  const res = await query(
    `UPDATE payment_orders SET status='cancelled', updated_at=NOW()
       WHERE order_ref=$1 AND user_id=$2 AND status='pending'`,
    [orderRef, userId]
  )
  return (res.rowCount ?? 0) > 0
}
