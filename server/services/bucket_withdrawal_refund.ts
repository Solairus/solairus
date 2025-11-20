import { pool } from '../db'
import type { Transaction } from '../types'
import { getConnection } from '../lib/rpc-manager'
import { PublicKey } from '@solana/web3.js'
import solairusPayIdl from '../idl/solairus_pay.json'
import { deriveReference, findSignatureByReference, verifyTokenDelta, finalizeRecovery, finalizeRefund } from './withdrawal_verifier'
import { toMicroBigInt, microBigIntToDecimalString } from './amount'

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
      const decimals = record.decimals || 6
      // role_withdrawal: record.amount is stored in micro units; do not rescale here
      const amtMicro = (() => {
        const val = record.amount as any
        if (typeof val === 'number') return BigInt(Math.round(val))
        const s = String(val).trim()
        return s ? BigInt(s) : 0n
      })()
      const valid = await verifyTokenDelta(conn, sig, record.initiator_wallet, record.mint_address, amtMicro, decimals)
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

    // Special case: role_withdrawal refunds must convert micro → unit before bucket credit
    const decimals = record.decimals || 6
    // Validate input is micro units (integer count)
    const rawAmount = record.amount as any
    const isValidMicro = (() => {
      if (typeof rawAmount === 'number') return Number.isInteger(rawAmount)
      const s = String(rawAmount)
      return /^-?\d+$/.test(s)
    })()
    if (!isValidMicro || decimals !== 6) {
      await finalizeRefund(client, record.id, { refund: false, failureReason: 'invalid_input_units', expected: 'micro', got: rawAmount, decimals })
      await client.query('ROLLBACK')
      return { refunded: false, reason: 'invalid_input_units' }
    }
    const amountMicro = typeof rawAmount === 'number' ? BigInt(Math.round(rawAmount)) : BigInt(String(rawAmount))
    const amountUsdt = microBigIntToDecimalString(amountMicro, decimals)
    const postBalance = await (await import('./bucket')).applyBucketChange(client, bucketType as any, 'credit', amountUsdt, record.id)

    // Monitoring: annotate conversion details and warn on unusually large amounts
    try {
      const asNum = Number(amountUsdt)
      if (Number.isFinite(asNum) && asNum > 1_000_000) {
        console.warn(`[Refund Monitor] Unusually large role_withdrawal refund: ${amountUsdt} USDT for order ${orderId}`)
      }
    } catch {}

    await finalizeRefund(client, record.id, {
      refund: true,
      refund_finalized: true,
      failureReason: 'Expired; no on-chain signature found',
      refundAt: now.toISOString(),
      reference: reference.toBase58(),
      bucket_type: bucketType,
      refund_amount_micro: amountMicro.toString(),
      refund_amount_usdt: amountUsdt,
      conversion_applied: true,
    })
    await client.query('COMMIT')
    return { refunded: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    return { refunded: false, reason: e instanceof Error ? e.message : 'unknown_error' }
  } finally {
    client.release()
  }
}