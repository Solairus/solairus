import { pool } from '../db'
import type { Transaction } from '../types'
import { Connection, PublicKey } from '@solana/web3.js'
import { getConnection } from '../lib/rpc-manager'
import { attemptExpiredWithdrawalRefund } from './withdrawal_refund'
import { attemptExpiredBucketWithdrawalRefund } from './bucket_withdrawal_refund'
import solairusPayIdl from '../idl/solairus_pay.json'
import { deriveReference, findSignatureByReference, verifyTokenDelta, finalizeRecovery, finalizeRefund } from './withdrawal_verifier'

function getTtlMs(record: Transaction): number {
  const m = record.metadata as Record<string, unknown> | null
  const v = m && (m['ttlMs'] as number | string | undefined)
  if (typeof v === 'number') return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
  return 120_000
}

export async function resolvePendingWithdrawalsForWallet(walletAddress: string): Promise<void> {
  const client = await pool.connect()
  try {
    const { rows } = await client.query<Transaction>(
      `SELECT * FROM transactions
       WHERE initiator_wallet = $1
         AND status = 'pending'
         AND type IN ('user_withdrawal','role_withdrawal')`,
      [walletAddress]
    )

    if (!rows.length) return

    const conn: Connection = await getConnection()
    const programId = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!

    for (const record of rows) {
      // Skip if refund already finalized
      if (record.metadata && (record.metadata as any)['refund_finalized'] === true) continue

      const ttlMs = getTtlMs(record)
      const expiresAt = new Date(new Date(record.created_at).getTime() + ttlMs)
      const now = new Date()

      // If we have a signature recorded, check confirmation and finalize
      if (record.signature) {
        const statusResp = await conn.getSignatureStatuses([record.signature], { searchTransactionHistory: true })
        const s = statusResp.value[0]
        const isConfirmed = s && !s.err && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')
        if (isConfirmed) {
          const valid = await verifyTokenDelta(conn, record.signature, record.initiator_wallet, record.mint_address, BigInt(record.amount), record.decimals || 6)
          if (valid) {
            await finalizeRecovery(client, record.id, record.signature, { completed: true, verified: true })
            continue
          }
        }
        // If not confirmed and expired, fall through to refund path below
      }

      // No signature or not confirmed and expired
      if (now <= expiresAt) continue

      // Try to find signature by reference (if metadata has reference; else derive from orderId)
      const refStr = (record.metadata && (record.metadata as any)['reference']) as string | undefined
      const reference = refStr ? new PublicKey(refStr) : (record.order_id ? deriveReference(record.order_id, programId) : null)
      if (reference) {
        const sig = await findSignatureByReference(conn, reference)
        if (sig) {
          const valid = await verifyTokenDelta(conn, sig, record.initiator_wallet, record.mint_address, BigInt(record.amount), record.decimals || 6)
          if (valid) {
            await finalizeRecovery(client, record.id, sig, { completed: true, recoveredVia: 'reference' })
            continue
          }
        }
      }

      // Refund, type-specific
      if (record.type === 'role_withdrawal') {
        await attemptExpiredBucketWithdrawalRefund(record.order_id!)
      } else {
        await attemptExpiredWithdrawalRefund(record.order_id!)
      }
    }
  } finally {
    client.release()
  }
}