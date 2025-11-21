/**
 * Admin routes: Complete database-backed admin operations
 * Purpose: Manage agent tiers, buckets, settings, and users without blockchain dependencies
 * Only bucket withdrawals remain blockchain-based for fund transfer security
 * Inputs: Express Request bodies, validated via zod schemas
 * Outputs: JSON responses with admin data or operation results
 */
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, pool } from '../db'
import { randomUUID } from 'crypto'
import { applyBalanceBucketChange, getOrCreateBalanceId } from '../services/balance'
import { PublicKey, Transaction } from '@solana/web3.js'
import crypto from 'crypto'
import solairusPayIdl from '../idl/solairus_pay.json'
import { buildClaimRewardsTx } from '../services/withdrawals'
import { getConnection } from '../lib/rpc-manager'

// Extend Request interface for admin middleware
declare module 'express' {
  interface Request {
    adminRole?: Role
    accessibleBuckets?: BucketType[]
  }
}

const router = Router()

// Role definitions based on .env pubkeys
// Admin and marketers are explicitly configured for restricted access.
// Dev role is recognized via DEV_ADDRESS or VITE_DEV_ADDRESS for local environments.
const ADMIN_PUBKEY = process.env.ADMIN_PUBKEY || ''
const MARKETER_1_PUBKEY = process.env.MARKETER_1_PUBKEY || ''
const MARKETER_2_PUBKEY = process.env.MARKETER_2_PUBKEY || ''
const DEV_ADDRESS = process.env.DEV_ADDRESS || process.env.VITE_DEV_ADDRESS || ''

type Role = 'admin' | 'dev' | 'marketer1' | 'marketer2' | 'none'
type BucketType = 'admin' | 'dev' | 'marketer1' | 'marketer2' | 'trader' | 'reserve'

// Get user role from wallet address
function getUserRole(walletAddress: string): Role {
  if (walletAddress === ADMIN_PUBKEY) return 'admin'
  if (DEV_ADDRESS && walletAddress === DEV_ADDRESS) return 'dev'
  if (walletAddress === MARKETER_1_PUBKEY) return 'marketer1'
  if (walletAddress === MARKETER_2_PUBKEY) return 'marketer2'
  // TODO: Check if wallet is the Solairus pay deployer (dev role)
  return 'none'
}

// Get accessible buckets for a role
function getAccessibleBuckets(role: Role): BucketType[] {
  switch (role) {
    case 'admin': return ['admin', 'trader', 'reserve', 'marketer1', 'marketer2']
    case 'dev': return ['admin', 'dev', 'trader', 'reserve', 'marketer1', 'marketer2']
    case 'marketer1': return ['marketer1']
    case 'marketer2': return ['marketer2']
    default: return []
  }
}

// Middleware to check admin access
function requireAdmin(req: Request, res: Response, next: (err?: Error) => void) {
  const auth = res.locals.auth as { sub: number; addr: string }
  if (!auth?.addr) return res.status(401).json({ error: 'Unauthorized' })

  const role = getUserRole(auth.addr)
  if (role === 'none') return res.status(403).json({ error: 'Admin access required' })

  req.adminRole = role
  req.accessibleBuckets = getAccessibleBuckets(role)
  next()
}

// Agent Tiers Schemas
const AgentTierSchema = z.object({
  tier_name: z.string().min(1).max(50),
  min_amount: z.number().int().min(0),
  max_amount: z.number().int().min(1),
  daily_reward_min_bp: z.number().int().min(0).max(10000),
  daily_reward_max_bp: z.number().int().min(0).max(10000),
  reward_cap_bp: z.number().int().min(10000).max(100000),
})

const AgentTierUpdateSchema = AgentTierSchema.partial()

// Settings Schemas
const SettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
  type: z.enum(['string', 'number', 'boolean', 'object']),
  description: z.string().optional(),
})

// User Management Schemas
const UserCreditSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().optional(),
})

const UserSponsorSchema = z.object({
  newSponsorAddress: z.string(),
})

const UserLicenseSchema = z.object({
  durationDays: z.number().int().min(1).max(3650),
  extendExisting: z.boolean().optional(),
})

// AGENT TIERS MANAGEMENT
router.get('/agent-tiers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT id, tier_name, min_amount, max_amount,
             daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp,
             created_at, updated_at
      FROM agent_tiers
      ORDER BY id
    `)
    res.json(rows)
  } catch (error) {
    console.error('Error fetching agent tiers:', error)
    res.status(500).json({ error: 'Failed to fetch agent tiers' })
  }
})

router.post('/agent-tiers', requireAdmin, async (req: Request, res: Response) => {
  const parsed = AgentTierSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    const { rows } = await query(`
      INSERT INTO agent_tiers (tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      parsed.data.tier_name,
      parsed.data.min_amount,
      parsed.data.max_amount,
      parsed.data.daily_reward_min_bp,
      parsed.data.daily_reward_max_bp,
      parsed.data.reward_cap_bp,
    ])
    res.status(201).json(rows[0])
  } catch (error) {
    console.error('Error creating agent tier:', error)
    if (error instanceof Error && error.message.includes('duplicate key')) {
      res.status(409).json({ error: 'Tier name already exists' })
    } else {
      res.status(500).json({ error: 'Failed to create agent tier' })
    }
  }
})

router.put('/agent-tiers/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tier ID' })

  const parsed = AgentTierUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    const updates = parsed.data
    const fields = Object.keys(updates)
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' })

    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ')
    const values = fields.map(field => updates[field as keyof typeof updates])

    const { rows } = await query(`
      UPDATE agent_tiers
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, ...values])

    if (rows.length === 0) return res.status(404).json({ error: 'Agent tier not found' })
    res.json(rows[0])
  } catch (error) {
    console.error('Error updating agent tier:', error)
    res.status(500).json({ error: 'Failed to update agent tier' })
  }
})

router.delete('/agent-tiers/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tier ID' })

  try {
    const { rowCount } = await query('DELETE FROM agent_tiers WHERE id = $1', [id])
    if (rowCount === 0) return res.status(404).json({ error: 'Agent tier not found' })
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting agent tier:', error)
    res.status(500).json({ error: 'Failed to delete agent tier' })
  }
})

// Alias paths to support frontend calls to /api/admin/agent-tiers
router.get('/admin/agent-tiers', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT id, tier_name, min_amount, max_amount,
             daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp,
             created_at, updated_at
      FROM agent_tiers
      ORDER BY id
    `)
    res.json(rows)
  } catch (error) {
    console.error('Error fetching agent tiers (alias):', error)
    res.status(500).json({ error: 'Failed to fetch agent tiers' })
  }
})

router.post('/admin/agent-tiers', requireAdmin, async (req: Request, res: Response) => {
  const parsed = AgentTierSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const { rows } = await query(`
      INSERT INTO agent_tiers (tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      parsed.data.tier_name,
      parsed.data.min_amount,
      parsed.data.max_amount,
      parsed.data.daily_reward_min_bp,
      parsed.data.daily_reward_max_bp,
      parsed.data.reward_cap_bp,
    ])
    res.status(201).json(rows[0])
  } catch (error) {
    console.error('Error creating agent tier (alias):', error)
    res.status(500).json({ error: 'Failed to create agent tier' })
  }
})

router.put('/admin/agent-tiers/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tier ID' })
  const parsed = AgentTierSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const { rows } = await query(`
      UPDATE agent_tiers
      SET tier_name = $1,
          min_amount = $2,
          max_amount = $3,
          daily_reward_min_bp = $4,
          daily_reward_max_bp = $5,
          reward_cap_bp = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      parsed.data.tier_name,
      parsed.data.min_amount,
      parsed.data.max_amount,
      parsed.data.daily_reward_min_bp,
      parsed.data.daily_reward_max_bp,
      parsed.data.reward_cap_bp,
      id,
    ])
    if (rows.length === 0) return res.status(404).json({ error: 'Agent tier not found' })
    res.json(rows[0])
  } catch (error) {
    console.error('Error updating agent tier (alias):', error)
    res.status(500).json({ error: 'Failed to update agent tier' })
  }
})

router.delete('/admin/agent-tiers/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tier ID' })
  try {
    const { rowCount } = await query('DELETE FROM agent_tiers WHERE id = $1', [id])
    if (rowCount === 0) return res.status(404).json({ error: 'Agent tier not found' })
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting agent tier (alias):', error)
    res.status(500).json({ error: 'Failed to delete agent tier' })
  }
})

// BUCKET MANAGEMENT
router.get('/buckets', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query('SELECT * FROM bucket_balances WHERE id = 1')
    if (rows.length === 0) {
      // Initialize if not exists
      await query(`
        INSERT INTO bucket_balances (admin, dev, marketer1, marketer2, trader, reserve)
        VALUES (0, 0, 0, 0, 0, 0)
      `)
      const { rows: newRows } = await query('SELECT * FROM bucket_balances WHERE id = 1')
      const filtered = filterBucketsByAccess(newRows[0], req.accessibleBuckets || [])
      return res.json(filtered)
    }
    const filtered = filterBucketsByAccess(rows[0], req.accessibleBuckets || [])
    res.json(filtered)
  } catch (error) {
    console.error('Error fetching bucket balances:', error)
    res.status(500).json({ error: 'Failed to fetch bucket balances' })
  }
})

// Alias path to support frontend calls to /api/admin/buckets (GET)
router.get('/admin/buckets', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query('SELECT * FROM bucket_balances WHERE id = 1')
    if (rows.length === 0) {
      // Initialize if not exists
      await query(`
        INSERT INTO bucket_balances (admin, dev, marketer1, marketer2, trader, reserve)
        VALUES (0, 0, 0, 0, 0, 0)
      `)
      const { rows: newRows } = await query('SELECT * FROM bucket_balances WHERE id = 1')
      const filtered = filterBucketsByAccess(newRows[0], req.accessibleBuckets || [])
      return res.json(filtered)
    }
    const filtered = filterBucketsByAccess(rows[0], req.accessibleBuckets || [])
    res.json(filtered)
  } catch (error) {
    console.error('Error fetching bucket balances (alias):', error)
    res.status(500).json({ error: 'Failed to fetch bucket balances' })
  }
})

// Helper to filter bucket object by accessible buckets
function filterBucketsByAccess(row: Record<string, any>, accessible: BucketType[]) {
  const base: Record<string, any> = {}
  // Always include id if present
  if (typeof row.id !== 'undefined') base.id = row.id

  // Only include buckets the role can access
  const keyMap: Record<string, string> = {
    marketer1: 'marketer_1',
    marketer2: 'marketer_2',
  }
  for (const key of accessible) {
    const col = keyMap[key] || key
    const val = row[col]
    base[key] = typeof val === 'undefined' ? '0' : val
  }

  return base
}

// Bucket withdrawal init (identical to affiliate withdrawal flow)
router.post('/buckets/:bucketType/withdraw/init', requireAdmin, async (req: Request, res: Response) => {
  const bucketType = req.params.bucketType as BucketType
  const accessibleBuckets = req.accessibleBuckets as BucketType[]

  if (!accessibleBuckets.includes(bucketType)) {
    return res.status(403).json({ error: 'Access denied to this bucket' })
  }

  const auth = res.locals.auth as { sub: number; addr: string }
  const parsed = z.object({
    amountMicro: z.number().int().positive(),
    mintAddress: z.string().min(32).max(64),
    recipientAta: z.string().min(32).max(64),
    memo: z.string().max(128).optional(),
  }).safeParse(req.body)

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const PROGRAM_ID = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!
  const orderId = crypto.randomUUID()
  const referencePubkey = deriveReference(orderId, PROGRAM_ID)

  // Build transaction first to fail fast
  let built
  try {
    built = await buildClaimRewardsTx({
      initiatorWallet: auth.addr,
      recipient: auth.addr,
      mintAddress: parsed.data.mintAddress,
      amountMicro: parsed.data.amountMicro,
      recipientAta: parsed.data.recipientAta,
      memo: parsed.data.memo,
      referencePubkey,
    })
    // Pre-simulate transaction to avoid sending a failing tx to the client
    try {
      const { getCurrentCluster } = await import('../lib/rpc-manager')
      if (getCurrentCluster() !== 'mainnet-beta') {
        return res.status(400).json({ error: 'Cluster mismatch: expected mainnet-beta' })
      }
      const conn = getConnection()
      const tx = Transaction.from(Buffer.from(built.txBase64, 'base64'))
      const sim = await conn.simulateTransaction(tx, { sigVerify: false })
      if (sim.value.err) {
        return res.status(400).json({ error: 'simulation_failed', logs: sim.value.logs || [], message: String(sim.value.err) })
      }
    } catch (simErr) {
      return res.status(400).json({ error: 'pre_simulation_error', message: simErr instanceof Error ? simErr.message : String(simErr) })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(400).json({ error: msg })
  }

  // Preflight: config PDA and vault funding
  try {
    const connection = getConnection()
    const mint = new PublicKey(parsed.data.mintAddress)
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], new PublicKey(PROGRAM_ID))
    const cfgInfo = await connection.getAccountInfo(configPda, 'confirmed')
    if (!cfgInfo) return res.status(400).json({ error: 'Config PDA not initialized on-chain' })
    // Backend authority sanity check: decode config and compare to server signer
    try {
      const { BorshCoder } = await import('@coral-xyz/anchor')
      const coder = new BorshCoder(solairusPayIdl as any)
      const decoded = coder.accounts.decode('Config', cfgInfo.data)
      const backendAuthOnChain = new PublicKey(decoded.backend_authority)
      const { getAuthorityKeypair } = await import('../lib/authority')
      const backendSigner = getAuthorityKeypair().publicKey
      if (!backendAuthOnChain.equals(backendSigner)) {
        return res.status(400).json({ error: 'Backend authority mismatch with config PDA' })
      }
    } catch (e) {
      return res.status(400).json({ error: 'Failed to validate backend authority in config' })
    }
    // Decode backend authority on-chain and compare to env
    // Decode backend authority on-chain (for internal comparison if needed)
    // const onChainBackend = new PublicKey(cfgInfo.data.slice(8, 8 + 32)).toBase58()
    const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from('vault'), mint.toBuffer()], new PublicKey(PROGRAM_ID))
    const vaultAta = PublicKey.findProgramAddressSync(
      [vaultAuth.toBuffer(), new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(), mint.toBuffer()],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    )[0]
    const bal = await connection.getTokenAccountBalance(vaultAta, 'confirmed').catch(() => null)
    const availableMicro = bal ? BigInt(bal.value.amount) : 0n
    if (availableMicro < BigInt(parsed.data.amountMicro)) {
      return res.status(400).json({ error: 'Vault underfunded for requested amount' })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(400).json({ error: msg })
  }

  // Debit bucket balance atomically (bucket_balances are NUMERIC(20,6) units)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check and debit bucket balance
    const amountUnits = parsed.data.amountMicro / 1_000_000
    const okRes = await client.query(
      `SELECT (${bucketType} >= $1::numeric) AS ok FROM bucket_balances WHERE id = 1 FOR UPDATE`,
      [amountUnits]
    )
    const ok = !!okRes.rows[0]?.ok
    if (!ok) {
      throw new Error('Insufficient bucket balance')
    }

    // Update bucket balance
    await client.query(
      `UPDATE bucket_balances SET ${bucketType} = ${bucketType} - $1::numeric WHERE id = 1`,
      [amountUnits]
    )

    // Get new balance for history
    const { rows: newBalanceRows } = await client.query(
      `SELECT ${bucketType} AS bal FROM bucket_balances WHERE id = 1`
    )
    const newBalanceUnits = newBalanceRows[0].bal

    // Create transaction record
    const { rows: txRows } = await client.query(`
      INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      'role_withdrawal',
      'pending',
      auth.addr,
      auth.addr,
      PROGRAM_ID,
      parsed.data.amountMicro,
      parsed.data.mintAddress,
      6,
      JSON.stringify({
        route: 'admin.buckets.withdraw.init',
        order_id: orderId,
        reference: referencePubkey,
        bucket_type: bucketType,
        ttlMs: 120000,
        phase: 'created',
        completed: false
      }),
      orderId,
    ])
    const txId = txRows[0].id

    // Insert bucket history
    await client.query(`
      INSERT INTO bucket_histories (bucket_ref, amount, bucket_balance, transaction_id, created_at)
      VALUES ($1, $2::numeric, $3::numeric, $4, NOW())
    `, [bucketType, -amountUnits, newBalanceUnits, txId])

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(400).json({ error: msg })
  } finally {
    client.release()
  }

  res.status(201).json({ orderId, referencePubkey, txBase64: built.txBase64, ttlMs: built.ttlMs })
})

// Alias route to match frontend path
router.post('/admin/buckets/:bucketType/withdraw/init', requireAdmin, async (req: Request, res: Response) => {
  // Delegate to the same handler by reusing logic block above
  // Copy the body to avoid duplication across files
  const auth = res.locals.auth as { sub: number; addr: string }
  const parsed = z.object({
    amountMicro: z.number().int().positive(),
    mintAddress: z.string().min(32).max(64),
    recipientAta: z.string().min(32).max(64),
    memo: z.string().max(128).optional(),
  }).safeParse(req.body)

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const PROGRAM_ID = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!
  const orderId = crypto.randomUUID()
  const referencePubkey = deriveReference(orderId, PROGRAM_ID)

  let built
  try {
    built = await buildClaimRewardsTx({
      initiatorWallet: auth.addr,
      recipient: auth.addr,
      mintAddress: parsed.data.mintAddress,
      amountMicro: parsed.data.amountMicro,
      recipientAta: parsed.data.recipientAta,
      memo: parsed.data.memo,
      referencePubkey,
    })
    // Pre-simulate transaction to avoid sending a failing tx to the client
    try {
      const { getCurrentCluster } = await import('../lib/rpc-manager')
      if (getCurrentCluster() !== 'mainnet-beta') {
        return res.status(400).json({ error: 'Cluster mismatch: expected mainnet-beta' })
      }
      const conn = getConnection()
      const tx = Transaction.from(Buffer.from(built.txBase64, 'base64'))
      const sim = await conn.simulateTransaction(tx, { sigVerify: false })
      if (sim.value.err) {
        return res.status(400).json({ error: 'simulation_failed', logs: sim.value.logs || [], message: String(sim.value.err) })
      }
    } catch (simErr) {
      return res.status(400).json({ error: 'pre_simulation_error', message: simErr instanceof Error ? simErr.message : String(simErr) })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(400).json({ error: msg })
  }

  const bucketType = req.params.bucketType as BucketType
  const amountUnits = parsed.data.amountMicro / 1_000_000

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const okRes = await client.query(
      `SELECT (${bucketType} >= $1::numeric) AS ok FROM bucket_balances WHERE id = 1 FOR UPDATE`,
      [amountUnits]
    )
    if (!okRes.rows[0]?.ok) throw new Error('Insufficient bucket balance')

    await client.query(
      `UPDATE bucket_balances SET ${bucketType} = ${bucketType} - $1::numeric WHERE id = 1`,
      [amountUnits]
    )
    const { rows: newBalanceRows } = await client.query(
      `SELECT ${bucketType} AS bal FROM bucket_balances WHERE id = 1`
    )
    const newBalanceUnits = newBalanceRows[0].bal

    const { rows: txRows } = await client.query(
      `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        'role_withdrawal',
        'pending',
        auth.addr,
        auth.addr,
        PROGRAM_ID,
        parsed.data.amountMicro,
        parsed.data.mintAddress,
        6,
        JSON.stringify({ route: 'admin.buckets.withdraw.init', order_id: orderId, reference: referencePubkey, bucket_type: bucketType, ttlMs: 120000, phase: 'created', completed: false }),
        orderId,
      ]
    )
    const txId = txRows[0].id

    await client.query(
      'INSERT INTO bucket_histories (bucket_ref, amount, bucket_balance, transaction_id, created_at) VALUES ($1, $2::numeric, $3::numeric, $4, NOW())',
      [bucketType, -amountUnits, newBalanceUnits, txId]
    )

    await client.query('COMMIT')
    res.status(201).json({ orderId, referencePubkey, txBase64: built.txBase64, ttlMs: built.ttlMs })
  } catch (e) {
    await client.query('ROLLBACK')
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg.includes('Insufficient bucket balance')) return res.status(400).json({ error: msg })
    console.error('Bucket withdrawal init error (alias):', e)
    res.status(500).json({ error: msg })
  } finally {
    client.release()
  }
})

// SETTINGS MANAGEMENT
router.get('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query('SELECT key, value, type, description FROM settings ORDER BY key')
    res.json(rows)
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// Alias path to support frontend calls to /api/admin/settings (GET)
router.get('/admin/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query('SELECT key, value, type, description FROM settings ORDER BY key')
    res.json(rows)
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

router.post('/settings', requireAdmin, async (req: Request, res: Response) => {
  const parsed = z.array(SettingSchema).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    const results = []
    for (const setting of parsed.data) {
      const { rows } = await query(`
        INSERT INTO settings (key, value, type, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          updated_at = NOW()
        RETURNING *
      `, [setting.key, JSON.stringify(setting.value), setting.type, setting.description])
      results.push(rows[0])
    }
    res.status(200).json(results)
  } catch (error) {
    console.error('Error saving settings:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// Alias path to support frontend calls to /api/admin/settings (POST)
router.post('/admin/settings', requireAdmin, async (req: Request, res: Response) => {
  const parsed = z.array(SettingSchema).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    const results = []
    for (const setting of parsed.data) {
      const { rows } = await query(`
        INSERT INTO settings (key, value, type, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          updated_at = NOW()
        RETURNING *
      `, [setting.key, JSON.stringify(setting.value), setting.type, setting.description])
      results.push(rows[0])
    }
    res.status(200).json(results)
  } catch (error) {
    console.error('Error saving settings:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// USER MANAGEMENT
router.get('/users/:address', requireAdmin, async (req: Request, res: Response) => {
  try {
    const address = req.params.address
    const { rows } = await query(`
      SELECT
        u.id,
        u.user_address,
        u.license_status,
        u.license_expiration,
        u.ref_by,
        s.user_address AS sponsor_address,
        u.created_at AS user_created_at,
        b.bonus_balance,
        b.reward_balance,
        b.credit_balance,
        b.total_earnings,
        b.created_at AS balance_created_at
      FROM users u
      LEFT JOIN users s ON u.ref_by = s.id
      LEFT JOIN balances b ON u.id = b.user_id
      WHERE u.user_address = $1
    `, [address])

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(rows[0])
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// Admin: searchable list of users
router.get('/admin/users/list', requireAdmin, async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim() || ''
  try {
    const { rows } = await query(`
      WITH agent_stats AS (
        SELECT 
          user_id,
          COUNT(*)::int AS total_agents,
          COALESCE(SUM(COALESCE(amount, NULLIF((metadata->>'amount'), '')::bigint)),0)::bigint AS total_agent_amount
        FROM agents
        WHERE status = 'active'
        GROUP BY user_id
      ),
      user_withdrawals AS (
        SELECT initiator_wallet, COALESCE(SUM(amount),0)::bigint AS total_withdrawn
        FROM transactions
        WHERE type = 'user_withdrawal' AND status IN ('confirmed','completed')
        GROUP BY initiator_wallet
      )
      SELECT
        u.user_address,
        s.user_address AS sponsor_address,
        u.license_status,
        u.license_expiration,
        COALESCE(ast.total_agents, 0) AS total_agents,
        COALESCE(ast.total_agent_amount, 0) AS total_agent_amount,
        u.created_at AS registration_date,
        COALESCE(uw.total_withdrawn, 0) AS total_withdrawn
      FROM users u
      LEFT JOIN users s ON u.ref_by = s.id
      LEFT JOIN agent_stats ast ON ast.user_id = u.id
      LEFT JOIN user_withdrawals uw ON uw.initiator_wallet = u.user_address
      WHERE $1 = '' OR u.user_address ILIKE ($1 || '%')
      ORDER BY u.created_at DESC
    `, [search])
    res.json(rows)
  } catch (error) {
    console.error('Error fetching users list:', error)
    res.status(500).json({ error: 'Failed to fetch users list' })
  }
})

router.post('/users/:address/credit', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UserCreditSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const address = req.params.address
  const amountMicro = BigInt(parsed.data.amount)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get or create user
    const { rows: userRows } = await client.query(
      'SELECT id FROM users WHERE user_address = $1', [address]
    )
    let userId: number

    if (userRows.length === 0) {
      const devAddress = process.env.DEV_ADDRESS || process.env.VITE_DEV_ADDRESS
      const { rows: newUserRows } = await client.query(
        'INSERT INTO users (user_address, ref_by) VALUES ($1, (SELECT id FROM users WHERE user_address = $2 LIMIT 1)) RETURNING id',
        [address, devAddress]
      )
      userId = newUserRows[0].id
    } else {
      userId = userRows[0].id
    }

    const balanceId = await getOrCreateBalanceId(client, userId)

    const orderId = randomUUID()
    const txIns = await client.query<{ id: number }>(
      `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
       VALUES ($1, $2, NULL, $3, NULL, NULL, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      ['admin_credit', 'confirmed', res.locals.auth.addr, amountMicro.toString(), 'CREDITS', 6, JSON.stringify({ source: 'admin_credit' }), orderId]
    )
    const transactionId = txIns.rows[0]?.id
    if (!transactionId) throw new Error('Failed to create transaction')

    const postBalance = await applyBalanceBucketChange(
      client,
      balanceId,
      'credit_balance',
      'credit',
      amountMicro,
      transactionId,
      { reason: 'admin_credit' }
    )

    await client.query('COMMIT')
    res.json({ success: true, new_balance: postBalance.toString(), order_id: orderId, transaction_id: transactionId })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error crediting user:', error)
    res.status(500).json({ error: 'Failed to credit user' })
  } finally {
    client.release()
  }
})

router.post('/users/:address/debit', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UserCreditSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const address = req.params.address
  const amountMicro = BigInt(parsed.data.amount)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: userRows } = await client.query(
      'SELECT id FROM users WHERE user_address = $1', [address]
    )
    if (userRows.length === 0) throw new Error('User not found')
    const userId: number = userRows[0].id

    const balanceId = await getOrCreateBalanceId(client, userId)

    const orderId = randomUUID()
    const txIns = await client.query<{ id: number }>(
      `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
       VALUES ($1, $2, NULL, $3, NULL, NULL, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      ['admin_debit', 'confirmed', res.locals.auth.addr, amountMicro.toString(), 'CREDITS', 6, JSON.stringify({ source: 'admin_debit' }), orderId]
    )
    const transactionId = txIns.rows[0]?.id
    if (!transactionId) throw new Error('Failed to create transaction')

    const postBalance = await applyBalanceBucketChange(
      client,
      balanceId,
      'credit_balance',
      'debit',
      amountMicro,
      transactionId,
      { reason: 'admin_debit' }
    )

    await client.query('COMMIT')
    res.json({ success: true, new_balance: postBalance.toString(), order_id: orderId, transaction_id: transactionId })
  } catch (error) {
    await client.query('ROLLBACK')
    const msg = error instanceof Error ? error.message : 'Unknown error'
    res.status(400).json({ error: msg })
  } finally {
    client.release()
  }
})

router.post('/users/:address/sponsor', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UserSponsorSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const address = req.params.address
  const newSponsorAddress = parsed.data.newSponsorAddress

  try {
    // Validate new sponsor exists
    const { rows: sponsorRows } = await query(
      'SELECT id FROM users WHERE user_address = $1', [newSponsorAddress]
    )
    if (sponsorRows.length === 0) {
      return res.status(400).json({ error: 'New sponsor address not found in system' })
    }

    // Update sponsor
    const { rows } = await query(
      'UPDATE users SET ref_by = $1, updated_at = NOW() WHERE user_address = $2 RETURNING *',
      [sponsorRows[0].id, address]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ success: true, user: rows[0] })
  } catch (error) {
    console.error('Error updating sponsor:', error)
    res.status(500).json({ error: 'Failed to update sponsor' })
  }
})

router.post('/users/:address/license', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UserLicenseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const address = req.params.address
  const { durationDays, extendExisting = false } = parsed.data

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get user
    const { rows: userRows } = await client.query(
      'SELECT id, license_status, license_expiration FROM users WHERE user_address = $1 FOR UPDATE',
      [address]
    )

    if (userRows.length === 0) {
      throw new Error('User not found')
    }

    const user = userRows[0]
    const now = new Date()
    let newExpiration: Date

    if (extendExisting && user.license_expiration && user.license_status === 'active') {
      newExpiration = new Date(user.license_expiration.getTime() + (durationDays * 24 * 60 * 60 * 1000))
    } else {
      newExpiration = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000))
    }

    // Update license
    await client.query(
      'UPDATE users SET license_status = $1, license_expiration = $2, updated_at = NOW() WHERE id = $3',
      ['active', newExpiration.toISOString(), user.id]
    )

    await client.query('COMMIT')
    res.json({ success: true, new_expiration: newExpiration })
  } catch (error) {
    await client.query('ROLLBACK')
    const msg = error instanceof Error ? error.message : 'Unknown error'
    res.status(400).json({ error: msg })
  } finally {
    client.release()
  }
})

// Helper function for reference derivation (same as withdrawals.ts)
function deriveReference(orderId: string, programId: string): string {
  const sha = crypto.createHash('sha256').update(orderId).digest()
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('withdraw'), sha], new PublicKey(programId))
  return pda.toBase58()
}

export default router