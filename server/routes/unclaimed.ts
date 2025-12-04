import { Router, Request, Response } from 'express'
import { pool } from '../db'

const router = Router()

// GET /api/users/:address/agents/unclaimed
router.get('/users/:address/agents/unclaimed', async (req: Request, res: Response) => {
  const { address } = req.params
  try {
    const client = await pool.connect()
    try {
      const q = await client.query(
        `SELECT COALESCE(SUM(ar.result_micro), 0) AS unclaimed_micro
           FROM agent_results ar
           JOIN agents a ON a.id = ar.agent_id
           JOIN users u ON u.id = a.user_id
          WHERE u.user_address = $1 AND ar.claimed = FALSE`,
        [address]
      )
      const micro = BigInt(q.rows[0]?.unclaimed_micro ?? 0)
      const usd = Number(micro) / 1_000_000
      return res.json({ unclaimed_micro: micro.toString(), unclaimed_usd: usd.toFixed(6) })
    } finally {
      client.release()
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
})

export default router

