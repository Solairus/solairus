import { pool } from '../db'
import type { Transaction } from '../types'
import { getConnection } from '../lib/rpc-manager'
import { PublicKey } from '@solana/web3.js'
import solairusPayIdl from '../idl/solairus_pay.json'
import { deriveReference, findSignatureByReference, verifyTokenDelta, finalizeRecovery, finalizeRefund } from './withdrawal_verifier'

export async function attemptExpiredBucketWithdrawalRefund(orderId: string): Promise<{ refunded: boolean; reason?: string }> {
  const client = await pool.connect()
  try {
    const txRes = await client.query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
    const record = txRes.rows[0]
    if (!record) return { refunded: false, reason: 'record_not_found' }
    if (record.type !== 'role_withdrawal') return { refunded: false, reason: 'not_bucket_withdrawal' }
    if (record.status !== 'pending') return { refunded: false, reason: 'not_pending' }
    if (record.metadata && (record.metadata as any)['refund_finalized'] === true) return { refunded: false, reason: 'refund_finalized' }

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
    if (now <= expiresAt) return { refunded: false, reason: 'not_expired' }

    const PROGRAM_ID = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!
    const referenceStr = (record.metadata && (record.metadata as any)['reference']) as string | undefined
    const reference = referenceStr ? new PublicKey(referenceStr) : deriveReference(orderId, PROGRAM_ID)
    const conn = await getConnection()
    const sig = await findSignatureByReference(conn, reference)
    if (sig) {
      const valid = await verifyTokenDelta(conn, sig, record.initiator_wallet, record.mint_address, BigInt(record.amount), record.decimals || 6)
      if (valid) {
        await finalizeRecovery(client, record.id, sig, { recoveredVia: 'reference', recoveredAt: new Date().toISOString() })
        return { refunded: false, reason: 'recovered_signature' }
      }
    }

    await client.query('BEGIN')
    // Refund bucket balance back (single final action)
    const bucketType = (record.metadata as any)?.bucket_type as string
    if (!bucketType) {
      await client.query('ROLLBACK')
      return { refunded: false, reason: 'missing_bucket_type' }
    }

    // Lock and update bucket balance
    const sel = await client.query(`SELECT ${bucketType} FROM bucket_balances WHERE id = 1 FOR UPDATE`)
    const current = sel.rows[0][bucketType]
    const amountMicro = BigInt(record.amount)
    const newVal = (BigInt(current || '0') + amountMicro).toString()
    await client.query(`UPDATE bucket_balances SET ${bucketType} = $1 WHERE id = 1`, [newVal])
    // Insert bucket history snapshot
    await client.query(
      'INSERT INTO bucket_histories (bucket_ref, amount, bucket_balance, transaction_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [bucketType, record.amount.toString(), newVal, record.id]
    )

    await finalizeRefund(client, record.id, { refund: true, refund_finalized: true, failureReason: 'Expired; no on-chain signature found', refundAt: now.toISOString(), reference: reference.toBase58(), bucket_type: bucketType })
    await client.query('COMMIT')
    return { refunded: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    return { refunded: false, reason: e instanceof Error ? e.message : 'unknown_error' }
  } finally {
    client.release()
  }
}