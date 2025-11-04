/**
 * Agent tiers router: read-only listing of tier definitions.
 * Purpose: Expose tier ranges and reward parameters for UI consumption.
 * Outputs: Array of tiers without id/created_at/updated_at.
 */
import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

/**
 * GET /api/agents/tiers
 * Returns tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp
 */
router.get('/agents/tiers', async (_req: Request, res: Response) => {
  const sql = `
    SELECT tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp
    FROM agent_tiers
    ORDER BY min_amount ASC
  `
  const { rows } = await query(sql)
  return res.json(rows)
})

export default router