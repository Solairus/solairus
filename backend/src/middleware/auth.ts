/**
 * JWT auth middleware
 * Purpose: Require Bearer token for protected API calls
 * Attaches: res.locals.auth = { sub, addr }
 */
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Missing Bearer token' })

    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })

    const decoded = jwt.verify(token, secret) as jwt.JwtPayload
    const payload = decoded as jwt.JwtPayload & { addr?: string }
    const sub = payload.sub ? Number(payload.sub) : undefined
    const addrClaim = payload.addr
    if (!sub || !addrClaim) return res.status(401).json({ error: 'Invalid token payload' })
    res.locals.auth = { sub, addr: addrClaim }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}