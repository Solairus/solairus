import { Router, Request, Response } from 'express'
import { resolvePendingWithdrawalsForWallet } from '../services/pending_withdrawals_resolver'

const router = Router()

router.post('/withdrawals/pending/resolve', async (req: Request, res: Response) => {
  try {
    const walletAddress = String(req.body?.walletAddress || '')
    if (!walletAddress || walletAddress.length < 32) return res.status(400).json({ error: 'Invalid walletAddress' })
    await resolvePendingWithdrawalsForWallet(walletAddress)
    return res.status(200).end()
  } catch (e) {
    // Silent failure: still return 200 to avoid blocking UI
    return res.status(200).end()
  }
})

export default router