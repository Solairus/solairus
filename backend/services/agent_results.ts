import { pool } from '../db'
import crypto from 'crypto'

const MAX_HIT_PROB = Number(process.env.AGENT_MAX_HIT_PROB ?? '0.05')
const MIN_HIT_PROB = Number(process.env.AGENT_MIN_HIT_PROB ?? '0.65')

function randomBp(min: number, max: number): number {
  if (min >= max) return min
  const pUnitsTotal = 10000
  let minUnits = Math.round(MIN_HIT_PROB * pUnitsTotal)
  const maxUnits = Math.round(MAX_HIT_PROB * pUnitsTotal)
  let midUnits = pUnitsTotal - minUnits - maxUnits
  const hasMid = (max - min) > 1
  if (!hasMid) { minUnits += midUnits; midUnits = 0 }
  const r = crypto.randomInt(0, pUnitsTotal)
  if (r < minUnits) return min
  if (r < minUnits + midUnits) {
    const midCount = max - min - 1
    const idx = crypto.randomInt(0, midCount)
    return min + 1 + idx
  }
  return max
}

export async function runDailyAgentEarnings(): Promise<{ processed: number; credited: number; skipped: number }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Load agents with tiers and their last reward time
    const agentsRes = await client.query(
      `SELECT a.id AS agent_id, a.amount AS amount_micro, a.total_earned AS total_earned_micro, a.created_at AS agent_created_at,
              a.tier_id, t.daily_reward_min_bp AS min_bp, t.daily_reward_max_bp AS max_bp,
              (SELECT created_at FROM agent_results ar WHERE ar.agent_id = a.id ORDER BY created_at DESC LIMIT 1) as last_reward_at
         FROM agents a
         JOIN agent_tiers t ON a.tier_id = t.id
        WHERE a.status = 'active'`
    )
    let processed = 0
    let credited = 0
    let skipped = 0

    const now = Date.now()
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    for (const row of agentsRes.rows as Array<{
      agent_id: number
      amount_micro: string | number
      total_earned_micro: string | number
      agent_created_at: string | Date
      tier_id: number
      min_bp: number
      max_bp: number
      last_reward_at: string | Date | null
    }>) {
      processed++

      // Check 24h cooldown
      const lastRewardTime = row.last_reward_at ? new Date(row.last_reward_at).getTime() : null
      const agentCreatedTime = new Date(row.agent_created_at).getTime()

      // If never rewarded, use creation time as baseline
      const baselineTime = lastRewardTime ?? agentCreatedTime
      const nextEligibleTime = baselineTime + ONE_DAY_MS

      if (now < nextEligibleTime) {
        skipped++
        continue
      }

      const min = Number(row.min_bp)
      const max = Number(row.max_bp)
      const bp = randomBp(min, max)
      const amountMicro = typeof row.amount_micro === 'number' ? BigInt(Math.round(row.amount_micro)) : BigInt(String(row.amount_micro))
      const resultMicro = (amountMicro * BigInt(bp)) / 10000n

      // Try to insert result for today (UTC); skip if already exists
      const ins = await client.query(
        `INSERT INTO agent_results(agent_id, result_micro, percent_bp, claimed)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (agent_id, (timezone('UTC', created_at)::date)) DO NOTHING`,
        [row.agent_id, resultMicro.toString(), bp]
      )

      if (ins.rowCount === 1) {
        credited++
        // Increment agent total_earned
        await client.query(
          `UPDATE agents SET total_earned = (COALESCE(total_earned, 0) + $2)
            WHERE id = $1`,
          [row.agent_id, resultMicro.toString()]
        )
      } else {
        skipped++
      }
    }

    await client.query('COMMIT')
    return { processed, credited, skipped }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { })
    throw e
  } finally {
    client.release()
  }
}
