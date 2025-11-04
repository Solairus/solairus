/**
 * withdrawal_refund
 * Purpose: Internal helper to safely auto-refund provisional bonus_balance debits
 *          for user withdrawals that expired without a recorded signature.
 * Inputs:
 *  - orderId: withdrawal transaction order_id (UUID)
 * Output:
 *  - { refunded: boolean, reason?: string }
 * Core Logic:
 *  - Fetch transaction by orderId; only proceed for type 'user_withdrawal' and status 'pending'
 *  - Determine expiry via metadata.ttlMs (default 120_000) + created_at
 *  - Refund ONLY if: now > expiry AND signature is null (no on-chain broadcast)
 *  - Credit user's bonus_balance using applyBalanceBucketChange and record history
 *  - Mark transaction status as 'failed' with metadata { refund: true, failureReason }
 */
import { pool, query } from '../db'
import type { Transaction } from '../types'
import { applyBalanceBucketChange, getOrCreateBalanceId } from './balance'

export async function attemptExpiredWithdrawalRefund(orderId: string): Promise<{ refunded: boolean; reason?: string }> {
  const client = await pool.connect()
  try {
    const txRes = await client.query<Transaction>(
      'SELECT * FROM transactions WHERE order_id = $1 LIMIT 1',
      [orderId]
    )
    const record = txRes.rows[0]
    if (!record) return { refunded: false, reason: 'record_not_found' }
    if (record.type !== 'user_withdrawal') return { refunded: false, reason: 'not_user_withdrawal' }
    if (record.status !== 'pending') return { refunded: false, reason: 'not_pending' }

    // Parse TTL from metadata; fallback to 120s
    const ttlMs = (() => {
      const m = record.metadata as Record<string, unknown> | null
      const v = m && (m['ttlMs'] as number | string | undefined)
      if (typeof v === 'number') return v
      if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
      return 120_000
    })()

    const createdAt = new Date(record.created_at)
    const expiresAt = new Date(createdAt.getTime() + ttlMs)
    const now = new Date()
    if (now <= expiresAt) {
      return { refunded: false, reason: 'not_expired' }
    }

    // Safety: if signature exists, do NOT auto-refund (could be in flight or already confirmed)
    if (record.signature) {
      return { refunded: false, reason: 'signature_present' }
    }

    // Lookup user id from wallet
    const userRes = await client.query<{ id: number }>(
      'SELECT id FROM users WHERE user_address = $1 LIMIT 1',
      [record.initiator_wallet]
    )
    const user = userRes.rows[0]
    if (!user) return { refunded: false, reason: 'user_not_found' }

    await client.query('BEGIN')

    // Resolve or create balance row and credit the provisional debit back
    const balanceId = await getOrCreateBalanceId(client, user.id)
    const amountMicro = BigInt(record.amount)
    await applyBalanceBucketChange(
      client,
      balanceId,
      'bonus_balance',
      'credit',
      amountMicro,
      record.id,
      {
        reason: 'withdrawal_refund',
        order_id: orderId,
        action_source: 'auto_refund_on_expiry',
      }
    )

    // Mark transaction failed + refunded in metadata
    await client.query(
      'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $3',
      [
        'failed',
        JSON.stringify({ refund: true, failureReason: 'Expired without signature; refunded', refundAt: now.toISOString() }),
        record.id,
      ]
    )

    await client.query('COMMIT')
    return { refunded: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    return { refunded: false, reason: e instanceof Error ? e.message : 'unknown_error' }
  } finally {
    client.release()
  }
}