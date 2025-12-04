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
import { getWorkingConnection } from '../lib/rpc-manager'
import { PublicKey } from '@solana/web3.js'
import solairusPayIdl from '../idl/solairus_pay.json'
import { deriveReference, findSignatureByReference, verifyTokenDelta, finalizeRecovery, finalizeRefund } from './withdrawal_verifier'

export async function attemptExpiredWithdrawalRefund(orderId: string): Promise<{ refunded: boolean; reason?: string }> {
  const client = await pool.connect()
  try {
    const txRes = await client.query<Transaction>(
      'SELECT * FROM transactions WHERE order_id = $1 LIMIT 1 FOR UPDATE',
      [orderId]
    )
    const record = txRes.rows[0]
    if (!record) return { refunded: false, reason: 'record_not_found' }
    if (!(record.type === 'user_withdrawal' || record.type === 'role_withdrawal')) return { refunded: false, reason: 'not_withdrawal' }
    if (record.status !== 'pending') return { refunded: false, reason: 'not_pending' }

    // If refund already finalized, do not process again
    if (record.metadata && (record.metadata as Record<string, unknown>)['refund_finalized'] === true) {
      return { refunded: false, reason: 'refund_finalized' }
    }

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

    // Safety: on-chain verification first
    const PROGRAM_ID = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!
    const referenceStr = (record.metadata && (record.metadata as Record<string, unknown>)['reference']) as string | undefined
    const reference = referenceStr ? new PublicKey(referenceStr) : deriveReference(orderId, PROGRAM_ID)
    const conn = await getWorkingConnection()
    const sig = await findSignatureByReference(conn, reference)
    if (sig) {
      const decimals = record.decimals || 6
      const amtNum = typeof record.amount === 'string' ? Number(record.amount) : (record.amount as unknown as number)
      // FIX: record.amount is already in micro-units (integer). Do NOT multiply by 10^decimals.
      const amtMicro = BigInt(Math.round(amtNum))
      const valid = await verifyTokenDelta(conn, sig, record.initiator_wallet, record.mint_address, amtMicro, decimals)
      if (valid) {
        await finalizeRecovery(client, record.id, sig, { recoveredVia: 'reference', recoveredAt: new Date().toISOString() })
        return { refunded: false, reason: 'recovered_signature' }
      }
    }

    // Lookup user id from wallet
    const userRes = await client.query<{ id: number }>(
      'SELECT id FROM users WHERE user_address = $1 LIMIT 1',
      [record.initiator_wallet]
    )
    const user = userRes.rows[0]
    if (!user) return { refunded: false, reason: 'user_not_found' }

    await client.query('BEGIN')

    // Resolve or create balance row and credit the provisional debit back (single final action)
    const balanceId = await getOrCreateBalanceId(client, user.id)
    // Refund into balances uses micro units exactly as stored in transactions.amount
    // Do NOT rescale by decimals; transactions.amount is already micro (integer)
    const rawAmount = record.amount as unknown
    const amountMicro = typeof rawAmount === 'number'
      ? BigInt(Math.round(rawAmount))
      : BigInt(String(rawAmount))
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
    await finalizeRefund(client, record.id, { refund: true, refund_finalized: true, failureReason: 'Expired; no on-chain signature found', refundAt: now.toISOString(), reference: reference.toBase58() })

    await client.query('COMMIT')
    return { refunded: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { })
    return { refunded: false, reason: e instanceof Error ? e.message : 'unknown_error' }
  } finally {
    client.release()
  }
}
