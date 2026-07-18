/**
 * Order-gated deposit monitor.
 * Polls ONLY addresses with a pending, unexpired order — zero RPC when idle.
 * On detection: atomic pending->processing lock, synchronous sweep, idempotent fulfill.
 */
import { PublicKey } from '@solana/web3.js'
import { query } from '../db'
import { getWorkingConnection } from '../lib/rpc-manager'
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

/** Persist the sweep signature the moment it is broadcast, before confirmation. */
async function recordSweepBroadcast(orderId: number, signature: string, amountMicro: bigint): Promise<void> {
  await query(
    "UPDATE payment_orders SET metadata = metadata || $1::jsonb, updated_at=NOW() WHERE id=$2",
    [JSON.stringify({ sweep_sig: signature, sweep_amount_micro: amountMicro.toString(), sweep_broadcast_at: new Date().toISOString() }), orderId]
  )
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
    const { signature } = await sweepToTreasury({
      orderIndex: Number(order.hd_index),
      amountMicro: balanceMicro,
      onSignature: (sig) => recordSweepBroadcast(order.id, sig, balanceMicro),
    })
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

/**
 * Recover orders stranded in 'processing' (e.g. sweep broadcast but confirmation timed out).
 * - Recorded sweep_sig confirmed on-chain  -> fulfill with the recorded amount.
 * - No confirmed sweep but funds still sit on the deposit address -> re-sweep + fulfill.
 * - No sig and address empty -> ambiguous; leave for manual review (never guess with funds).
 * Only touches rows idle for 2+ minutes so it never races an in-flight settle.
 */
export async function reconcileProcessingOrders(): Promise<void> {
  const stuck = await query<PendingRow>(
    `SELECT po.*, u.user_address
       FROM payment_orders po
       JOIN users u ON u.id = po.user_id
      WHERE po.status = 'processing'
        AND po.updated_at < NOW() - INTERVAL '2 minutes'`
  )

  for (const order of stuck.rows) {
    try {
      const meta = (order.metadata ?? {}) as Record<string, unknown>
      const sig = typeof meta.sweep_sig === 'string' ? meta.sweep_sig : null

      if (sig) {
        const conn = await getWorkingConnection()
        const st = (await conn.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0]
        if (st && !st.err && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) {
          const swept = typeof meta.sweep_amount_micro === 'string' ? BigInt(meta.sweep_amount_micro) : 0n
          console.log('[order-monitor] reconciling confirmed sweep', { order_ref: order.order_ref, sig })
          await fulfillOrder(order, swept, sig, order.user_address)
          continue
        }
        if (st?.err) {
          console.error('[order-monitor] recorded sweep FAILED on-chain; will retry from balance', { order_ref: order.order_ref, sig, err: st.err })
        }
      }

      // No confirmed sweep — if the deposit address still holds the funds, redo sweep + fulfill.
      const balanceMicro = await getUsdtBalanceMicro(new PublicKey(order.address))
      if (balanceMicro > 0n && meetsThreshold(order, balanceMicro)) {
        console.log('[order-monitor] re-sweeping stranded processing order', { order_ref: order.order_ref })
        const { signature } = await sweepToTreasury({
          orderIndex: Number(order.hd_index),
          amountMicro: balanceMicro,
          onSignature: (s) => recordSweepBroadcast(order.id, s, balanceMicro),
        })
        await fulfillOrder(order, balanceMicro, signature, order.user_address)
        continue
      }

      if (!sig && balanceMicro === 0n) {
        console.error('[order-monitor] processing order has no sweep sig and empty address — manual review needed', { order_ref: order.order_ref })
      }
    } catch (e) {
      console.error('[order-monitor] reconcile failed', { order_ref: order.order_ref, error: e instanceof Error ? e.message : e })
    }
  }
}

async function runCycle(): Promise<void> {
  const pending = await query<PendingRow>(
    `SELECT po.*, u.user_address
       FROM payment_orders po
       JOIN users u ON u.id = po.user_id
      WHERE po.status = 'pending' AND po.expires_at > NOW()`
  )

  for (const order of pending.rows) {
    try {
      await verifyAndSettleOrder(order)
    } catch (e) {
      console.error('[order-monitor] check failed', { order_ref: order.order_ref, error: e instanceof Error ? e.message : e })
    }
  }

  await expireStaleOrders()
  await reconcileProcessingOrders()
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
