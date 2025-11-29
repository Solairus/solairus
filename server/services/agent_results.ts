import { pool } from '../db'
import crypto from 'crypto'

const MAX_HIT_PROB = Number(process.env.AGENT_MAX_HIT_PROB ?? '0.10')

function randomBp(min: number, max: number): number {
  // max has ~10% probability; other values uniform over [min, max-1]
  if (min >= max) return min
  const p1000 = crypto.randomInt(0, 1000)
  const p = p1000 / 1000
  if (p < MAX_HIT_PROB) return max
  return crypto.randomInt(min, max) // upper bound exclusive, so returns [min, max-1]
}

export async function runDailyAgentEarnings(): Promise<{ processed: number; credited: number; skipped: number }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Load agents with tiers in one go
    const agentsRes = await client.query(
      `SELECT a.id AS agent_id, a.amount AS amount_micro, a.total_earned AS total_earned_micro, a.tier_id,
              t.daily_reward_min_bp AS min_bp, t.daily_reward_max_bp AS max_bp
         FROM agents a
         JOIN agent_tiers t ON a.tier_id = t.id`
    )
    let processed = 0
    let credited = 0
    let skipped = 0

    for (const row of agentsRes.rows as Array<{ agent_id: number; amount_micro: string | number; total_earned_micro: string | number; tier_id: number; min_bp: number; max_bp: number }>) {
      processed++
      const min = Number(row.min_bp)
      const max = Number(row.max_bp)
      const bp = randomBp(min, max)
      const amountMicro = typeof row.amount_micro === 'number' ? BigInt(Math.round(row.amount_micro)) : BigInt(String(row.amount_micro))
      const resultMicro = (amountMicro * BigInt(bp)) / 10000n

      // Try to insert result for today (UTC); skip if already exists
      const ins = await client.query(
        `INSERT INTO agent_results(agent_id, result_micro, bp_used, claimed)
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
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
