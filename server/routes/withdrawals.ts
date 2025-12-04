/**
 * Withdrawals router
 * Purpose: Initialize user withdrawal, create transaction record, debit bonus_balance,
 *          build partially-signed claim_rewards transaction, and return base64.
 * Inputs (JSON):
 *  - mintAddress: string (USDT mint)
 *  - amountMicro: number (integer, micro-USDT)
 *  - recipientAta: string (recipient USDT ATA; must exist)
 *  - memo?: string
 * Outputs:
 *  - { orderId, referencePubkey, txBase64, ttlMs }
 */
import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import crypto from 'crypto'
import solairusPayIdl from '../idl/solairus_pay.json'
import { getWorkingConnection } from '../lib/rpc-manager'
import { query, pool } from '../db'
import { buildClaimRewardsTx } from '../services/withdrawals'

const router = Router()

const InitSchema = z.object({
  type: z.enum(['balance', 'agent_roi']).default('balance'),
  mintAddress: z.string().min(32).max(64).optional(), // Optional for agent_roi (env dependent)
  amountMicro: z.number().int().positive().optional(), // Optional for agent_roi (calculated)
  recipientAta: z.string().min(32).max(64).optional(), // Optional for agent_roi (derived)
  memo: z.string().max(128).optional(),
  activationId: z.number().int().positive().optional(), // Required for agent_roi
})

function deriveReference(orderId: string, programId: string): string {
  const sha = crypto.createHash('sha256').update(orderId).digest()
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('withdraw'), sha], new PublicKey(programId))
  return pda.toBase58()
}

router.post('/withdrawals/init', async (req: Request, res: Response) => {
  const parsed = InitSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const auth = res.locals.auth as { sub: number; addr: string }
  if (!auth?.addr || !auth?.sub) return res.status(401).json({ error: 'Unauthorized' })

  const { type } = parsed.data
  const PROGRAM_ID = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!
  const orderId = crypto.randomUUID()
  const referencePubkey = deriveReference(orderId, PROGRAM_ID)

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let amountMicro = 0n
    let mintAddress = parsed.data.mintAddress
    let recipientAta = parsed.data.recipientAta
    let memo = parsed.data.memo || orderId
    let txType = 'user_withdrawal'
    const metadata: Record<string, unknown> = { route: 'withdrawals.init', order_id: orderId, reference: referencePubkey, phase: 'created', completed: false }

    // --- LOGIC BRANCHING BASED ON TYPE ---

    if (type === 'agent_roi') {
      const activationId = parsed.data.activationId
      if (!activationId) return res.status(400).json({ error: 'Missing activationId' })

      // Check for existing pending transaction for this agent
      const pendingTx = await client.query(
        `SELECT id, order_id, created_at, metadata FROM transactions 
         WHERE type = 'agent_claim' 
           AND status = 'pending' 
           AND (metadata->>'activationId')::int = $1
         LIMIT 1`,
        [activationId]
      )

      if (pendingTx.rows.length > 0) {
        const tx = pendingTx.rows[0]
        // Check if expired (TTL 2 mins)
        const createdAt = new Date(tx.created_at).getTime()
        const now = Date.now()
        const ttl = 120000 // 2 minutes

        if (now - createdAt > ttl) {
          console.log(`[Withdrawal] Found expired pending transaction ${tx.id}, attempting refund/revert...`)
          const { attemptExpiredWithdrawalRefund } = await import('../services/withdrawal_refund')
          const refundResult = await attemptExpiredWithdrawalRefund(tx.order_id)

          if (refundResult.refunded) {
            console.log(`[Withdrawal] Successfully reverted expired transaction ${tx.id}`)
          } else {
            console.warn(`[Withdrawal] Failed to revert expired transaction ${tx.id}: ${refundResult.reason}`)
            // If we couldn't revert, we probably shouldn't proceed with a new one immediately
            // But for now, let's let the user try again if it's really stuck
          }
        } else {
          return res.status(400).json({ error: 'Pending withdrawal in progress. Please wait.' })
        }
      }

      // Fetch agent and calculate ROI
      const agentRes = await client.query(
        `SELECT a.id, a.user_id, a.status, a.claimed_at, a.activated_at, a.created_at, a.tier_id, t.daily_reward_min_bp, t.daily_reward_max_bp 
         FROM agents a
         JOIN agent_tiers t ON a.tier_id = t.id
         WHERE a.id = $1 AND a.user_id = $2 FOR UPDATE`,
        [activationId, auth.sub]
      )
      const agent = agentRes.rows[0]
      if (!agent) return res.status(404).json({ error: 'Agent not found' })
      if (agent.status !== 'active') throw new Error('Agent is not active')

      // 3. Check Cooldown (24h)
      const lastClaimTime = agent.claimed_at ? new Date(agent.claimed_at).getTime() : new Date(agent.activated_at || agent.created_at).getTime()
      const now = Date.now()
      const ONE_DAY_MS = 24 * 60 * 60 * 1000
      if (now - lastClaimTime < ONE_DAY_MS) {
        throw new Error('Cooldown active: please wait 24h between claims')
      }

      // Calculate unclaimed ROI from agent_results
      const resultsRes = await client.query(
        `SELECT id, result_micro 
         FROM agent_results 
         WHERE agent_id = $1 AND claimed = FALSE`,
        [activationId]
      )

      const claimedResultIds = resultsRes.rows.map(r => r.id)
      const totalRoiMicro = resultsRes.rows.reduce((sum, r) => sum + BigInt(r.result_micro), 0n)

      if (totalRoiMicro <= 0n) {
        return res.status(400).json({ error: 'No ROI available to withdraw' })
      }

      // 4b. Check User Withdrawal Limits
      const userLimitRes = await client.query(
        'SELECT agent_pnl_withdrawal_enabled, agent_pnl_withdrawal_limit FROM users WHERE id = $1',
        [auth.sub]
      )
      const userLimit = userLimitRes.rows[0]
      if (userLimit) {
        if (userLimit.agent_pnl_withdrawal_enabled === false) {
          throw new Error('Withdrawal unavailable')
        }

        if (userLimit.agent_pnl_withdrawal_limit !== null) {
          const withdrawnRes = await client.query<{ total: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text as total 
              FROM transactions 
              WHERE initiator_wallet = $1 
              AND type = 'agent_claim' 
              AND status IN ('confirmed', 'completed')`,
            [auth.addr]
          )
          const totalWithdrawn = BigInt(withdrawnRes.rows[0]?.total || '0')
          const limit = BigInt(userLimit.agent_pnl_withdrawal_limit)

          if (totalWithdrawn + amountMicro > limit) {
            const remaining = limit > totalWithdrawn ? limit - totalWithdrawn : 0n
            const remainingUsdt = Number(remaining) / 1_000_000
            throw new Error(`Withdrawal limit exceeded. Remaining limit: ${remainingUsdt.toFixed(2)} USDT`)
          }
        }
      }

      // 5. Resolve Environment Variables
      const isMainnet = process.env.SOLANA_CLUSTER === 'mainnet-beta'
      mintAddress = isMainnet
        ? process.env.USDT_MINT
        : (process.env.USDT_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')

      if (!mintAddress) throw new Error("USDT Mint not configured")

      // 6. Derive Recipient ATA (if not provided)
      if (!recipientAta) {
        const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token')
        const userPubkey = new PublicKey(auth.addr)
        const mintPubkey = new PublicKey(mintAddress)
        recipientAta = getAssociatedTokenAddressSync(
          mintPubkey,
          userPubkey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ).toBase58()
      }

      // 7. Update Metadata & Type
      txType = 'agent_claim'
      memo = `agent_roi:${agent.id}:${orderId}`
      metadata.agent_id = agent.id

      // 8. Mark Results as Claimed (Atomic Update)
      await client.query(
        `UPDATE agent_results SET claimed = TRUE WHERE agent_id = $1 AND claimed = FALSE`,
        [agent.id]
      )
      await client.query(
        `UPDATE agents SET claimed_at = NOW() WHERE id = $1`,
        [agent.id]
      )

    } else {
      // --- BALANCE WITHDRAWAL (Default) ---
      if (!parsed.data.amountMicro || !parsed.data.mintAddress || !parsed.data.recipientAta) {
        throw new Error('amountMicro, mintAddress, and recipientAta are required for balance withdrawal')
      }
      amountMicro = BigInt(parsed.data.amountMicro)

      // Ensure user exists
      const userRes = await client.query('SELECT id FROM users WHERE id = $1', [auth.sub])
      if (userRes.rowCount === 0) throw new Error('User not found')

      // Resolve balances.id and Debit Bonus Balance
      const balRes = await client.query('SELECT id FROM balances WHERE user_id = $1 FOR UPDATE', [auth.sub])
      let balanceId: number
      if (balRes.rowCount === 1) {
        balanceId = Number(balRes.rows[0].id)
      } else {
        const insBal = await client.query(
          'INSERT INTO balances (user_id, bonus_balance, reward_balance, credit_balance, total_earnings) VALUES ($1, 0, 0, 0, 0) RETURNING id',
          [auth.sub]
        )
        balanceId = Number(insBal.rows[0].id)
      }

      const updateSql = `
        UPDATE balances
           SET bonus_balance = bonus_balance - $1,
               updated_at = NOW()
         WHERE id = $2 AND bonus_balance >= $1
         RETURNING bonus_balance AS post_balance
      `
      const upd = await client.query(updateSql, [amountMicro.toString(), balanceId])
      if (upd.rowCount !== 1) {
        throw new Error('Insufficient bonus_balance to withdraw')
      }
      const postBalanceStr = upd.rows[0].post_balance as string

      // Record History
      const histSql = `
        INSERT INTO balance_history (balance_id, amount, balance, transaction_id, metadata)
        VALUES ($1, $2, $3, NULL, $4) RETURNING id
      `
      // Note: transaction_id is linked later or we can do it in order. 
      // For simplicity in this unified flow, we'll link it via order_id if needed, 
      // but strictly we should insert transaction first. 
      // Let's create transaction record first below, then update history if possible, 
      // OR just insert history with NULL txId and rely on metadata link.
      // Existing code did tx first. Let's stick to that order.
    }

    // --- SHARED: BUILD TRANSACTION & RECORD ---

    // Build Transaction (Fail fast)
    // Note: buildClaimRewardsTx does not use DB client, safe to call here
    const built = await buildClaimRewardsTx({
      initiatorWallet: auth.addr,
      recipient: auth.addr,
      mintAddress: mintAddress!,
      amountMicro: Number(amountMicro),
      recipientAta: recipientAta!,
      memo: memo,
      referencePubkey,
    })

    // Create Transaction Record
    const insertSql = `
      INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      RETURNING id
    `
    metadata.ttlMs = built.ttlMs
    const insertParams = [
      txType,
      'pending',
      auth.addr,
      auth.addr,
      PROGRAM_ID,
      amountMicro.toString(),
      mintAddress,
      6,
      JSON.stringify(metadata),
      orderId,
    ]
    const ins = await client.query(insertSql, insertParams)
    const txId = Number(ins.rows[0].id)

    // If Balance Withdrawal, we need to log the history entry (now that we have txId)
    if (type === 'balance') {
      // We already debited above. Now log history.
      // We need balanceId again.
      const balRes = await client.query('SELECT id, bonus_balance FROM balances WHERE user_id = $1', [auth.sub])
      const balanceId = balRes.rows[0].id
      const postBalance = balRes.rows[0].bonus_balance

      const histSql = `
        INSERT INTO balance_history (balance_id, amount, balance, transaction_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `
      await client.query(histSql, [
        balanceId,
        amountMicro.toString(),
        postBalance,
        txId,
        JSON.stringify({ reason: 'withdrawal_init', order_id: orderId, reference: referencePubkey, action: 'debit', bucket: 'bonus' }),
      ])
    }

    await client.query('COMMIT')

    // Return Payload
    return res.status(201).json({
      orderId,
      referencePubkey,
      txBase64: built.txBase64,
      ttlMs: built.ttlMs,
      // Optional fields for agent ROI UI updates
      roiAmount: type === 'agent_roi' ? Number(amountMicro) / 1_000_000 : undefined
    })

  } catch (e) {
    await client.query('ROLLBACK')
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[withdrawals/init] error (${type}):`, e)
    return res.status(400).json({ error: msg })
  } finally {
    client.release()
  }
})

export default router
