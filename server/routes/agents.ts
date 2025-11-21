/**
 * Agents routes: PnL summary for dashboard banner
 * Purpose: Compute backend-driven progress data for the current user.
 * Inputs: Authorization Bearer JWT (requireAuth attaches res.locals.auth { sub, addr })
 * Outputs: WithdrawalLimitDisplay-compatible payload for UI rendering
 */
import { Router, Request, Response } from 'express'
import { query, pool } from '../db'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { applyBalanceBucketChange, getOrCreateBalanceId } from '../services/balance'

const router = Router()

function toUsdString(micro: bigint): string {
  const num = Number(micro) / 1_000_000
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * GET /agents/pnl-summary
 * Derives global liquidity, PnL, target and usage for the authenticated user.
 * - totalDeposits: sum of active agents amounts (micro USDT -> formatted USD)
 * - totalWithdrawn: user's total earnings (balances.total_earnings -> formatted USD)
 * - maxWithdrawable: 200% of totalDeposits
 * - remainingWithdrawable: maxWithdrawable - totalWithdrawn (clamped at 0)
 * - usagePercentage: totalWithdrawn / maxWithdrawable * 100 (0 if max=0)
 * - limitReached: usagePercentage >= 100
 * - isPrivileged: future hook; default false
 * - warningLevel/statusMessage: derived from usagePercentage
 */
router.get('/agents/pnl-summary', async (req: Request, res: Response) => {
  try {
    const { sub } = res.locals.auth as { sub: number; addr: string }
    if (!sub) return res.status(401).json({ error: 'Unauthorized' })

    // Sum active agent deposits (micro USDT)
    const depRes = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM agents WHERE user_id = $1 AND status = 'active'`,
      [sub]
    )
    const totalDepositsMicro = BigInt((depRes.rows[0]?.total as unknown as string) ?? '0')

    // Fetch user's total earnings from balances (micro USDT)
    const balRes = await query<{ total_earnings: string }>(
      `SELECT COALESCE(total_earnings, 0)::bigint AS total_earnings FROM balances WHERE user_id = $1 LIMIT 1`,
      [sub]
    )
    const totalWithdrawnMicro = BigInt((balRes.rows[0]?.total_earnings as unknown as string) ?? '0')

    const maxWithdrawableMicro = totalDepositsMicro * 2n
    const remainingMicro = maxWithdrawableMicro > totalWithdrawnMicro ? maxWithdrawableMicro - totalWithdrawnMicro : 0n

    const maxWithdrawableNum = Number(maxWithdrawableMicro) / 1_000_000
    const totalWithdrawnNum = Number(totalWithdrawnMicro) / 1_000_000
    const usagePercentage = maxWithdrawableNum > 0 ? Math.min((totalWithdrawnNum / maxWithdrawableNum) * 100, 100) : 0
    const limitReached = usagePercentage >= 100
    const isPrivileged = false // TODO: wire roles when available

    // Derive warning level and status message
    let warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none'
    let statusMessage = 'Withdrawal limit healthy'
    if (isPrivileged) {
      warningLevel = 'none'
      statusMessage = 'Unlimited withdrawals (privileged account)'
    } else if (limitReached) {
      warningLevel = 'critical'
      statusMessage = 'Withdrawal limit reached'
    } else if (usagePercentage >= 90) {
      warningLevel = 'critical'
      statusMessage = 'Approaching withdrawal limit'
    } else if (usagePercentage >= 75) {
      warningLevel = 'high'
      statusMessage = 'High withdrawal usage'
    } else if (usagePercentage >= 50) {
      warningLevel = 'medium'
      statusMessage = 'Moderate withdrawal usage'
    } else if (usagePercentage >= 25) {
      warningLevel = 'low'
      statusMessage = 'Low withdrawal usage'
    }

    return res.json({
      totalDeposits: toUsdString(totalDepositsMicro),
      totalWithdrawn: toUsdString(totalWithdrawnMicro),
      maxWithdrawable: isPrivileged ? 'Unlimited' : toUsdString(maxWithdrawableMicro),
      remainingWithdrawable: isPrivileged ? 'Unlimited' : toUsdString(remainingMicro),
      usagePercentage,
      limitReached,
      isPrivileged,
      warningLevel,
      statusMessage,
    })
  } catch (err) {
    console.error('[agents/pnl-summary] error', err)
    return res.status(500).json({ error: 'Failed to compute PnL summary' })
  }
})

/**
 * GET /balances/credit
 * Returns the authenticated user's credit balance (micro USDT)
 */
router.get('/balances/credit', async (req: Request, res: Response) => {
  try {
    const { sub } = res.locals.auth as { sub: number; addr: string }
    if (!sub) return res.status(401).json({ error: 'Unauthorized' })

    const balRes = await query<{ credit_balance: string }>(
      'SELECT COALESCE(credit_balance, 0)::bigint AS credit_balance FROM balances WHERE user_id = $1 LIMIT 1',
      [sub]
    )
    const credit = BigInt((balRes.rows[0]?.credit_balance as unknown as string) ?? '0')
    return res.json({ creditBalanceMicro: credit.toString() })
  } catch (err) {
    console.error('[balances/credit] error', err)
    return res.status(500).json({ error: 'Failed to fetch credit balance' })
  }
})

/**
 * GET /agents/:activationId/roi
 * Returns a placeholder ROI value (0) for the specified agent, scoped to the authenticated user.
 */
router.get('/agents/:activationId/roi', async (req: Request, res: Response) => {
  try {
    const { sub } = res.locals.auth as { sub: number; addr: string }
    if (!sub) return res.status(401).json({ error: 'Unauthorized' })

    const activationId = Number(req.params.activationId)
    if (!Number.isFinite(activationId) || activationId <= 0) {
      return res.status(400).json({ error: 'Invalid activationId' })
    }

    const row = await query<{ id: number }>(
      'SELECT id FROM agents WHERE id = $1 AND user_id = $2 LIMIT 1',
      [activationId, sub]
    )
    if (row.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    return res.json({ activationId, roi: 0 })
  } catch (err) {
    console.error('[agents/:activationId/roi] error', err)
    return res.status(500).json({ error: 'Failed to fetch agent ROI' })
  }
})

/**
 * GET /agents/user/:userAddress
 * Returns active agents for the authenticated user with per-agent PnL progress.
 * - Validates the requested wallet matches the authenticated address
 * - Joins agent_tiers to retrieve reward_cap_bp (basis points)
 * - Computes yield_cap_progress_pct = min((total_earned/amount)*100, reward_cap_bp/100)
 * - Flags yield_cap_reached when progress >= cap
 */
router.get('/agents/user/:userAddress', async (req: Request, res: Response) => {
  try {
    const { sub, addr } = res.locals.auth as { sub: number; addr: string }
    if (!sub) return res.status(401).json({ error: 'Unauthorized' })

    const requestedAddr = (req.params.userAddress || '').toLowerCase()
    if (!requestedAddr || requestedAddr !== addr?.toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden: wallet mismatch' })
    }

    // Pull active agents for this user, including tier cap
    const sql = `
      SELECT 
        a.id,
        a.agent_label,
        a.status,
        a.amount::bigint AS amount,
        COALESCE(a.total_earned, 0)::bigint AS total_earned,
        a.tier_id,
        a.activated_at,
        a.created_at,
        a.claimed_at,
        a.metadata,
        t.reward_cap_bp,
        t.tier_name AS tier_name
      FROM agents a
      LEFT JOIN agent_tiers t ON t.id = a.tier_id
      WHERE a.user_id = $1 AND a.status = 'active'
      ORDER BY a.created_at DESC
    `
    const result = await query<{
      id: number
      agent_label: string
      status: string
      amount: string
      total_earned: string
      tier_id: number | null
      activated_at: string | null
      created_at: string
      metadata: Record<string, unknown> | null
      reward_cap_bp: number | null
      tier_name: string | null
      claimed_at: string | null
    }>(sql, [sub])

    const enriched = result.rows.map((row) => {
      const amountMicro = BigInt((row.amount as unknown as string) ?? '0')
      const earnedMicro = BigInt((row.total_earned as unknown as string) ?? '0')
      const capBp = row.reward_cap_bp ?? 20000 // default 200% if tier missing
      const capPct = capBp / 100

      const progressPctRaw = amountMicro > 0n ? (Number(earnedMicro) / Number(amountMicro)) * 100 : 0
      const yield_cap_progress_pct = Math.min(progressPctRaw, capPct)
      const yield_cap_reached = yield_cap_progress_pct >= capPct

      // Cooldown computation: next claim after 24 hours from claimed_at
      const claimedAtTs = row.claimed_at ? new Date(row.claimed_at).getTime() : new Date(row.activated_at ?? row.created_at).getTime()
      const nextClaimAtTs = claimedAtTs + (24 * 60 * 60 * 1000)
      const nowTs = Date.now()
      const remainingMs = Math.max(0, nextClaimAtTs - nowTs)
      const can_claim = remainingMs === 0

      return {
        id: row.id,
        label: row.agent_label,
        status: row.status,
        amount: Number(amountMicro) / 1_000_000,
        total_earned: Number(earnedMicro) / 1_000_000,
        reward_cap_bp: capBp,
        yield_cap_progress_pct,
        yield_cap_reached,
        tier_id: row.tier_id,
        tier_name: row.tier_name,
        activated_at: row.activated_at,
        created_at: row.created_at,
        claimed_at: row.claimed_at,
        next_claim_at: new Date(nextClaimAtTs).toISOString(),
        remaining_ms: remainingMs,
        can_claim,
        metadata: row.metadata,
      }
    })

    return res.json({ agents: enriched })
  } catch (err) {
    console.error('[agents/user] error', err)
    return res.status(500).json({ error: 'Failed to fetch user agents' })
  }
})

router.post('/agents/activate', async (req: Request, res: Response) => {
  const auth = res.locals.auth as { sub: number; addr: string }
  if (!auth?.sub || !auth?.addr) return res.status(401).json({ error: 'Unauthorized' })

  const schema = z.object({
    amountMicro: z.number().int().positive(),
    paymentMethod: z.literal('credit'),
    tierId: z.number().int().positive().optional(),
    tierName: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { amountMicro } = parsed.data

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const userId = auth.sub

    const balanceId = await getOrCreateBalanceId(client, userId)
    const balRes = await client.query('SELECT credit_balance FROM balances WHERE id = $1 FOR UPDATE', [balanceId])
    const currentCredit = BigInt((balRes.rows[0]?.credit_balance as unknown as string) ?? '0')
    const required = BigInt(amountMicro)
    if (currentCredit < required) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Insufficient credit balance' })
    }

    let tierRow: { id: number | null; tier_name: string | null } = { id: null, tier_name: null }
    const tRes = await client.query<{ id: number; tier_name: string }>(
      'SELECT id, tier_name FROM agent_tiers WHERE $1::bigint BETWEEN min_amount AND max_amount LIMIT 1',
      [amountMicro]
    )
    tierRow = {
      id: tRes.rows[0]?.id ?? null,
      tier_name: tRes.rows[0]?.tier_name ?? null,
    }

    const orderId = randomUUID()
    const meta = {
      paymentMethod: 'credit',
      signature_label: 'credit_balance',
      tier_id: tierRow.id,
      tier_name: tierRow.tier_name,
      phase: 'created',
      completed: false,
    }

    const txIns = await client.query<{ id: number }>(
      `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
       VALUES ($1, $2, NULL, $3, NULL, NULL, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      ['agent_activation', 'confirmed', auth.addr, amountMicro, 'CREDITS', 6, JSON.stringify(meta), orderId]
    )
    const transactionId = txIns.rows[0]?.id
    if (!transactionId) {
      throw new Error('Failed to create transaction')
    }

    await applyBalanceBucketChange(
      client,
      balanceId,
      'credit_balance',
      'debit',
      BigInt(amountMicro),
      transactionId,
      { source: 'agent_activation_credit' }
    )

    const agentLabel = tierRow.tier_name ? `Agent ${tierRow.tier_name}` : 'Agent'
    const agentMeta = { transaction_id: transactionId, tier_id: tierRow.id, tier_name: tierRow.tier_name }
    const agentIns = await client.query<{ id: number }>(
      `INSERT INTO agents (user_id, agent_label, status, activation_signature, amount, tier_id, metadata)
       VALUES ($1, $2, 'active', NULL, $3, $4, $5::jsonb)
       RETURNING id`,
      [userId, agentLabel, amountMicro, tierRow.id, JSON.stringify(agentMeta)]
    )
    const agentId = agentIns.rows[0]?.id

    await client.query(
      'UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2',
      [JSON.stringify({ agent_id: agentId }), transactionId]
    )

    await client.query('COMMIT')

    return res.status(201).json({
      activated: true,
      agent: { id: agentId, amount: Number(amountMicro) / 1_000_000, tier_name: tierRow.tier_name },
      transaction: { id: transactionId, status: 'confirmed', order_id: orderId },
    })
  } catch (e) {
    await client.query('ROLLBACK')
    const msg = e instanceof Error ? e.message : 'Activation failed'
    return res.status(500).json({ error: msg })
  } finally {
    client.release()
  }
})

export default router
