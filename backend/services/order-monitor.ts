/**
 * Order-gated deposit monitor.
 * Polls ONLY addresses with a pending, unexpired order — zero RPC when idle.
 * On detection: atomic pending->processing lock, synchronous sweep, idempotent fulfill.
 */
import { PublicKey } from '@solana/web3.js'
import { query } from '../db'
import { getUsdtBalanceMicro, sweepToTreasury } from '../lib/usdt-transfer'
import { fulfillOrder, expireStaleOrders } from './fulfillment'
import type { OrderRow } from './orders'

const DEFAULT_POLL_MS = 15000
const DEFAULT_TOLERANCE_BPS = 50 // accept balance >= expected * (1 - 0.5%)

type PendingRow = OrderRow & { user_address: string }

function meetsThreshold(order: PendingRow, balanceMicro: bigint): boolean {
  if (!order.expected_micro || BigInt(order.expected_micro) <= 0n) {
    // Open-ended deposit: any positive balance counts.
    return balanceMicro > 0n
  }
  const expected = BigInt(order.expected_micro)
  const bps = Number(process.env.SWEEP_MIN_TOLERANCE_BPS ?? DEFAULT_TOLERANCE_BPS)
  const minAccept = expected - (expected * BigInt(Math.round(bps)) / 10000n)
  return balanceMicro >= minAccept
}

export async function verifyAndSettleOrder(order: PendingRow): Promise<void> {
  const balanceMicro = await getUsdtBalanceMicro(new PublicKey(order.address))
  if (!meetsThreshold(order, balanceMicro)) return

  // Atomic lock: only the first worker transitions pending -> processing.
  const locked = await query(
    "UPDATE payment_orders SET status='processing', updated_at=NOW() WHERE id=$1 AND status='pending'",
    [order.id]
  )
  if ((locked.rowCount ?? 0) === 0) return

  try {
    const { signature } = await sweepToTreasury({ orderIndex: Number(order.hd_index), amountMicro: balanceMicro })
    await fulfillOrder(order, balanceMicro, signature, order.user_address)
  } catch (e) {
    // Leave the order in 'processing' for admin reconciliation — never blind-revert,
    // the sweep may have broadcast. Record the error for visibility.
    const errMsg = e instanceof Error ? e.message : String(e)
    const errStack = e instanceof Error ? e.stack : ''
    console.error('[order-monitor] settle failed (left processing)', {
      order_ref: order.order_ref,
      error: errMsg,
      stack: errStack,
      name: e instanceof Error ? e.constructor.name : typeof e,
    })
    await query(
      "UPDATE payment_orders SET metadata = metadata || $1::jsonb, updated_at=NOW() WHERE id=$2",
      [JSON.stringify({ settle_error: errMsg, settle_failed_at: new Date().toISOString() }), order.id]
    ).catch(() => {})
  }
}

async function runCycle(): Promise<void> {
  const pending = await query<PendingRow>(
    `SELECT po.*, u.user_address
       FROM payment_orders po
       JOIN users u ON u.id = po.user_id
      WHERE po.status = 'pending' AND po.expires_at > NOW()`
  )

  if (pending.rows.length === 0) {
    await expireStaleOrders()
    return
  }

  for (const order of pending.rows) {
    try {
      await verifyAndSettleOrder(order)
    } catch (e) {
      console.error('[order-monitor] check failed', { order_ref: order.order_ref, error: e instanceof Error ? e.message : e })
    }
  }

  await expireStaleOrders()
}

let timer: NodeJS.Timeout | null = null

export function startOrderMonitor(): void {
  if (timer) return
  const interval = Number(process.env.ORDER_POLL_INTERVAL_MS ?? DEFAULT_POLL_MS)
  console.log(`[order-monitor] starting (interval ${interval}ms)`)
  timer = setInterval(() => { runCycle().catch((e) => console.error('[order-monitor] cycle error', e)) }, interval)
}

export function stopOrderMonitor(): void {
  if (timer) { clearInterval(timer); timer = null }
}
