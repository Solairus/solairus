/**
 * Auth routes: wallet-based signup/login
 * Purpose: Silently authenticate on wallet connect; create user if missing
 * Inputs: { walletAddress, sponsorPubkey? } body
 * Outputs: { jwt, user }
 */
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { query } from '../db'
import { getBackendAuthorityPublicKey } from '../lib/solana'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Base58-like validation for Solana addresses (32–44 chars); optional sponsor
const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const AuthSchema = z.object({
  walletAddress: z.string().min(32).max(64).regex(base58Regex, 'Invalid wallet address'),
  sponsorPubkey: z.string().min(32).max(64).regex(base58Regex, 'Invalid sponsor pubkey').optional(),
})

function issueJwt(payload: { sub: number; addr: string }) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  // 1 hour expiry
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' })
}

// Sanitize user payload: omit id, created_at, updated_at
interface UserRow {
  id: number
  user_address: string
  license_status: string
  license_expiration: string | null
  ref_by: string | null
  created_at?: string
  updated_at?: string
}
async function getBonusBalanceMicro(userId: number): Promise<string> {
  try {
    const res = await query<{ bonus_balance: string | number }>('SELECT bonus_balance FROM balances WHERE user_id = $1 LIMIT 1', [userId])
    const raw = res.rows[0]?.bonus_balance ?? 0
    // Return as string to avoid BigInt precision issues in JSON
    return typeof raw === 'number' ? String(raw) : (raw ?? '0')
  } catch (_e) {
    // If balances row doesn't exist yet, default to 0
    return '0'
  }
}

async function sanitizeUser(row: UserRow) {
  const bonus_balance_micro = await getBonusBalanceMicro(row.id)
  const credit_balance_micro = await (async () => {
    try {
      const res = await query<{ credit_balance: string | number }>('SELECT credit_balance FROM balances WHERE user_id = $1 LIMIT 1', [row.id])
      const raw = res.rows[0]?.credit_balance ?? 0
      return typeof raw === 'number' ? String(raw) : (raw ?? '0')
    } catch (_e) {
      return '0'
    }
  })()
  return {
    user_address: row.user_address,
    license_status: row.license_status,
    license_expiration: row.license_expiration,
    ref_by: row.ref_by ?? null,
    bonus_balance_micro,
    credit_balance_micro,
  }
}

router.post('/auth/wallet', async (req: Request, res: Response) => {
  try {
    const parsed = AuthSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const addr = parsed.data.walletAddress

    // Try to find existing user first
    const existing = await query('SELECT * FROM users WHERE user_address = $1 LIMIT 1', [addr])
    let user = existing.rows[0]

    // Concurrency-safe user creation: UPSERT on unique user_address
    if (!user) {
      const upsert = await query(
        `INSERT INTO users (user_address, license_status, license_expiration)
         VALUES ($1, 'none', NULL)
         ON CONFLICT (user_address) DO UPDATE SET user_address = EXCLUDED.user_address
         RETURNING *`,
        [addr]
      )
      user = upsert.rows[0]

      // Fallback in rare case RETURNING doesn't produce a row
      if (!user) {
        const fetched = await query('SELECT * FROM users WHERE user_address = $1 LIMIT 1', [addr])
        user = fetched.rows[0]
      }

      // Signup-only sponsor assignment
      // Purpose: link new user to a registered sponsor if provided and valid
      const sponsor = parsed.data.sponsorPubkey
      if (sponsor) {
        try {
          // Prevent self-referral: if sponsor === addr, set ref_by to dev
          if (sponsor === addr) {
            try {
              const devAuthority = await getBackendAuthorityPublicKey()
              const devUserRes = await query<{ id: number }>('SELECT id FROM users WHERE user_address = $1 LIMIT 1', [devAuthority])
              const devUser = devUserRes.rows[0]
              if (devUser && devUser.id) {
                await query('UPDATE users SET ref_by = $2 WHERE id = $1 AND ref_by IS NULL', [user.id, devUser.id])
                const refreshed = await query<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.id])
                user = refreshed.rows[0] as unknown as UserRow
              } else {
                console.warn('[auth/wallet] dev user not found for self-referral fallback')
              }
            } catch (e) {
              console.warn('[auth/wallet] failed to resolve dev authority for self-referral:', e)
            }
          } else {
            // Normal sponsor assignment flow: ensure sponsor pubkey exists as a registered user
            const sponsorRes = await query<{ id: number }>('SELECT id FROM users WHERE user_address = $1 LIMIT 1', [sponsor])
            const sponsorRow = sponsorRes.rows[0]
            if (sponsorRow && sponsorRow.id) {
              await query('UPDATE users SET ref_by = $2 WHERE id = $1 AND ref_by IS NULL', [user.id, sponsorRow.id])
              // refresh user payload with updated ref_by
              const refreshed = await query<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.id])
              user = refreshed.rows[0] as unknown as UserRow
            }
          }
        } catch (err) {
          // Non-fatal: ignore sponsor assignment errors
          console.warn('[auth/wallet] sponsor assignment skipped:', err)
        }
      }
    }

    if (!user) return res.status(500).json({ error: 'Failed to create or fetch user' })

    const token = issueJwt({ sub: user.id, addr })
    const sanitized = await sanitizeUser(user as UserRow)
    return res.json({ jwt: token, user: sanitized })
  } catch (err) {
    console.error('[auth/wallet] error', err)
    return res.status(500).json({ error: 'Wallet auth failed' })
  }
})

/**
 * GET /api/auth/session
 * Purpose: Validate JWT and return the current user record.
 * Inputs: Authorization: Bearer <token>
 * Outputs: { jwtValid: true, user }
 */
router.get('/auth/session', requireAuth, async (req: Request, res: Response) => {
  try {
    const { sub } = res.locals.auth as { sub: number; addr: string }
    const { rows } = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [sub])
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    const sanitized = await sanitizeUser(rows[0] as UserRow)
    return res.json({ jwtValid: true, user: sanitized })
  } catch (err) {
    console.error('[auth/session] error', err)
    return res.status(500).json({ error: 'Session check failed' })
  }
})

export default router