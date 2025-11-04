/**
 * Affiliate router: Summary of affiliate earnings from backend DB
 * Purpose: Provide aggregated bonus balance and per-level earnings (no on-chain)
 * Security: Protected by JWT (requireAuth applied at server wiring)
 */
import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

/**
 * GET /affiliate/summary
 * Returns aggregated affiliate earnings for the authenticated user:
 * - bonus_balance_micro: current bonus bucket balance
 * - total_earnings_affiliate_micro: total credited affiliate earnings (L1–L3)
 * - total_withdrawn_micro: total debited from bonus bucket (withdrawals/adjustments)
 * - available_to_withdraw_micro: current available (same as bonus_balance)
 * - per_level_micro: breakdown for L1, L2, L3 credits
 */
router.get('/affiliate/summary', async (_req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string } | undefined
    if (!auth?.sub || !auth?.addr) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get balances row for the user
    const balRes = await query<{ id: number; bonus_balance: string | number }>(
      'SELECT id, bonus_balance FROM balances WHERE user_id = $1 LIMIT 1',
      [auth.sub]
    )
    const balanceRow = balRes.rows[0]
    const balanceId = balanceRow?.id ?? null
    const bonusBalanceStr = balanceRow ? String(balanceRow.bonus_balance ?? '0') : '0'

    let totalAffiliateCredits = '0'
    let totalDebits = '0'
    let perLevel: Record<string, string> = {}

    if (balanceId) {
      // Total affiliate credits into bonus bucket
      const totalCreditsSql = `
        SELECT COALESCE(SUM(amount::bigint), 0)::text AS total
        FROM balance_history
        WHERE balance_id = $1
          AND metadata->>'bucket' = 'bonus'
          AND metadata->>'action' = 'credit'
          AND metadata->>'source' = 'affiliate'
      `
      const totalCreditsRes = await query<{ total: string }>(totalCreditsSql, [balanceId])
      totalAffiliateCredits = totalCreditsRes.rows[0]?.total ?? '0'

      // Total debits from bonus bucket COUNTING ONLY confirmed user withdrawals
      // Joins transactions to ensure failed/refunded are excluded
      const totalDebitsSql = `
        SELECT COALESCE(SUM(bh.amount::bigint), 0)::text AS total
        FROM balance_history bh
        JOIN transactions t ON t.id = bh.transaction_id
        WHERE bh.balance_id = $1
          AND bh.metadata->>'bucket' = 'bonus'
          AND bh.metadata->>'action' = 'debit'
          AND t.type = 'user_withdrawal'
          AND t.status = 'confirmed'
      `
      const totalDebitsRes = await query<{ total: string }>(totalDebitsSql, [balanceId])
      totalDebits = totalDebitsRes.rows[0]?.total ?? '0'

      // Per-level breakdown for affiliate credits
      const perLevelSql = `
        SELECT metadata->>'level' AS level, COALESCE(SUM(amount::bigint), 0)::text AS sum_micro
        FROM balance_history
        WHERE balance_id = $1
          AND metadata->>'bucket' = 'bonus'
          AND metadata->>'action' = 'credit'
          AND metadata->>'source' = 'affiliate'
        GROUP BY level
      `
      const perLevelRes = await query<{ level: string | null; sum_micro: string }>(perLevelSql, [balanceId])
      perLevel = {}
      for (const row of perLevelRes.rows) {
        if (!row.level) continue
        perLevel[row.level] = row.sum_micro ?? '0'
      }
    }

    return res.json({
      bonus_balance_micro: bonusBalanceStr,
      total_earnings_affiliate_micro: String(totalAffiliateCredits),
      total_withdrawn_micro: String(totalDebits),
      available_to_withdraw_micro: bonusBalanceStr,
      per_level_micro: perLevel,
    })
  } catch (err) {
    console.error('[affiliate] summary error', err)
    return res.status(500).json({ error: 'Failed to fetch affiliate summary' })
  }
})

export default router

/**
 * GET /affiliate/referrals
 * Purpose: Return direct referrals (pubkeys) for the authenticated user.
 * Logic: users where ref_by === current user's id.
 * Output: { referrals: string[] }
 */
router.get('/affiliate/referrals', async (_req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { sub?: number; addr?: string } | undefined
    if (!auth?.sub) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { rows } = await query<{ user_address: string }>(
      'SELECT user_address FROM users WHERE ref_by = $1 ORDER BY created_at DESC',
      [auth.sub]
    )
    const referrals = rows.map(r => r.user_address)
    return res.json({ referrals })
  } catch (err) {
    console.error('[affiliate] referrals error', err)
    return res.status(500).json({ error: 'Failed to fetch referrals' })
  }
})