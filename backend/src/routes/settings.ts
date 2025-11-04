/**
 * Settings router: Read-only public settings
 * Purpose: Expose admin-managed settings to the frontend
 * Notes: Returns only key, value, type; excludes internal timestamps
 */
import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const sql = 'SELECT key, value, type FROM settings ORDER BY key ASC'
    const { rows } = await query<{ key: string; value: unknown; type: string }>(sql)
    return res.json(rows)
  } catch (err) {
    console.error('[settings] fetch error', err)
    return res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

export default router