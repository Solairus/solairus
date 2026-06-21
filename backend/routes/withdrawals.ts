/**
 * Withdrawals router (contract-free)
 * Purpose: Pay a user out from the treasury hot wallet. No user signing, no destination
 *          field — the recipient is always the user's stored login wallet (users.user_address).
 * Types:
 *  - 'balance'   : debit bonus_balance by amountMicro, pay it out.
 *  - 'agent_roi' : claim an agent's unclaimed ROI (agent_results), pay it out.
 * Flow: reserve funds atomically (tx=processing) → sendUsdt(treasury→user) →
 *       success: tx=confirmed+signature; pre-broadcast failure: revert + tx=failed;
 *       post-broadcast uncertainty: leave processing for admin reconciliation.
 */
import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import crypto from 'crypto'
import { query, pool } from '../db'
import {
  sendUsdt,
  isValidSolAddress,
  recipientUsdtAtaExists,
  RecipientAtaMissingError,
} from '../lib/usdt-transfer'
import { ataSetupRequiredPayload, isPostBroadcastError } from '../lib/withdrawal-gate'

const router = Router()

const InitSchema = z.object({
  type: z.enum(['balance', 'agent_roi']).default('balance'),
  amountMicro: z.number().int().positive().optional(), // required for balance
  activationId: z.number().int().positive().optional(), // required for agent_roi
  memo: z.string().max(128).optional(),
})

interface Reservation {
  txId: number
  orderId: string
  amountMicro: bigint
  // revert context
  type: 'balance' | 'agent_roi'
  agentId?: number
  prevClaimedAt?: string | null
}

router.post('/withdrawals/init', async (req: Request, res: Response) => {
  const parsed = InitSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const auth = res.locals.auth as { sub: number; addr: string }
  if (!auth?.addr || !auth?.sub) return res.status(401).json({ error: 'Unauthorized' })

  // Recipient is ALWAYS the stored login wallet — read fresh, validate on-curve.
  const userRow = await query<{ user_address: string }>('SELECT user_address FROM users WHERE id = $1 LIMIT 1', [auth.sub])
  const recipient = userRow.rows[0]?.user_address
  if (!recipient) return res.status(404).json({ error: 'User not found' })
  if (!isValidSolAddress(recipient)) return res.status(400).json({ error: 'Stored wallet address is not a valid payout destination' })

  // ── Phase 0: ATA gate (RULE: platform never pays recipient-ATA rent) ────────
  // If the user's wallet has no USDT account, return the one-time setup step BEFORE
  // reserving any funds — nothing is debited until their account exists.
  try {
    const { exists, ata, mint } = await recipientUsdtAtaExists(new PublicKey(recipient))
    if (!exists) {
      return res.status(200).json(ataSetupRequiredPayload(recipient, ata.toBase58(), mint.toBase58()))
    }
  } catch (e) {
    // RPC hiccup on the pre-check: don't block here — sendUsdt has the same guard in Phase 2.
    console.warn('[withdrawals/init] ATA pre-check failed (continuing):', e instanceof Error ? e.message : e)
  }

  const { type } = parsed.data
  const orderId = crypto.randomUUID()

  // ── Phase 1: reserve funds atomically (committed) ──────────────────────────
  let reservation: Reservation
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (type === 'agent_roi') {
      const activationId = parsed.data.activationId
      if (!activationId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Missing activationId' }) }

      // Block if a claim is already in flight for this agent (prevents double-claim).
      const inflight = await client.query(
        `SELECT id FROM transactions
           WHERE type = 'agent_claim' AND status = 'processing' AND (metadata->>'activationId')::int = $1
           LIMIT 1`,
        [activationId]
      )
      if (inflight.rows.length > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'A withdrawal for this agent is already processing' }) }

      const agentRes = await client.query(
        `SELECT a.id, a.user_id, a.status, a.claimed_at, a.activated_at, a.created_at
           FROM agents a WHERE a.id = $1 AND a.user_id = $2 FOR UPDATE`,
        [activationId, auth.sub]
      )
      const agent = agentRes.rows[0]
      if (!agent) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Agent not found' }) }
      if (agent.status !== 'active') throw new Error('Agent is not active')

      // 24h cooldown
      const lastClaimTime = agent.claimed_at ? new Date(agent.claimed_at).getTime() : new Date(agent.activated_at || agent.created_at).getTime()
      const ONE_DAY_MS = 24 * 60 * 60 * 1000
      if (Date.now() - lastClaimTime < ONE_DAY_MS) throw new Error('Cooldown active: please wait 24h between claims')

      const resultsRes = await client.query<{ id: number; result_micro: string }>(
        'SELECT id, result_micro FROM agent_results WHERE agent_id = $1 AND claimed = FALSE',
        [activationId]
      )
      const amountMicro = resultsRes.rows.reduce((sum, r) => sum + BigInt(r.result_micro), 0n)
      if (amountMicro <= 0n) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No ROI available to withdraw' }) }

      // User withdrawal limit
      const userLimitRes = await client.query<{ agent_pnl_withdrawal_enabled: boolean | null; agent_pnl_withdrawal_limit: string | null }>(
        'SELECT agent_pnl_withdrawal_enabled, agent_pnl_withdrawal_limit FROM users WHERE id = $1',
        [auth.sub]
      )
      const userLimit = userLimitRes.rows[0]
      if (userLimit) {
        if (userLimit.agent_pnl_withdrawal_enabled === false) throw new Error('Withdrawal unavailable')
        if (userLimit.agent_pnl_withdrawal_limit !== null) {
          const withdrawnRes = await client.query<{ total: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS total FROM transactions
               WHERE initiator_wallet = $1 AND type = 'agent_claim' AND status IN ('confirmed','completed')`,
            [auth.addr]
          )
          const totalWithdrawn = BigInt(withdrawnRes.rows[0]?.total || '0')
          const limit = BigInt(userLimit.agent_pnl_withdrawal_limit)
          if (totalWithdrawn + amountMicro > limit) {
            const remaining = limit > totalWithdrawn ? limit - totalWithdrawn : 0n
            throw new Error(`Withdrawal limit exceeded. Remaining limit: ${(Number(remaining) / 1_000_000).toFixed(2)} USDT`)
          }
        }
      }

      const prevClaimedAt: string | null = agent.claimed_at ?? null
      await client.query('UPDATE agent_results SET claimed = TRUE WHERE agent_id = $1 AND claimed = FALSE', [activationId])
      await client.query('UPDATE agents SET claimed_at = NOW() WHERE id = $1', [activationId])

      const meta = { route: 'withdrawals.init', order_id: orderId, agent_id: agent.id, activationId, recipient, phase: 'processing' }
      const ins = await client.query<{ id: number }>(
        `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
         VALUES ('agent_claim','processing',NULL,$1,$2,NULL,$3::bigint,$4,6,$5::jsonb,$6) RETURNING id`,
        [auth.addr, recipient, amountMicro.toString(), process.env.USDT_MINT_ADDRESS || 'USDT', JSON.stringify(meta), orderId]
      )
      reservation = { txId: ins.rows[0].id, orderId, amountMicro, type: 'agent_roi', agentId: agent.id, prevClaimedAt }
    } else {
      // balance withdrawal — debit bonus_balance
      const amountMicro = parsed.data.amountMicro ? BigInt(parsed.data.amountMicro) : 0n
      if (amountMicro <= 0n) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'amountMicro is required for balance withdrawal' }) }

      const balRes = await client.query('SELECT id FROM balances WHERE user_id = $1 FOR UPDATE', [auth.sub])
      let balanceId: number
      if (balRes.rowCount === 1) {
        balanceId = Number(balRes.rows[0].id)
      } else {
        const insBal = await client.query('INSERT INTO balances (user_id, bonus_balance, reward_balance, credit_balance, total_earnings) VALUES ($1,0,0,0,0) RETURNING id', [auth.sub])
        balanceId = Number(insBal.rows[0].id)
      }
      const upd = await client.query(
        'UPDATE balances SET bonus_balance = bonus_balance - $1, updated_at = NOW() WHERE id = $2 AND bonus_balance >= $1 RETURNING bonus_balance AS post_balance',
        [amountMicro.toString(), balanceId]
      )
      if (upd.rowCount !== 1) throw new Error('Insufficient bonus_balance to withdraw')
      const postBalance = upd.rows[0].post_balance as string

      const meta = { route: 'withdrawals.init', order_id: orderId, recipient, phase: 'processing' }
      const ins = await client.query<{ id: number }>(
        `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
         VALUES ('user_withdrawal','processing',NULL,$1,$2,NULL,$3::bigint,$4,6,$5::jsonb,$6) RETURNING id`,
        [auth.addr, recipient, amountMicro.toString(), process.env.USDT_MINT_ADDRESS || 'USDT', JSON.stringify(meta), orderId]
      )
      const txId = ins.rows[0].id
      await client.query(
        'INSERT INTO balance_history (balance_id, amount, balance, transaction_id, metadata) VALUES ($1,$2,$3,$4,$5)',
        [balanceId, amountMicro.toString(), postBalance, txId, JSON.stringify({ reason: 'withdrawal_init', order_id: orderId, action: 'debit', bucket: 'bonus' })]
      )
      reservation = { txId, orderId, amountMicro, type: 'balance' }
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[withdrawals/init] reserve error (${type}):`, e)
    return res.status(400).json({ error: msg })
  } finally {
    client.release()
  }

  // ── Phase 2: pay out from treasury ─────────────────────────────────────────
  try {
    const { signature } = await sendUsdt({ toAddress: recipient, amountMicro: reservation.amountMicro })
    await query("UPDATE transactions SET status='confirmed', signature=$1, metadata = metadata || '{\"phase\":\"confirmed\"}'::jsonb WHERE id=$2", [signature, reservation.txId])
    return res.status(201).json({
      orderId: reservation.orderId,
      signature,
      amountMicro: Number(reservation.amountMicro),
      toAddress: recipient,
      roiAmount: type === 'agent_roi' ? Number(reservation.amountMicro) / 1_000_000 : undefined,
    })
  } catch (e) {
    // Recipient still has no USDT account (pre-check missed it / race). Not an error —
    // revert the reservation and return the one-time setup step so the user can retry.
    if (e instanceof RecipientAtaMissingError) {
      await revertReservation(reservation, auth.sub).catch((re) => console.error('[withdrawals/init] revert failed', re))
      return res.status(200).json(ataSetupRequiredPayload(recipient, e.recipientAta.toBase58(), e.mint.toBase58()))
    }
    if (isPostBroadcastError(e)) {
      // Uncertain — leave 'processing'; admin reconciles against chain. Never re-credit.
      await query("UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id=$2",
        [JSON.stringify({ payout_uncertain: e instanceof Error ? e.message : String(e), at: new Date().toISOString() }), reservation.txId]).catch(() => {})
      console.error('[withdrawals/init] payout uncertain (left processing)', { orderId: reservation.orderId, txId: reservation.txId })
      return res.status(202).json({ orderId: reservation.orderId, status: 'processing', message: 'Payout submitted; confirmation pending. It will be reconciled automatically.' })
    }
    // Pre-broadcast failure — safe to revert the reservation.
    await revertReservation(reservation, auth.sub).catch((re) => console.error('[withdrawals/init] revert failed', re))
    const msg = e instanceof Error ? e.message : 'Payout failed'
    console.error('[withdrawals/init] payout failed (reverted)', { orderId: reservation.orderId, error: msg })
    return res.status(502).json({ error: `Payout failed: ${msg}` })
  }
})

async function revertReservation(r: Reservation, userId: number): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (r.type === 'balance') {
      const balRes = await client.query('SELECT id FROM balances WHERE user_id = $1 FOR UPDATE', [userId])
      if (balRes.rowCount === 1) {
        const balanceId = Number(balRes.rows[0].id)
        const upd = await client.query('UPDATE balances SET bonus_balance = bonus_balance + $1, updated_at = NOW() WHERE id = $2 RETURNING bonus_balance AS post_balance', [r.amountMicro.toString(), balanceId])
        const postBalance = upd.rows[0]?.post_balance as string
        await client.query('INSERT INTO balance_history (balance_id, amount, balance, transaction_id, metadata) VALUES ($1,$2,$3,$4,$5)',
          [balanceId, r.amountMicro.toString(), postBalance, r.txId, JSON.stringify({ reason: 'withdrawal_revert', order_id: r.orderId, action: 'credit', bucket: 'bonus' })])
      }
    } else if (r.type === 'agent_roi' && r.agentId) {
      await client.query('UPDATE agent_results SET claimed = FALSE WHERE agent_id = $1 AND claimed = TRUE', [r.agentId])
      await client.query('UPDATE agents SET claimed_at = $1 WHERE id = $2', [r.prevClaimedAt, r.agentId])
    }
    await client.query("UPDATE transactions SET status='failed', metadata = metadata || '{\"phase\":\"failed\"}'::jsonb WHERE id=$1", [r.txId])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export default router
