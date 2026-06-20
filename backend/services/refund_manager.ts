import { pool } from '../db'
import type { Transaction } from '../types'
import { applyBalanceBucketChange, getOrCreateBalanceId } from './balance'
import { finalizeRecovery, finalizeRefund } from './onchain_verifier'
import { microBigIntToDecimalString } from './amount'
import type { BucketRef } from './bucket'

/**
 * Refund Manager
 * Unified service for handling refunds of expired withdrawals (user and bucket/role).
 */

export async function attemptExpiredWithdrawalRefund(orderId: string): Promise<{ refunded: boolean; reason?: string }> {
    return processRefund(orderId, 'user_withdrawal')
}

export async function attemptExpiredBucketWithdrawalRefund(orderId: string): Promise<{ refunded: boolean; reason?: string }> {
    return processRefund(orderId, 'role_withdrawal')
}

async function processRefund(orderId: string, expectedType: 'user_withdrawal' | 'role_withdrawal'): Promise<{ refunded: boolean; reason?: string }> {
    const client = await pool.connect()
    try {
        const txRes = await client.query<Transaction>(
            'SELECT * FROM transactions WHERE order_id = $1 LIMIT 1 FOR UPDATE',
            [orderId]
        )
        const record = txRes.rows[0]
        if (!record) return { refunded: false, reason: 'record_not_found' }

        // Type check
        if (expectedType === 'user_withdrawal') {
            if (!(record.type === 'user_withdrawal' || record.type === 'role_withdrawal' || record.type === 'agent_claim')) {
                return { refunded: false, reason: 'not_withdrawal' }
            }
        } else {
            if (record.type !== 'role_withdrawal') return { refunded: false, reason: 'not_bucket_withdrawal' }
        }

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

        await client.query('BEGIN')

        if (record.type === 'agent_claim') {
            // Revert agent claim state
            const meta = record.metadata as Record<string, unknown>
            const activationId = meta['activationId'] as number
            const claimedResultIds = meta['claimed_result_ids'] as number[] | undefined
            const previousClaimedAt = meta['previous_claimed_at'] as string | null

            if (activationId) {
                // 1. Revert agent_results claimed status
                if (claimedResultIds && claimedResultIds.length > 0) {
                    await client.query(
                        `UPDATE agent_results SET claimed = FALSE WHERE id = ANY($1::int[])`,
                        [claimedResultIds]
                    )
                }

                // 2. Revert agent last_claimed_at
                await client.query(
                    `UPDATE agents SET last_claimed_at = $2 WHERE id = $1`,
                    [activationId, previousClaimedAt]
                )
            }
        } else if (record.type === 'role_withdrawal' && expectedType === 'role_withdrawal') {
            // Bucket withdrawal refund
            const bucketType = (record.metadata as Record<string, unknown> | null)?.['bucket_type'] as string
            if (!bucketType) {
                await client.query('ROLLBACK')
                return { refunded: false, reason: 'missing_bucket_type' }
            }

            const decimals = record.decimals || 6
            const rawAmount = record.amount as unknown
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

            // Dynamic import to avoid circular dependency if any
            const { applyBucketChange } = await import('./bucket')
            await applyBucketChange(client, bucketType as BucketRef, 'credit', amountUsdt, record.id)

            // Monitoring
            const asNum = Number(amountUsdt)
            if (Number.isFinite(asNum) && asNum > 1_000_000) {
                console.warn(`[Refund Monitor] Unusually large role_withdrawal refund: ${amountUsdt} USDT for order ${orderId}`)
            }

        } else {
            // Standard user withdrawal refund
            // Lookup user id from wallet
            const userRes = await client.query<{ id: number }>(
                'SELECT id FROM users WHERE user_address = $1 LIMIT 1',
                [record.initiator_wallet]
            )
            const user = userRes.rows[0]
            if (!user) {
                await client.query('ROLLBACK')
                return { refunded: false, reason: 'user_not_found' }
            }

            const balanceId = await getOrCreateBalanceId(client, user.id)
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
        }

        // Mark transaction failed + refunded in metadata
        await finalizeRefund(client, record.id, {
            refund: true,
            refund_finalized: true,
            failureReason: 'Expired; no on-chain signature found',
            refundAt: now.toISOString(),
        })

        await client.query('COMMIT')
        return { refunded: true }
    } catch (e) {
        await client.query('ROLLBACK').catch(() => { })
        return { refunded: false, reason: e instanceof Error ? e.message : 'unknown_error' }
    } finally {
        client.release()
    }
}
