import { pool, query } from '../db'
import { Transaction } from '../types'
import { Connection, PublicKey } from '@solana/web3.js'
import { getWorkingConnection } from '../lib/rpc-manager'
import { applyBalanceBucketChange, getOrCreateBalanceId } from './balance'

/**
 * Attempt to refund an expired/failed agent withdrawal.
 * Strategy:
 * 1. Verify on-chain that the transaction DEFINITELY failed (or never happened).
 * 2. If safe, mark transaction as 'failed'.
 * 3. Credit the amount to the user's `reward_balance`.
 *    - We do NOT unclaim the agent_results because they are aggregated.
 *    - Crediting reward_balance is a safe fallback that allows the user to withdraw later via normal flow.
 */
export async function attemptExpiredAgentWithdrawalRefund(tx: Transaction): Promise<{ refunded: boolean; reason: string }> {
    if (tx.type !== 'agent_claim' || tx.status !== 'pending') {
        return { refunded: false, reason: 'invalid type or status' }
    }

    const meta = tx.metadata as { order_id?: string; reference?: string; agent_id?: number }
    if (!meta.order_id || !meta.reference) {
        return { refunded: false, reason: 'missing metadata' }
    }

    const connection = await getWorkingConnection()
    const refPubkey = new PublicKey(meta.reference)

    // 1. On-Chain Verification
    // Check if any signature exists for this reference
    const sigs = await connection.getSignaturesForAddress(refPubkey, { limit: 5 })

    // Filter for successful signatures
    const successfulSig = sigs.find(s => !s.err)

    if (successfulSig) {
        // Transaction succeeded on-chain! Update DB to confirmed.
        await query('UPDATE transactions SET status = $1, signature = $2, updated_at = NOW() WHERE id = $3', [
            'confirmed',
            successfulSig.signature,
            tx.id,
        ])
        return { refunded: false, reason: 'transaction confirmed on-chain' }
    }

    // If we found signatures but they all failed (err != null), or no signatures found:
    // We can proceed to refund.
    // Note: Race condition risk if tx is currently in flight. 
    // The caller (cron) should ensure sufficient time has passed (TTL) before calling this.

    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        // Lock transaction row
        const txRes = await client.query<Transaction>('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [tx.id])
        const lockedTx = txRes.rows[0]
        if (lockedTx.status !== 'pending') {
            await client.query('ROLLBACK')
            return { refunded: false, reason: 'status changed concurrently' }
        }

        // Mark as failed/refunded
        await client.query('UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', tx.id])

        // Credit reward_balance
        // We need to find the user_id. The transaction has initiator_wallet.
        // Better to fetch user from initiator_wallet
        const userRes = await client.query<{ id: number }>('SELECT id FROM users WHERE user_address = $1', [lockedTx.initiator_wallet])
        const userId = userRes.rows[0]?.id

        if (userId) {
            const balanceId = await getOrCreateBalanceId(client, userId)
            const refundAmount = BigInt(lockedTx.amount) // This is the amountMicro

            await applyBalanceBucketChange(
                client,
                balanceId,
                'reward_balance', // Refund to reward bucket
                'credit',
                refundAmount,
                Number(tx.id),
                { reason: 'agent_claim_refund', original_order_id: meta.order_id }
            )
        } else {
            console.error(`[Refund] User not found for wallet ${lockedTx.initiator_wallet}, cannot credit balance.`)
            // We still mark tx as failed, but money is technically "lost" to the user unless manual intervention.
        }

        await client.query('COMMIT')
        return { refunded: true, reason: 'refunded to reward_balance' }

    } catch (e) {
        await client.query('ROLLBACK')
        console.error('[Refund] Error processing agent refund:', e)
        return { refunded: false, reason: `db error: ${e instanceof Error ? e.message : String(e)}` }
    } finally {
        client.release()
    }
}
