/**
 * Transaction routes: create, verify, list, detail.
 * Purpose: Track payments (license & agent activation) and withdrawals.
 * Inputs: Express Request bodies, validated via zod schemas.
 * Outputs: JSON responses with transaction records or status updates.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { query } from '../db'
import { Transaction, TransactionStatus, TransactionType } from '../types'
import { z } from 'zod'
import { Connection, PublicKey, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js'
import { getConnection } from '../lib/rpc-manager'
import { attemptExpiredWithdrawalRefund } from '../services/withdrawal_refund'

const router = Router()

// Zod schemas for input validation
const TransactionCreateSchema = z.object({
  type: z.enum(['license_activation', 'agent_activation', 'user_withdrawal', 'role_withdrawal']),
  signature: z.string().min(32).max(128).optional(),
  initiatorWallet: z.string().min(32).max(64),
  recipientWallet: z.string().min(32).max(64).optional(),
  amount: z.number().int().nonnegative(),
  mintAddress: z.string().min(32).max(64),
  decimals: z.number().int().min(0).max(18).default(6),
  programId: z.string().min(32).max(64).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

const TransactionVerifySchema = z.object({ signature: z.string().min(32).max(128) })

/**
 * Helper to map zod input to DB column names.
 */
function mapToDb(input: z.infer<typeof TransactionCreateSchema>) {
  return {
    type: input.type as TransactionType,
    status: 'pending' as TransactionStatus,
    signature: input.signature ?? null,
    initiator_wallet: input.initiatorWallet,
    recipient_wallet: input.recipientWallet ?? null,
    program_id: input.programId ?? null,
    amount: input.amount,
    mint_address: input.mintAddress,
    decimals: input.decimals ?? 6,
    metadata: input.metadata ?? {},
  }
}

/**
 * Verify that on-chain transaction matches expected amount/mint/initiator/recipient.
 */
async function verifyOnChainMatchesRecord(
  connection: Connection,
  record: Transaction
): Promise<{ ok: boolean; reason?: string }> {
  if (!record.signature) return { ok: false, reason: 'No signature' }
  const parsed = await connection.getParsedTransaction(record.signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })
  if (!parsed) return { ok: false, reason: 'Parsed transaction not found' }

  const pre = parsed.meta?.preTokenBalances ?? []
  const post = parsed.meta?.postTokenBalances ?? []
  const accountKeys = parsed.transaction.message.accountKeys

  const toBigInt = (s: string | number) => BigInt(typeof s === 'string' ? s : String(s))
  const preInitiatorSum = pre
    .filter((b) => b.owner === record.initiator_wallet && b.mint === record.mint_address)
    .reduce((acc, b) => acc + toBigInt(b.uiTokenAmount.amount), 0n)
  const postInitiatorSum = post
    .filter((b) => b.owner === record.initiator_wallet && b.mint === record.mint_address)
    .reduce((acc, b) => acc + toBigInt(b.uiTokenAmount.amount), 0n)
  const initiatorDelta = preInitiatorSum - postInitiatorSum

  const preRecipientSum = record.recipient_wallet
    ? pre
        .filter((b) => b.owner === record.recipient_wallet && b.mint === record.mint_address)
        .reduce((acc, b) => acc + toBigInt(b.uiTokenAmount.amount), 0n)
    : 0n
  const postRecipientSum = record.recipient_wallet
    ? post
        .filter((b) => b.owner === record.recipient_wallet && b.mint === record.mint_address)
        .reduce((acc, b) => acc + toBigInt(b.uiTokenAmount.amount), 0n)
    : 0n
  const recipientDelta = postRecipientSum - preRecipientSum
  const expected = toBigInt(record.amount)

  const decimalsOk = pre
    .concat(post)
    .some((b) => b.owner === record.initiator_wallet && b.mint === record.mint_address && Number(b.uiTokenAmount.decimals) === record.decimals)

  let recipientOk = true
  if (record.recipient_wallet) {
    const recipientAccountMatch = post.some((b) => accountKeys[b.accountIndex]?.pubkey?.toBase58() === record.recipient_wallet)
    const recipientOwnerMatch = post.some((b) => b.owner === record.recipient_wallet)
    recipientOk = recipientAccountMatch || recipientOwnerMatch
  }

  const foundMint = pre.concat(post).some((b) => b.mint === record.mint_address)

  // Enforce presence of expected reference account if provided in metadata
  const refFromMeta = (() => {
    const m = record.metadata as Record<string, unknown> | null
    const r = m && (m['reference'] as string | undefined)
    return typeof r === 'string' ? r : null
  })()
  let referenceOk = true
  if (refFromMeta) {
    referenceOk = accountKeys.some((k) => k?.pubkey?.toBase58() === refFromMeta)
  }
  // For withdrawals, the recipient should be credited by expected amount.
  // For payments, the initiator should be debited by expected amount.
  const isWithdrawal = record.type === 'user_withdrawal' || record.type === 'role_withdrawal'
  const amountOk = isWithdrawal ? recipientDelta === expected : initiatorDelta === expected
  const ok = amountOk && decimalsOk && recipientOk && foundMint && referenceOk

  return ok
    ? { ok: true }
    : {
        ok: false,
        reason: `Mismatch: amountOk=${amountOk}, decimalsOk=${decimalsOk}, recipientOk=${recipientOk}, foundMint=${foundMint}, referenceOk=${referenceOk}`,
      }
}

/**
 * POST /api/transactions
 * Create a new transaction record.
 */
async function createTransactionHandler(req: Request, res: Response) {
  const parsed = TransactionCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const dbRow = mapToDb(parsed.data)
  // Derive richer UI lifecycle using metadata: phase + completed flag
  const baseMeta = parsed.data.metadata ?? {}
  const initialPhase = dbRow.signature ? 'signature_recorded' : 'created'
  const finalMeta = { ...baseMeta, phase: initialPhase, completed: false }
  const orderId = randomUUID()

  const sql = `
    INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `
  const { rows } = await query<Transaction>(sql, [
    dbRow.type,
    dbRow.status,
    dbRow.signature,
    dbRow.initiator_wallet,
    dbRow.recipient_wallet,
    dbRow.program_id,
    dbRow.amount,
    dbRow.mint_address,
    dbRow.decimals,
    finalMeta,
    orderId,
  ])
  let record = rows[0]

  // Auto-confirm if signature present AND matches expected amount/mint
  if (record.signature) {
    // Mark phase as verifying while we check on-chain
    await query<Transaction>('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      { phase: 'verifying' },
      record.id,
    ])

    const connection = getConnection()
    const statusResp = await connection.getSignatureStatuses([record.signature], { searchTransactionHistory: true })
    const status = statusResp.value[0]
    const isConfirmed = status && !status.err && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')

    if (isConfirmed) {
      const match = await verifyOnChainMatchesRecord(connection, record)
      const dbStatus: TransactionStatus = match.ok ? 'confirmed' : 'failed'
      const update = await query<Transaction>(
        'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
        [dbStatus, match.ok ? {} : { failureReason: match.reason ?? 'Verification mismatch' }, record.id]
      )
      record = update.rows[0]
      if (record.status === 'confirmed') await applyPostConfirmation(record)
      return res.status(201).json({ autoverified: match.ok, reason: match.reason, record })
    } else {
      const update = await query<Transaction>(
        'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
        ['failed', { failureReason: 'Signature not confirmed' }, record.id]
      )
      record = update.rows[0]
      return res.status(201).json({ autoverified: false, reason: 'Signature not confirmed', record })
    }
  }

  return res.status(201).json(record)
}

/**
 * GET /api/transactions
 * List transactions with optional filters.
 */
router.get('/transactions', async (req: Request, res: Response) => {
  const { wallet, type, status, limit = '50', offset = '0' } = req.query as Record<string, string>
  const params: unknown[] = []
  const where: string[] = []

  if (wallet) {
    params.push(wallet)
    where.push(`(initiator_wallet = $${params.length} OR recipient_wallet = $${params.length})`)
  }
  if (type) {
    params.push(type)
    where.push(`type = $${params.length}`)
  }
  if (status) {
    params.push(status)
    where.push(`status = $${params.length}`)
  }

  params.push(Number(limit))
  params.push(Number(offset))

  const sql = `
    SELECT * FROM transactions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `
  const { rows } = await query<Transaction>(sql, params)
  return res.json(rows)
})

/**
 * GET /api/transactions/:id
 * Fetch a single transaction by database id.
 * Note: Constrain :id to numeric to avoid collision with other routes like /transactions/last-confirmed
 */
router.get('/transactions/:id(\\d+)', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE id = $1', [id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  return res.json(rows[0])
})

/**
 * POST /api/transactions/verify
 * Verify a transaction signature against Solana RPC and update status.
 */
router.post('/transactions/verify', async (req: Request, res: Response) => {
  const parsed = TransactionVerifySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const signature = parsed.data.signature
  const connection = getConnection()

  // Find record by signature
  const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE signature = $1', [signature])
  if (!rows.length) return res.status(404).json({ error: 'Transaction record not found' })
  const record = rows[0]

  // Mark phase as verifying while we check on-chain
  await query<Transaction>('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
    { phase: 'verifying' },
    record.id,
  ])

  const statusResp = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
  const status = statusResp.value[0]
  const isConfirmed = status && !status.err && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')

  let dbStatus: TransactionStatus = 'failed'
  let reason: string | undefined
  if (isConfirmed) {
    const match = await verifyOnChainMatchesRecord(connection, record)
    dbStatus = match.ok ? 'confirmed' : 'failed'
    reason = match.reason
  } else {
    reason = 'Signature not confirmed'
  }

  const update = await query<Transaction>(
    'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE signature = $3 RETURNING *',
    [dbStatus, reason ? { failureReason: reason } : {}, signature]
  )
  const updatedRecord = update.rows[0]
  if (updatedRecord.status === 'confirmed') await applyPostConfirmation(updatedRecord)
  return res.json({ verified: dbStatus === 'confirmed', reason, record: updatedRecord })
})

/**
 * GET /api/transactions/last-confirmed
 * Return the latest confirmed license_activation transaction for a wallet.
 * Falls back to most recent pending transaction if no confirmed transaction exists.
 */
async function lastConfirmedHandler(req: Request, res: Response) {
  const schema = z.object({ initiatorWallet: z.string().min(32).max(64) })
  const parsed = schema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { initiatorWallet } = parsed.data
  const sql = `
    SELECT * FROM transactions
    WHERE type = $1 AND initiator_wallet = $2
      AND (status = $3 OR status = $4)
    ORDER BY 
      CASE WHEN status = $3 THEN 0 ELSE 1 END,
      id DESC
    LIMIT 1
  `
  const { rows } = await query<Transaction>(sql, ['license_activation', initiatorWallet, 'confirmed', 'pending'])
  const record = rows[0] ?? null
  return res.json({ record })
}

/**
 * Helper: Find transaction signature by searching for PaymentMade events from solairus_pay program
 * that contain the orderId in the memo field.
 */
async function findSignatureByPaymentEvent(
  connection: Connection,
  userPublicKey: PublicKey,
  orderId: string,
  solairusPayProgramId: string
): Promise<string | null> {
  try {
    // Get recent signatures for the user's wallet
    const sigs = await connection.getSignaturesForAddress(userPublicKey, { limit: 50 })
    
    for (const s of sigs) {
      try {
        const tx = await connection.getParsedTransaction(s.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
        
        if (!tx || !tx.meta) continue
        
        // Check if solairus_pay program is involved
        const accountKeys = tx.transaction.message.accountKeys
        const involvesSolairusPay = accountKeys.some((k) => k?.pubkey?.toBase58() === solairusPayProgramId)
        
        if (!involvesSolairusPay) continue
        
        // Parse transaction logs for PaymentMade event
        // PaymentMade event discriminator: [227, 251, 123, 16, 133, 220, 83, 242]
        const logs = tx.meta.logMessages || []
        
        // Look for program data in logs - Anchor events are emitted as base64 in logs
        // Format: "Program data: <base64>"
        for (const log of logs) {
          if (log.includes('Program data:')) {
            try {
              const dataStr = log.split('Program data: ')[1]?.trim()
              if (!dataStr) continue
              
              const eventData = Buffer.from(dataStr, 'base64')
              
              // Check if this is a PaymentMade event by discriminator
              const discriminator = eventData.slice(0, 8)
              const expectedDiscriminator = Buffer.from([227, 251, 123, 16, 133, 220, 83, 242])
              
              if (!discriminator.equals(expectedDiscriminator)) continue
              
              // Decode the event data - memo is the last field as a string
              // Event structure: payer(32) + recipient(32) + mint(32) + amount(8) + decimals(1) + reference(32) + memo(length-prefixed string)
              const memoOffset = 32 + 32 + 32 + 8 + 1 + 32 // 137 bytes before memo
              if (eventData.length <= memoOffset + 4) continue
              
              const memoLength = eventData.readUInt32LE(memoOffset)
              const memoStart = memoOffset + 4
              
              if (eventData.length < memoStart + memoLength) continue
              
              const memo = eventData.slice(memoStart, memoStart + memoLength).toString('utf8')
              
              if (memo === orderId) {
                return s.signature
              }
            } catch (parseErr) {
              // Continue to next log
              continue
            }
          }
        }
      } catch (txErr) {
        // Continue to next signature
        continue
      }
    }
    
    return null
  } catch (err) {
    console.error('Error finding signature by payment event:', err)
    return null
  }
}

/**
 * POST /api/transactions/reapply-license
 * Re-apply license activation for a transaction (confirmed or pending with on-chain payment).
 */
async function reapplyLicenseHandler(req: Request, res: Response) {
  const bodySchema = z
    .object({
      initiatorWallet: z.string().min(32).max(64),
      orderId: z.string().uuid().optional(),
      signature: z.string().min(32).max(128).optional(),
    })
    .refine((d) => !!(d.orderId || d.signature), { message: 'orderId or signature required' })

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { initiatorWallet, orderId, signature } = parsed.data

  // Resolve base record by orderId or signature
  let record: Transaction | null = null
  if (orderId) {
    const r1 = await query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
    record = r1.rows[0] ?? null
  } else if (signature) {
    const r2 = await query<Transaction>('SELECT * FROM transactions WHERE signature = $1 LIMIT 1', [signature])
    record = r2.rows[0] ?? null
  }

  if (!record) return res.status(404).json({ error: 'Transaction not found' })
  if (record.type !== 'license_activation') return res.status(400).json({ error: 'Invalid transaction type' })
  
  // Allow both confirmed and pending transactions (pending may have been paid on-chain)
  const connection = getConnection()
  const solairusPayProgramId = 'CMvEEAXnNKZs7brTjVp4dqtPzkdRqSjnFNG9zpBjUP3g'

  // If signature is missing but we have orderId, try to find it via PaymentMade events
  if (!record.signature && orderId) {
    try {
      const pub = new PublicKey(initiatorWallet)
      const foundSig = await findSignatureByPaymentEvent(connection, pub, orderId, solairusPayProgramId)

      if (foundSig) {
        const upd = await query<Transaction>('UPDATE transactions SET signature = $1 WHERE id = $2 RETURNING *', [foundSig, record.id])
        record = upd.rows[0] ?? record
      } else {
        return res.status(404).json({ error: 'On-chain payment not found for this order' })
      }
    } catch (e) {
      console.error('Error finding payment signature:', e)
      return res.status(500).json({ error: 'Failed to search for on-chain payment' })
    }
  }

  // If transaction is pending with signature, verify it on-chain and update status
  if (record.status === 'pending' && record.signature) {
    const statusResp = await connection.getSignatureStatuses([record.signature], { searchTransactionHistory: true })
    const status = statusResp.value[0]
    const isConfirmed = status && !status.err && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')

    if (isConfirmed) {
      const match = await verifyOnChainMatchesRecord(connection, record)
      const dbStatus: TransactionStatus = match.ok ? 'confirmed' : 'failed'
      const update = await query<Transaction>(
        'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
        [dbStatus, match.ok ? {} : { failureReason: match.reason ?? 'Verification mismatch' }, record.id]
      )
      record = update.rows[0]
      
      if (record.status !== 'confirmed') {
        return res.status(400).json({ error: `Payment verification failed: ${match.reason}` })
      }
    } else {
      return res.status(400).json({ error: 'Transaction signature not confirmed on-chain' })
    }
  }

  // If still not confirmed after all attempts, reject
  if (record.status !== 'confirmed') {
    return res.status(400).json({ error: 'Transaction is not confirmed. Please ensure payment was completed on-chain.' })
  }

  await applyPostConfirmation(record)

  const refreshed = await query<Transaction>('SELECT * FROM transactions WHERE id = $1', [record.id])
  const finalRecord = refreshed.rows[0] ?? record
  return res.json({ reapplied: true, record: finalRecord })
}
/**
 * Convenience wrappers for specific types (payments and withdrawals)
 */
const setType = (type: TransactionType) => (req: Request, _res: Response, next: NextFunction) => {
  req.body.type = type
  next()
}

// POST /api/transactions - use shared handler
router.post('/transactions', createTransactionHandler)
router.post('/payments/license-activation', setType('license_activation'), createOrResumeLicenseActivationHandler)
router.post('/payments/agent-activation', setType('agent_activation'), createTransactionHandler)
router.post('/withdrawals/user', setType('user_withdrawal'), createTransactionHandler)
router.post('/withdrawals/role', setType('role_withdrawal'), createTransactionHandler)
router.get('/transactions/last-confirmed', lastConfirmedHandler)
router.post('/transactions/reapply-license', reapplyLicenseHandler)

/**
 * GET /api/transactions/:orderId
 * Fetch a single transaction by order_id (UUID). Useful for frontend polling.
 */
router.get('/transactions/:orderId([0-9a-fA-F-]{36})', async (req: Request, res: Response) => {
  const orderId = req.params.orderId
  // Fetch base record
  const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  let record = rows[0]

  let refunded = false

  // Attempt reference-based signature resolution for pending withdrawals lacking signature
  try {
    // Allow resolution for pending OR failed withdrawals that lack a signature
    const isWithdrawal = record.type === 'user_withdrawal' || record.type === 'role_withdrawal'
    const md = record.metadata as Record<string, unknown> | null
    const alreadyRefunded = Boolean(md && (md['refund'] as boolean | undefined))
    const canResolveByReference =
      isWithdrawal && !record.signature && (record.status === 'pending' || record.status === 'failed') && !alreadyRefunded

    if (canResolveByReference) {
      const m = record.metadata as Record<string, unknown> | null
      const ref = m && (m['reference'] as string | undefined)
      if (ref) {
        const connection = getConnection()
        const refPub = new PublicKey(ref)
        // Search recent signatures for the reference account
        const sigs = await connection.getSignaturesForAddress(refPub, { limit: 25 })

        // Try to find a matching program + reference transaction
        let foundSig: string | null = null
        for (const s of sigs) {
          const pt = await connection.getParsedTransaction(s.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })
          if (!pt) continue
          // Ensure the reference key is in account keys and our program is involved
          const keys = pt.transaction.message.accountKeys
          const hasReference = keys.some((k) => k?.pubkey?.toBase58() === ref)
          const ixs = pt.transaction.message.instructions as (ParsedInstruction | PartiallyDecodedInstruction)[]
          const programIdStr = record.program_id || ''
          const hasProgram = programIdStr ? ixs.some((ix) => ix.programId.toBase58() === programIdStr) : true
          if (hasReference && hasProgram) {
            foundSig = s.signature
            break
          }
        }

        if (foundSig) {
          // Attach signature to record
          const upd = await query<Transaction>('UPDATE transactions SET signature = $1 WHERE id = $2 RETURNING *', [foundSig, record.id])
          record = upd.rows[0] ?? record

          // Verify and update status using on-chain data
          const statusResp = await connection.getSignatureStatuses([foundSig], { searchTransactionHistory: true })
          const statusVal = statusResp.value[0]
          const isConfirmed = statusVal && !statusVal.err && (statusVal.confirmationStatus === 'confirmed' || statusVal.confirmationStatus === 'finalized')
          let dbStatus: TransactionStatus = 'failed'
          let reason: string | undefined
          if (isConfirmed) {
            const match = await verifyOnChainMatchesRecord(connection, record)
            dbStatus = match.ok ? 'confirmed' : 'failed'
            reason = match.reason
          } else {
            reason = 'Signature not confirmed'
          }
          const upd2 = await query<Transaction>(
            'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
            [dbStatus, reason ? { failureReason: reason } : {}, record.id]
          )
          record = upd2.rows[0] ?? record
        }

        // Mark that a check occurred regardless of outcome so UI can hide buttons
        await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
          JSON.stringify({ checked: true, checked_at: new Date().toISOString() }),
          record.id,
        ])
      }
    }
  } catch (_e) {
    // Non-fatal: continue to refund attempt if still pending
  }

  // If still pending with no signature, attempt internal auto-refund for expired withdrawals
  try {
    if (record.status === 'pending' && !record.signature && (record.type === 'user_withdrawal' || record.type === 'role_withdrawal')) {
      const rf = await attemptExpiredWithdrawalRefund(orderId)
      refunded = Boolean(rf?.refunded)
      // Reload record after possible refund
      const refresh = await query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
      if (refresh.rows.length) record = refresh.rows[0]
    }
  } catch (_e) {
    // Non-fatal
  }

  const status = record.status
  const finalized = status === 'confirmed' || status === 'failed'
  const failureReason = (record.metadata && typeof record.metadata === 'object' && (record.metadata as Record<string, unknown>)['failureReason']) as string | undefined
  const uiStatus = status === 'pending' ? 'awaiting' : status === 'confirmed' ? 'success' : 'error'
  const nextPollMs = finalized ? 0 : 2000
  // Include refunded flag for UI convenience
  refunded = refunded || Boolean((record.metadata as Record<string, unknown> | null)?.['refund'])
  return res.json({ orderId, status, uiStatus, finalized, nextPollMs, failureReason, refunded, record })
})

// Specialized handler: create or resume license activation and pre-verify on-chain
async function createOrResumeLicenseActivationHandler(req: Request, res: Response) {
  const parsed = TransactionCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  // Enforce license_activation only
  if (parsed.data.type !== 'license_activation') {
    return res.status(400).json({ error: 'Invalid transaction type for this endpoint' })
  }

  const initiator = parsed.data.initiatorWallet
  const connection = getConnection()

  // Check user license status to determine reactivation
  const userRes = await query<{ id: number; license_status: string; license_expiration: string | null }>(
    'SELECT id, license_status, license_expiration FROM users WHERE user_address = $1 LIMIT 1',
    [initiator]
  )
  const user = userRes.rows[0] ?? null
  const now = new Date()
  const expAt = user?.license_expiration ? new Date(user.license_expiration) : null
  const licenseExpired = Boolean(user && user.license_status === 'expired' && expAt && expAt < now)

  // 1) Try to resume existing pending/confirmed order for this wallet
  const existing = await query<Transaction>(
    `SELECT * FROM transactions
     WHERE type = 'license_activation'
       AND initiator_wallet = $1
       AND status IN ('pending','confirmed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [initiator]
  )

  // Resume existing activation only if not a reactivation scenario
  if (existing.rows.length && !licenseExpired) {
    let record = existing.rows[0]

    // Backfill missing order_id on resumed pending order
    if (!record.order_id) {
      const newOrderId = randomUUID()
      const upd = await query<Transaction>('UPDATE transactions SET order_id = $1 WHERE id = $2 RETURNING *', [newOrderId, record.id])
      record = upd.rows[0]
    }

    // If client provided a new signature for a pending order, attach it to the record
    if (!record.signature && parsed.data.signature) {
      const updated = await query<Transaction>(
        'UPDATE transactions SET signature = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
        [
          parsed.data.signature,
          JSON.stringify({ phase: 'signature_recorded', ...(parsed.data.metadata ?? {}) }),
          record.id,
        ]
      )
      record = updated.rows[0]
    }

    // If already confirmed, apply activation and return immediately
    if (record.status === 'confirmed') {
      await applyPostConfirmation(record)
      const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE id = $1', [record.id])
      record = rows[0]
      return res.status(200).json({ resumed: true, record })
    }

    // If we have a signature, try to auto-verify and activate
    if (record.signature) {
      const statusResp = await connection.getSignatureStatuses([record.signature], { searchTransactionHistory: true })
      const status = statusResp.value[0]
      const isConfirmed = status && !status.err && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')

      if (isConfirmed) {
        const match = await verifyOnChainMatchesRecord(connection, record)
        const dbStatus: TransactionStatus = match.ok ? 'confirmed' : 'failed'
        const update = await query<Transaction>('UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *', [dbStatus, record.id])
        record = update.rows[0]
        if (record.status === 'confirmed') await applyPostConfirmation(record)
        return res.status(200).json({ resumed: true, autoverified: match.ok, reason: match.reason, record })
      }
    }

    // Still pending or no signature — return existing order without creating a duplicate
    return res.status(200).json({ resumed: true, record })
  }

  // 2) No existing order — create new record and attempt immediate verification if signature provided
  const dbRow = mapToDb({ ...parsed.data, type: 'license_activation' })
  // Initialize metadata lifecycle for license activation
  const baseMeta = parsed.data.metadata ?? {}
  const initialPhase = dbRow.signature ? 'signature_recorded' : 'created'
  const finalMeta = { ...baseMeta, phase: initialPhase, completed: false, reactivation: licenseExpired }

  // If user is currently active and not expired, do NOT create a new activation
  if (user && user.license_status === 'active' && expAt && expAt >= now) {
    return res.status(200).json({ resumed: false, created: false, active: true, user: { license_status: user.license_status, license_expiration: user.license_expiration } })
  }
  const orderId = randomUUID()
  const sql = `
    INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `
  const { rows } = await query<Transaction>(sql, [
    dbRow.type,
    dbRow.status,
    dbRow.signature,
    dbRow.initiator_wallet,
    dbRow.recipient_wallet,
    dbRow.program_id,
    dbRow.amount,
    dbRow.mint_address,
    dbRow.decimals,
    finalMeta,
    orderId,
  ])
  let record = rows[0]

  if (record.signature) {
    // Mark phase as verifying during on-chain check
    await query<Transaction>('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      { phase: 'verifying' },
      record.id,
    ])
    const statusResp = await connection.getSignatureStatuses([record.signature], { searchTransactionHistory: true })
    const status = statusResp.value[0]
    const isConfirmed = status && !status.err && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')

    if (isConfirmed) {
      const match = await verifyOnChainMatchesRecord(connection, record)
      const dbStatus: TransactionStatus = match.ok ? 'confirmed' : 'failed'
      const update = await query<Transaction>(
        'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
        [dbStatus, match.ok ? {} : { failureReason: match.reason ?? 'Verification mismatch' }, record.id]
      )
      record = update.rows[0]
      if (record.status === 'confirmed') await applyPostConfirmation(record)
      return res.status(201).json({ autoverified: match.ok, reason: match.reason, record })
    } else {
      const update = await query<Transaction>(
        'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
        ['failed', { failureReason: 'Signature not confirmed' }, record.id]
      )
      record = update.rows[0]
      return res.status(201).json({ autoverified: false, reason: 'Signature not confirmed', record })
    }
  }

  return res.status(201).json(record)
}

export default router


// Apply post-confirmation side effects for specific transaction types
async function applyPostConfirmation(record: Transaction) {
  if (record.status !== 'confirmed') return

  // A) License activation: mark user license active and set expiration
  if (record.type === 'license_activation') {
    // Resolve user id from initiator wallet
    const ures = await query<{ id: number }>('SELECT id FROM users WHERE user_address = $1 LIMIT 1', [record.initiator_wallet])
    const userId = ures.rows[0]?.id
    if (!userId) return

    // Load term days from settings (fallback to 365)
    const termSql = "SELECT value, type FROM settings WHERE key = 'license.term_days' LIMIT 1"
    const termRes = await query<{ value: unknown; type: string }>(termSql)
    let termDays = 365
    const termRow = termRes.rows[0]
    if (termRow) {
      if (typeof termRow.value === 'number') termDays = termRow.value
      else if (typeof termRow.value === 'string') termDays = Number(termRow.value)
      else if (typeof termRow.value === 'object' && termRow.value !== null) {
        const v = termRow.value as Record<string, unknown>
        const inner = typeof v.value === 'number' ? v.value : Number(v.value as string)
        if (!Number.isNaN(inner)) termDays = inner
      }
    }

    const now = Date.now()
    const expiresAt = new Date(now + termDays * 24 * 60 * 60 * 1000)

    // Activate user license
    await query('UPDATE users SET license_status = $1, license_expiration = $2 WHERE id = $3', [
      'active',
      expiresAt.toISOString(),
      userId,
    ])

    // Mark transaction lifecycle completed for UI derivation
    await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      JSON.stringify({ phase: 'completed', completed: true }),
      record.id,
    ])

    return
  }

  // B) Agent activation: existing behavior
  if (record.type !== 'agent_activation') return
  if (!record.signature) return

  // Avoid duplicate agent creation for the same signature
  const dup = await query<{ id: number }>('SELECT id FROM agents WHERE activation_signature = $1 LIMIT 1', [record.signature])
  if (dup.rows.length) return

  // Resolve user id from initiator wallet
  const ures2 = await query<{ id: number }>('SELECT id FROM users WHERE user_address = $1 LIMIT 1', [record.initiator_wallet])
  const userId2 = ures2.rows[0]?.id
  if (!userId2) return

  // Match tier by amount (micro-USDT)
  const tres = await query<{ id: number; tier_name: string }>(
    'SELECT id, tier_name FROM agent_tiers WHERE $1::bigint BETWEEN min_amount AND max_amount LIMIT 1',
    [record.amount]
  )
  const tierId = tres.rows[0]?.id ?? null
  const tierName = tres.rows[0]?.tier_name ?? null

  // Insert agent row
  const agentLabel = tierName ? `Agent ${tierName}` : null
  const meta = { transaction_id: record.id, tier_id: tierId, tier_name: tierName }
  const ins = await query<{ id: number }>(
    `INSERT INTO agents (user_id, agent_label, status, activation_signature, amount, tier_id, metadata)
     VALUES ($1, $2, 'active', $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [userId2, agentLabel, record.signature, record.amount, tierId, JSON.stringify(meta)]
  )

  // Backfill transaction metadata with agent linkage
  const agentId = ins.rows[0]?.id ?? null
  const tmeta = { agent_id: agentId, tier_id: tierId, tier_name: tierName }
  await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [JSON.stringify(tmeta), record.id])

  // Mark transaction lifecycle completed for UI derivation
  await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
    JSON.stringify({ phase: 'completed', completed: true }),
    record.id,
  ])
}