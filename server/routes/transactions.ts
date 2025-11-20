/**
 * Transaction routes: create, verify, list, detail.
 * Purpose: Track payments (license & agent activation) and withdrawals.
 * Inputs: Express Request bodies, validated via zod schemas.
 * Outputs: JSON responses with transaction records or status updates.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { Buffer } from 'buffer'
import { query } from '../db'
import { Transaction, TransactionStatus, TransactionType } from '../types'
import { z } from 'zod'
import { Connection, PublicKey, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js'
import { BorshCoder, EventParser, Idl, utils } from '@coral-xyz/anchor'
import { findPaymentSignatureByOrderId as findSignatureUnified } from '../services/onchain_verifier'
import solairusPayIdl from '../idl/solairus_pay.json'
import { getConnection, getCurrentCluster, getRpcManager } from '../lib/rpc-manager'
import { attemptExpiredWithdrawalRefund } from '../services/withdrawal_refund'
import { attemptExpiredBucketWithdrawalRefund } from '../services/bucket_withdrawal_refund'
import { deriveReference, findSignatureByReference } from '../services/withdrawal_verifier'
import { distributeAffiliateBonuses } from '../services/affiliate'
import { applyBucketChange } from '../services/bucket'
import { pool } from '../db'

/**
 * Resolve mainnet RPC URL using the same logic as scripts/find-payment-event.mjs
 * Always uses mainnet endpoints regardless of SOLANA_CLUSTER setting
 */
function resolveMainnetRpcUrl(): string {
  const RPC_ENV_KEYS = [
    'SOLANA_RPC_URL_MAINNET',
    'SOLANA_RPC_URL_MAINNET_2',
    'SOLANA_RPC_URL_MAINNET_3',
    'SOLANA_RPC_URL_MAINNET_4',
    'SOLANA_RPC_URL_MAINNET_5',
    'VITE_SOLANA_RPC_URL_MAINNET',
    'VITE_SOLANA_RPC_URL_MAINNET_2',
    'VITE_SOLANA_RPC_URL_MAINNET_3',
    'VITE_SOLANA_RPC_URL_MAINNET_4',
    'VITE_SOLANA_RPC_URL_MAINNET_5',
  ];

  for (const key of RPC_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      return value.endsWith('/') ? value : `${value}/`;
    }
  }
  throw new Error('No mainnet RPC endpoint provided. Set SOLANA_RPC_URL_MAINNET or similar environment variable.');
}

/**
 * Return all configured RPC URLs for mainnet-beta, in order.
 */
function getAllMainnetRpcUrls(): string[] {
  const keys = [
    'SOLANA_RPC_URL_MAINNET',
    'SOLANA_RPC_URL_MAINNET_2',
    'SOLANA_RPC_URL_MAINNET_3',
    'SOLANA_RPC_URL_MAINNET_4',
    'SOLANA_RPC_URL_MAINNET_5',
    'VITE_SOLANA_RPC_URL_MAINNET',
    'VITE_SOLANA_RPC_URL_MAINNET_2',
    'VITE_SOLANA_RPC_URL_MAINNET_3',
    'VITE_SOLANA_RPC_URL_MAINNET_4',
    'VITE_SOLANA_RPC_URL_MAINNET_5',
  ]
  const urls = keys.map((k) => process.env[k]).filter((v): v is string => Boolean(v)).map((u) => (u!.endsWith('/') ? u! : `${u!}/`))
  return urls.length ? urls : [resolveMainnetRpcUrl()]
}

// Simplified resolver helpers: use single healthy connection per check; no multi-RPC scans

/**
 * Reusable function to find transaction signature by PaymentMade events
 * Uses mainnet RPC and standard search parameters for consistency
 */
async function findTransactionSignature(
  orderId: string,
  payerPublicKey: PublicKey,
  _solairusPayProgramId: string
): Promise<ParsedPaymentEvent | null> {
  const connection = new Connection(resolveMainnetRpcUrl(), 'confirmed')
  const found = await findSignatureUnified(connection, payerPublicKey, orderId, { types: ['payment'], maxSignatures: 100 })
  if (!found) return null
  return {
    signature: found.signature,
    slot: found.slot,
    event: {
      payer: found.event.payer,
      recipient: found.event.recipient,
      mint: found.event.mint,
      amount: found.event.amount,
      decimals: found.event.decimals,
      reference: found.event.reference,
      memo: found.event.memo,
    },
  }
}

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
const ActivationSignatureSchema = z.object({
  type: z.enum(['license_activation', 'agent_activation']),
  orderId: z.string().uuid(),
  signature: z.string().min(32).max(128),
  metadata: z.record(z.string(), z.any()).optional(),
})

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

function metadataToObject(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {}
  return meta as Record<string, unknown>
}

async function fetchPaymentEventForSignature(
  connection: Connection,
  signature: string,
  solairusPayProgramId: string
): Promise<ParsedPaymentEvent | null> {
  const coder = new BorshCoder(solairusPayIdl as Idl)
  const programKey = new PublicKey(solairusPayProgramId)
  const tx = await connection.getParsedTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })
  if (!tx || !tx.meta) return null
  const parser = new EventParser(programKey, coder)
  const logs = tx.meta.logMessages ?? []
  for (const event of parser.parseLogs(logs)) {
    if (event.name !== 'PaymentMade') continue
    const memoField = event.data?.memo
    let memo: string | undefined
    if (typeof memoField === 'string') memo = memoField
    else if (memoField instanceof Uint8Array) memo = Buffer.from(memoField).toString('utf8')
    else if (memoField && typeof memoField === 'object' && 'toString' in memoField) {
      memo = (memoField as { toString(): string }).toString()
    }
    const normalizeKey = (value: unknown): PublicKey | undefined => {
      try {
        if (value instanceof PublicKey) return value
        if (value instanceof Uint8Array) return new PublicKey(value)
        if (typeof value === 'string') return new PublicKey(value)
        if (value && typeof value === 'object' && 'toString' in value) {
          return new PublicKey((value as { toString(): string }).toString())
        }
      } catch {
        return undefined
      }
      return undefined
    }
    return {
      signature,
      slot: tx.slot,
      event: {
        payer: normalizeKey(event.data?.payer),
        recipient: normalizeKey(event.data?.recipient),
        mint: normalizeKey(event.data?.mint),
        amount: event.data?.amount ? BigInt(event.data.amount.toString()) : undefined,
        decimals: typeof event.data?.decimals === 'number' ? event.data.decimals : undefined,
        reference: normalizeKey(event.data?.reference),
        memo,
      },
    }
  }
  return null
}

async function verifyAndProcessTransaction(
  connection: Connection,
  record: Transaction,
  options?: { requireOrderIdMatch?: boolean }
): Promise<{ record: Transaction; verified: boolean; reason?: string }> {
  console.log(`[verifyAndProcessTransaction] Starting verification for record ${record.id}, type: ${record.type}, signature: ${record.signature?.slice(0, 8)}...`)

  if (!record.signature) {
    console.log(`[verifyAndProcessTransaction] No signature found for record ${record.id}`)
    return { record, verified: false, reason: 'Signature missing' }
  }

  console.log(`[verifyAndProcessTransaction] Checking signature status for ${record.signature}`)
  const statusResp = await connection.getSignatureStatuses([record.signature], { searchTransactionHistory: true })
  const status = statusResp.value[0]
  const isConfirmed = status && !status.err && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')

  console.log(`[verifyAndProcessTransaction] Signature status: confirmed=${isConfirmed}, status=${status?.confirmationStatus}, err=${status?.err}`)

  if (!isConfirmed) {
    console.log(`[verifyAndProcessTransaction] Signature not confirmed, updating metadata`)
    await query<Transaction>('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      JSON.stringify({ phase: 'signature_recorded', verified: false }),
      record.id,
    ])
    return { record, verified: false, reason: 'Signature not confirmed' }
  }

  console.log(`[verifyAndProcessTransaction] Signature confirmed, checking on-chain match`)
  const match = await verifyOnChainMatchesRecord(connection, record)
  let verified = match.ok
  let failureReason = match.reason

  console.log(`[verifyAndProcessTransaction] On-chain match result: ok=${match.ok}, reason=${match.reason}`)

  if (verified && options?.requireOrderIdMatch) {
    console.log(`[verifyAndProcessTransaction] Checking order ID match (required)`)
    const solairusPayProgramId =
      process.env.SOLAIRUS_PAY_PROGRAM_ID ?? (solairusPayIdl as { address?: string }).address ?? ''
    if (solairusPayProgramId) {
      console.log(`[verifyAndProcessTransaction] Fetching payment event for signature ${record.signature}`)
      const paymentEvent = await fetchPaymentEventForSignature(connection, record.signature, solairusPayProgramId)
      const memo = paymentEvent?.event.memo
      console.log(`[verifyAndProcessTransaction] Payment event found: ${!!paymentEvent}, memo: "${memo}", expected order_id: "${record.order_id}"`)

      if (!paymentEvent || !memo || (record.order_id && memo !== record.order_id)) {
        verified = false
        failureReason = 'Order ID mismatch'
        console.log(`[verifyAndProcessTransaction] Order ID mismatch - verification failed`)
      } else {
        console.log(`[verifyAndProcessTransaction] Order ID match successful`)
      }
    } else {
      console.log(`[verifyAndProcessTransaction] No SOLAIRUS_PAY_PROGRAM_ID configured`)
    }
  }

  const dbStatus: TransactionStatus = verified ? 'confirmed' : 'failed'
  const metaUpdate = verified
    ? { phase: 'verifying_complete', verified: true, failureReason: null }
    : {
        phase: 'verification_failed',
        verified: false,
        failureReason: failureReason ?? 'Verification mismatch',
      }

  console.log(`[verifyAndProcessTransaction] Updating database: status=${dbStatus}, verified=${verified}`)
  const update = await query<Transaction>(
    'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
    [dbStatus, JSON.stringify(metaUpdate), record.id]
  )
  record = update.rows[0]
  console.log(`[verifyAndProcessTransaction] Database update successful, new status: ${record.status}`)

  if (record.status === 'confirmed') {
    console.log(`[verifyAndProcessTransaction] Transaction confirmed, applying post-confirmation logic`)
    await applyPostConfirmation(record)
    const refreshed = await query<Transaction>('SELECT * FROM transactions WHERE id = $1', [record.id])
    record = refreshed.rows[0] ?? record
    console.log(`[verifyAndProcessTransaction] Post-confirmation applied, final status: ${record.status}`)
  }

  console.log(`[verifyAndProcessTransaction] Verification complete: verified=${verified}, final status=${record.status}`)
  return { record, verified, reason: failureReason }
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
 * Generic last confirmed handler for any transaction type
 */
async function lastConfirmedHandlerGeneric(transactionType: TransactionType, req: Request, res: Response) {
  const schema = z.object({ initiatorWallet: z.string().min(32).max(64) })
  const parsed = schema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { initiatorWallet } = parsed.data
  const connection = new Connection(resolveMainnetRpcUrl(), 'confirmed')
  const solairusPayProgramId =
    process.env.SOLAIRUS_PAY_PROGRAM_ID ?? (solairusPayIdl as { address?: string }).address ?? ''

  const sql = `
    SELECT * FROM transactions
    WHERE type = $1 AND initiator_wallet = $2
      AND (status = $3 OR status = $4)
    ORDER BY
      CASE WHEN status = $3 THEN 0 ELSE 1 END,
      id DESC
    LIMIT 1
  `
  const { rows } = await query<Transaction>(sql, [transactionType, initiatorWallet, 'confirmed', 'pending'])
  let record = rows[0] ?? null

  if (
    record &&
    record.type === transactionType &&
    record.order_id &&
    !record.signature &&
    solairusPayProgramId
  ) {
    try {
      const payerKey = new PublicKey(initiatorWallet)
      const found = await findTransactionSignature(record.order_id, payerKey, solairusPayProgramId)
      if (found) {
        const metaPatch = {
          recoveredVia: 'order_id',
          eventSlot: found.slot,
          payer: found.event.payer?.toBase58(),
          recipient: found.event.recipient?.toBase58(),
          memo: found.event.memo,
        }
        const upd = await query<Transaction>(
          'UPDATE transactions SET signature = COALESCE(signature, $1), metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
          [found.signature, JSON.stringify(metaPatch), record.id]
        )
        record = upd.rows[0] ?? record
      }
    } catch (err) {
      console.warn(`Failed to resolve signature during last-confirmed lookup for ${transactionType}:`, err)
    }
  }

  return res.json({ record })
}

/**
 * GET /api/transactions/last-confirmed
 * Return the latest confirmed license_activation transaction for a wallet.
 * Falls back to most recent pending transaction if no confirmed transaction exists.
 */
async function lastConfirmedHandler(req: Request, res: Response) {
  return lastConfirmedHandlerGeneric('license_activation', req, res)
}


/**
 * Helper: Find transaction signature by searching for PaymentMade events from solairus_pay program
 * that contain the orderId in the memo field.
 */
type ParsedPaymentEvent = {
  signature: string
  slot: number
  event: {
    payer?: PublicKey
    recipient?: PublicKey
    mint?: PublicKey
    amount?: bigint
    decimals?: number
    reference?: PublicKey
    memo?: string
  }
}

async function findSignatureByPaymentEvent(
  connection: Connection,
  orderId: string,
  payerPublicKey: PublicKey,
  solairusPayProgramId: string
): Promise<ParsedPaymentEvent | null> {
  const coder = new BorshCoder(solairusPayIdl as Idl)
  const parser = new EventParser(new PublicKey(solairusPayProgramId), coder)

  const signatures = await connection.getSignaturesForAddress(payerPublicKey, { limit: 100 })

  for (const sig of signatures) {
    try {
      const tx = await connection.getParsedTransaction(sig.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })

      if (!tx || !tx.meta) continue

      const normalizeKey = (value: unknown): PublicKey | undefined => {
        try {
          if (value instanceof PublicKey) return value
          if (value instanceof Uint8Array) return new PublicKey(value)
          if (typeof value === 'string') return new PublicKey(value)
          if (value && typeof value === 'object' && 'toString' in value) {
            return new PublicKey((value as { toString(): string }).toString())
          }
        } catch {
          return undefined
        }
        return undefined
      }

      for (const event of parser.parseLogs(tx.meta.logMessages || [])) {
        if (event.name !== 'PaymentMade') continue
        const memoField = event.data?.memo
        const memo =
          typeof memoField === 'string'
            ? memoField
            : memoField instanceof Uint8Array
            ? Buffer.from(memoField).toString('utf8')
            : memoField && typeof memoField === 'object' && 'toString' in memoField
            ? (memoField as { toString(): string }).toString()
            : undefined

        if (memo === orderId) {
          return {
            signature: sig.signature,
            slot: tx.slot,
            event: {
              payer: normalizeKey(event.data?.payer),
              recipient: normalizeKey(event.data?.recipient),
              mint: normalizeKey(event.data?.mint),
              amount: event.data?.amount ? BigInt(event.data.amount.toString()) : undefined,
              decimals: typeof event.data?.decimals === 'number' ? event.data.decimals : undefined,
              reference: normalizeKey(event.data?.reference),
              memo,
            },
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to parse transaction ${sig.signature}:`, err)
    }
  }

  return null
}

/**
 * Convenience wrappers for specific types (payments and withdrawals)
 */
const setType = (type: TransactionType) => (req: Request, _res: Response, next: NextFunction) => {
  req.body.type = type
  next()
}

// Unified activation endpoint - replaces license and agent specific endpoints
router.post('/payments/activate', createUnifiedActivationHandler)

// Generic signature recording - replaces type-specific signature endpoints
router.post('/transactions/record/signature', recordTransactionSignatureHandler)

// Legacy endpoints for backward compatibility during transition
router.post('/payments/license-activation', async (req, res) => {
  req.body.type = 'license_activation'
  return createUnifiedActivationHandler(req, res)
})
router.post('/payments/agent-activation', async (req, res) => {
  req.body.type = 'agent_activation'
  return createUnifiedActivationHandler(req, res)
})
router.post('/transactions/license-activation/signature', recordTransactionSignatureHandler)
router.get('/transactions/last-confirmed', lastConfirmedHandler)
router.post('/transactions/reapply-license', reapplyLicenseHandler)

// Type-specific recovery endpoints
router.get('/transactions/last-confirmed/license', (req, res) => lastConfirmedHandlerGeneric('license_activation', req, res))
router.get('/transactions/last-confirmed/agent', (req, res) => lastConfirmedHandlerGeneric('agent_activation', req, res))

// Legacy endpoints for backward compatibility during transition
router.post('/payments/license-activation', async (req, res) => {
  req.body.type = 'license_activation'
  return createUnifiedActivationHandler(req, res)
})
router.post('/payments/agent-activation', async (req, res) => {
  req.body.type = 'agent_activation'
  return createUnifiedActivationHandler(req, res)
})
router.post('/transactions/license-activation/signature', recordTransactionSignatureHandler)
router.get('/transactions/last-confirmed', lastConfirmedHandler)
router.post('/transactions/reapply-license', reapplyLicenseHandler)

/**
 * POST /api/transactions/reapply-agent
 * Re-apply agent activation for a transaction (confirmed or pending with on-chain payment).
 */
async function reapplyAgentHandler(req: Request, res: Response) {
  return reapplyHandlerGeneric('agent_activation', req, res)
}

router.post('/transactions/reapply-agent', reapplyAgentHandler)

// POST /api/transactions - use shared handler
router.post('/transactions', createTransactionHandler)
router.post('/withdrawals/user', setType('user_withdrawal'), createTransactionHandler)
router.post('/withdrawals/role', setType('role_withdrawal'), createTransactionHandler)

/**
 * POST /api/transactions/pending/resolve
 * Resolve all pending transactions for a wallet in a single silent call.
 * - Activations: recover signature by orderId and verify; mark confirmed/completed
 * - Withdrawals: recover via reference, verify delta; else refund safely and mark failed
 * Always returns 200 with no payload; idempotent via refund_finalized guard.
 */
router.post('/transactions/pending/resolve', async (req: Request, res: Response) => {
  try {
    const walletAddress = String(req.body?.walletAddress || '')
    if (!walletAddress || walletAddress.length < 32) return res.status(200).end()

    // Fetch pending transactions for this wallet
    const pending = await query<Transaction>(
      `SELECT * FROM transactions
       WHERE initiator_wallet = $1
         AND status = 'pending'
         AND type IN ('license_activation','agent_activation','user_withdrawal','role_withdrawal')`,
      [walletAddress]
    )

    if (!pending.rows.length) return res.status(200).end()

    // Base connection for verification path; recovery calls rotate RPCs
    const connection = getConnection()
    const solairusPayProgramId =
      process.env.SOLAIRUS_PAY_PROGRAM_ID ?? (solairusPayIdl as { address?: string }).address ?? ''

    // Process at most 5 per call to reduce RPC load
    for (const record of pending.rows.slice(0, 5)) {
      // Skip if refund already finalized
      if (record.metadata && (record.metadata as any)['refund_finalized'] === true) continue

      // If signature exists, reuse shared verifier
      if (record.signature) {
        await verifyAndProcessTransaction(connection, record, {
          requireOrderIdMatch: record.type === 'license_activation' || record.type === 'agent_activation',
        })
        continue
      }

      // No signature: recover or refund depending on type
      if (record.type === 'license_activation' || record.type === 'agent_activation') {
        // Recover by PaymentMade event memo (orderId)
        if (record.order_id && solairusPayProgramId) {
          const found = await findTransactionSignature(record.order_id, new PublicKey(walletAddress), solairusPayProgramId)
          if (found?.signature) {
            // Patch signature and verify
            await query('UPDATE transactions SET signature = $1 WHERE id = $2', [found.signature, record.id])
            await verifyAndProcessTransaction(connection, { ...record, signature: found.signature } as Transaction, {
              requireOrderIdMatch: true,
            })
            continue
          }
        }
        // If not found, annotate metadata for diagnostics and leave pending
        await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
          JSON.stringify({ resolver_action: 'activation_recover_attempt', resolver_result: 'not_found' }),
          record.id,
        ])
        continue
      }

      // Withdrawals: check reference PDA first
      const refStr = (record.metadata as any)?.reference as string | undefined
      const reference = refStr ? new PublicKey(refStr) : (record.order_id ? deriveReference(record.order_id, solairusPayProgramId) : null)
      if (reference) {
        const currentEndpoint = getRpcManager().getCurrentEndpoint()
        const sig = await findSignatureByReference(connection, reference)
        if (sig) {
          // Verify delta and finalize recovery
          const valid = await verifyOnChainMatchesRecord(connection, { ...record, signature: sig } as Transaction)
          if (valid.ok) {
            await query<Transaction>(
              'UPDATE transactions SET status = $1, signature = $2, metadata = metadata || $3::jsonb WHERE id = $4',
              ['confirmed', sig, JSON.stringify({ completed: true, recoveredVia: 'reference', resolver_rpc_endpoint: currentEndpoint }), record.id]
            )
            continue
          }
          await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
            JSON.stringify({ resolver_action: 'withdrawal_recover_attempt', resolver_reason: 'reference_signature_delta_mismatch', resolver_rpc_endpoint: currentEndpoint }),
            record.id,
          ])
        }
        // Reference signature not found: refund candidate (no TTL required)
        else {
          await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
            JSON.stringify({ resolver_action: 'withdrawal_recover_attempt', resolver_reason: 'reference_signature_not_found', resolver_rpc_endpoint: getRpcManager().getCurrentEndpoint() }),
            record.id,
          ])
        }
      }

      // If recovery failed or no reference, perform refund safely (idempotent)
      if (record.type === 'role_withdrawal') {
        if (record.order_id) {
          const rf = await attemptExpiredBucketWithdrawalRefund(record.order_id)
          if (!rf.refunded && rf.reason) {
            await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
              JSON.stringify({ resolver_action: 'withdrawal_refund_attempt', resolver_reason: rf.reason, resolver_rpc_endpoint: getRpcManager().getCurrentEndpoint() }),
              record.id,
            ])
          }
        }
      } else {
        if (record.order_id) {
          const rf = await attemptExpiredWithdrawalRefund(record.order_id)
          if (!rf.refunded && rf.reason) {
            await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
              JSON.stringify({ resolver_action: 'withdrawal_refund_attempt', resolver_reason: rf.reason, resolver_rpc_endpoint: getRpcManager().getCurrentEndpoint() }),
              record.id,
            ])
          }
        }
      }
    }

    return res.status(200).end()
  } catch (e) {
    // Silent response; never block UI
    return res.status(200).end()
  }
})

/**
 * POST /api/transactions/:id/cancel
 * Cancel a pending transaction
 */
router.post('/transactions/:id/cancel', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid transaction id' })

  try {
    const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Transaction not found' })

    const record = rows[0]
    if (record.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be cancelled' })
    }

    // Update transaction status to cancelled
    const update = await query<Transaction>(
      'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
      ['cancelled', JSON.stringify({ cancelled_at: new Date().toISOString() }), id]
    )

    return res.json({ cancelled: true, record: update.rows[0] })
  } catch (error) {
    console.error('Error cancelling transaction:', error)
    return res.status(500).json({ error: 'Failed to cancel transaction' })
  }
})

/**
 * Generic reapply handler for any transaction type
 */
async function reapplyHandlerGeneric(transactionType: TransactionType, req: Request, res: Response) {
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
  if (record.type !== transactionType) return res.status(400).json({ error: 'Invalid transaction type' })

  // Allow both confirmed and pending transactions (pending may have been paid on-chain)
  const connection = new Connection(resolveMainnetRpcUrl(), 'confirmed')
  const solairusPayProgramId =
    process.env.SOLAIRUS_PAY_PROGRAM_ID ??
    (solairusPayIdl as { address?: string }).address ??
    ''
  if (!solairusPayProgramId) {
    return res.status(500).json({ error: 'Solairus pay program id not configured' })
  }

  // If signature is missing but we have orderId, try to find it via PaymentMade events
  if (!record.signature && orderId) {
    try {
      const found = await findTransactionSignature(orderId, new PublicKey(initiatorWallet), solairusPayProgramId)

      if (found) {
        const metaPatch = {
          recoveredVia: 'order_id',
          eventSlot: found.slot,
          payer: found.event.payer?.toBase58(),
          recipient: found.event.recipient?.toBase58(),
          memo: found.event.memo,
        }
        const upd = await query<Transaction>(
          'UPDATE transactions SET signature = COALESCE(signature, $1), metadata = metadata || $2::jsonb WHERE id = $3 RETURNING *',
          [found.signature, JSON.stringify(metaPatch), record.id]
        )
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

    if (!isConfirmed) {
      return res.status(400).json({ error: 'Transaction signature not confirmed on-chain' })
    }

    const result = await verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: true })
    record = result.record
    if (!result.verified) {
      return res.status(400).json({ error: `Payment verification failed: ${result.reason ?? 'Unknown mismatch'}` })
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
 * POST /api/transactions/reapply-license
 * Re-apply license activation for a transaction (confirmed or pending with on-chain payment).
 */
async function reapplyLicenseHandler(req: Request, res: Response) {
  return reapplyHandlerGeneric('license_activation', req, res)
}

router.post('/transactions/activation/signature', async (req: Request, res: Response) => {
  const parsed = ActivationSignatureSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { type, orderId, signature, metadata } = parsed.data

  const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
  if (!rows.length) return res.status(404).json({ error: 'Activation order not found' })
  let record = rows[0]
  if (record.type !== type) return res.status(400).json({ error: 'Invalid transaction type' })

  const connection = new Connection(resolveMainnetRpcUrl(), 'confirmed')
  const metaBase = metadataToObject(record.metadata)
  const metaPayload = JSON.stringify({ ...metaBase, ...(metadata ?? {}), phase: 'signature_recorded' })

  if (record.signature !== signature) {
    const update = await query<Transaction>(
      'UPDATE transactions SET signature = $1, metadata = $2::jsonb WHERE id = $3 RETURNING *',
      [signature, metaPayload, record.id]
    )
    record = update.rows[0] ?? record
  } else if (metadata) {
    const updateMeta = await query<Transaction>(
      'UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2 RETURNING *',
      [JSON.stringify(metadata), record.id]
    )
    record = updateMeta.rows[0] ?? record
  }

  const result = await verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: true })
  return res.status(200).json({ updated: true, verified: result.verified, reason: result.reason, record: result.record })
})

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
  const isSignatureUpdate = typeof req.body.orderId === 'string'
  if (isSignatureUpdate) {
    const signatureParsed = ActivationSignatureSchema.safeParse(req.body)
    if (!signatureParsed.success) return res.status(400).json({ error: signatureParsed.error.flatten() })
    const { type, orderId, signature, metadata } = signatureParsed.data

    const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
    if (!rows.length) return res.status(404).json({ error: 'Activation order not found' })
    let record = rows[0]
    if (record.type !== type) return res.status(400).json({ error: 'Invalid transaction type' })

    const connection = new Connection(resolveMainnetRpcUrl(), 'confirmed')
    const metaBase = metadataToObject(record.metadata)
    const metaPayload = JSON.stringify({ ...metaBase, ...(metadata ?? {}), phase: 'signature_recorded' })

    if (record.signature !== signature) {
      const update = await query<Transaction>(
        'UPDATE transactions SET signature = $1, metadata = $2::jsonb WHERE id = $3 RETURNING *',
        [signature, metaPayload, record.id]
      )
      record = update.rows[0] ?? record
    } else if (metadata) {
      const updateMeta = await query<Transaction>(
        'UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2 RETURNING *',
        [JSON.stringify(metadata), record.id]
      )
      record = updateMeta.rows[0] ?? record
    }

    const result = await verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: true })
    return res.status(200).json({ resumed: true, updated: true, verified: result.verified, reason: result.reason, record: result.record })
  }

  const parsed = TransactionCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  if (parsed.data.type !== 'license_activation') {
    return res.status(400).json({ error: 'Invalid transaction type for this endpoint' })
  }

  const initiator = parsed.data.initiatorWallet
  const connection = getConnection()

  // Check for existing pending transactions (max 1 for license activation)
  const pendingCheck = await checkExistingPendingTransactions('license_activation', initiator, 1)
  if (!pendingCheck.canProceed) {
    return res.status(409).json({
      error: pendingCheck.reason,
      existingRecord: pendingCheck.existingRecord
    })
  }

  // Check user license status to determine reactivation
  const userRes = await query<{ id: number; license_status: string; license_expiration: string | null }>(
    'SELECT id, license_status, license_expiration FROM users WHERE user_address = $1 LIMIT 1',
    [initiator]
  )
  const user = userRes.rows[0] ?? null
  const now = new Date()
  const expAt = user?.license_expiration ? new Date(user.license_expiration) : null
  const licenseExpired = Boolean(user && user.license_status === 'expired' && expAt && expAt < now)

  // Check if reactivation is needed (expired license >60 days old)
  const needsReactivation = await checkLicenseReactivationNeeded(initiator)

  // If user has active license and doesn't need reactivation, don't create new transaction
  if (user && user.license_status === 'active' && expAt && expAt >= now && !needsReactivation) {
    return res.status(200).json({
      resumed: false,
      created: false,
      active: true,
      user: { license_status: user.license_status, license_expiration: user.license_expiration }
    })
  }

  // 1) Try to resume existing pending/confirmed order for this wallet (only if not reactivation)
  if (!needsReactivation) {
    const existing = await query<Transaction>(
      `SELECT * FROM transactions
       WHERE type = 'license_activation'
        AND initiator_wallet = $1
        AND status IN ('pending','confirmed')
      ORDER BY created_at DESC
      LIMIT 1`,
      [initiator]
    )

    if (existing.rows.length) {
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
        const result = await verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: true })
        if (result.verified) {
          return res.status(200).json({ resumed: true, autoverified: true, record: result.record })
        }
        if (result.reason) {
          return res.status(200).json({ resumed: true, autoverified: false, reason: result.reason, record: result.record })
        }
      }

      // Still pending or no signature — return existing order without creating a duplicate
      return res.status(200).json({ resumed: true, record })
    }
  }

  // 2) No existing order or reactivation needed — create new record and attempt immediate verification if signature provided
  const dbRow = mapToDb({ ...parsed.data, type: 'license_activation' })
  // Initialize metadata lifecycle for license activation
  const baseMeta = parsed.data.metadata ?? {}
  const initialPhase = dbRow.signature ? 'signature_recorded' : 'created'
  const finalMeta = { ...baseMeta, phase: initialPhase, completed: false, reactivation: needsReactivation }

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
  const record = rows[0]

  if (record.signature) {
    await query<Transaction>('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      { phase: 'verifying' },
      record.id,
    ])
    const result = await verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: true })
    const statusCode = result.verified ? 201 : 202
    return res.status(statusCode).json({ autoverified: result.verified, reason: result.reason, record: result.record })
  }

  return res.status(201).json(record)
}

export default router


/**
 * Unified transaction processing system
 * Handles post-confirmation logic for all transaction types
 */
async function processTransactionByType(record: Transaction): Promise<void> {
  const ures = await query<{ id: number }>('SELECT id FROM users WHERE user_address = $1 LIMIT 1', [record.initiator_wallet])
  const userId = ures.rows[0]?.id
  if (!userId) return

  switch (record.type) {
    case 'license_activation':
      await processLicenseActivation(record, userId)
      break
    case 'agent_activation':
      await processAgentActivation(record, userId)
      break
    default:
      console.warn(`Unknown transaction type for processing: ${record.type}`)
      return
  }

  // Mark transaction as processed in metadata (status remains 'confirmed')
  // Only mark as completed if not already completed
  const currentMeta = record.metadata as Record<string, unknown> | null
  if (!currentMeta?.completed) {
    await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      JSON.stringify({ phase: 'completed', completed: true, processed_at: new Date().toISOString() }),
      record.id,
    ])
  }
}

async function processLicenseActivation(record: Transaction, userId: number): Promise<void> {
  // Check if license activation was already processed
  const existingUser = await query<{ license_status: string; license_expiration: string | null }>(
    'SELECT license_status, license_expiration FROM users WHERE id = $1',
    [userId]
  )

  if (existingUser.rows.length) {
    const user = existingUser.rows[0]
    // If license is already active and not expired, don't reprocess
    if (user.license_status === 'active') {
      const now = new Date()
      const expAt = user.license_expiration ? new Date(user.license_expiration) : null
      if (expAt && expAt > now) {
        await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
          JSON.stringify({ phase: 'completed', completed: true, processed_at: new Date().toISOString() }),
          record.id,
        ])
        return
      }
    }
  }

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
}

async function processAgentActivation(record: Transaction, userId: number): Promise<void> {
  if (!record.signature) return

  // Check if agent record already exists for this transaction
  const existingAgent = await query<{ id: number }>(
    'SELECT id FROM agents WHERE metadata->>\'transaction_id\' = $1 LIMIT 1',
    [record.id.toString()]
  )

  if (existingAgent.rows.length) {
    // Agent already created, just mark transaction as completed
    await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [
      JSON.stringify({ phase: 'completed', completed: true, processed_at: new Date().toISOString() }),
      record.id,
    ])
    return
  }

  // Avoid duplicate agent creation for the same signature (fallback check)
  const dup = await query<{ id: number }>('SELECT id FROM agents WHERE activation_signature = $1 LIMIT 1', [record.signature])
  if (dup.rows.length) return

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
    [userId, agentLabel, record.signature, record.amount, tierId, JSON.stringify(meta)]
  )

  // Backfill transaction metadata with agent linkage
  const agentId = ins.rows[0]?.id ?? null
  const tmeta = { agent_id: agentId, tier_id: tierId, tier_name: tierName }
  await query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2', [JSON.stringify(tmeta), record.id])
}



/**
 * Check for existing pending transactions to prevent duplicates
 */
async function checkExistingPendingTransactions(
  type: TransactionType,
  initiatorWallet: string,
  maxPending: number = 1
): Promise<{ canProceed: boolean; existingRecord?: Transaction; reason?: string }> {
  const existing = await query<Transaction>(
    `SELECT * FROM transactions
     WHERE type = $1 AND initiator_wallet = $2 AND status = 'pending'
     ORDER BY created_at DESC`,
    [type, initiatorWallet]
  )

  if (existing.rows.length >= maxPending) {
    return {
      canProceed: false,
      existingRecord: existing.rows[0],
      reason: `Maximum ${maxPending} pending ${type} transaction(s) allowed`
    }
  }

  return { canProceed: true }
}

/**
 * Check if reactivation is needed for license activation
 */
async function checkLicenseReactivationNeeded(initiatorWallet: string): Promise<boolean> {
  // Get user's current license status
  const userRes = await query<{ license_status: string; license_expiration: string | null; created_at: string }>(
    'SELECT license_status, license_expiration, created_at FROM users WHERE user_address = $1 LIMIT 1',
    [initiatorWallet]
  )

  if (!userRes.rows.length) return false

  const user = userRes.rows[0]
  const now = new Date()
  const expAt = user.license_expiration ? new Date(user.license_expiration) : null
  const createdAt = new Date(user.created_at)

  // If license is expired and it's been more than 60 days since creation, allow reactivation
  const isExpired = user.license_status === 'expired' && expAt && expAt < now
  const isOldEnough = (now.getTime() - createdAt.getTime()) > (60 * 24 * 60 * 60 * 1000) // 60 days

  return Boolean(isExpired && isOldEnough)
}

/**
 * Unified activation handler - replaces createOrResumeLicenseActivationHandler and createTransactionHandler for activations
 */
async function createUnifiedActivationHandler(req: Request, res: Response) {
  const schema = z.object({
    type: z.enum(['license_activation', 'agent_activation']),
    initiatorWallet: z.string().min(32).max(64),
    amount: z.number().int().nonnegative(),
    mintAddress: z.string().min(32).max(64),
    decimals: z.number().int().min(0).max(18).default(6),
    programId: z.string().min(32).max(64).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { type, ...body } = parsed.data

  // Set max pending transactions based on type
  const maxPending = 1 // Allow only 1 pending transaction per type per user

  // Check for existing pending transactions
  const pendingCheck = await checkExistingPendingTransactions(type, body.initiatorWallet, maxPending)
  if (!pendingCheck.canProceed) {
    if (pendingCheck.existingRecord) {
      const existingMeta = pendingCheck.existingRecord.metadata as Record<string, unknown> | null
      const isCompleted = Boolean(existingMeta?.completed === true || existingMeta?.phase === 'completed')

      if (isCompleted) {
        // Transaction already completed, no payment needed
        return res.status(200).json({
          completed: true,
          record: pendingCheck.existingRecord,
          message: `${type === 'license_activation' ? 'License' : 'Agent'} activation already completed`
        })
      } else {
        // Transaction exists but not completed
        if (type === 'license_activation') {
          // License activation: resume existing transaction (fixed amount)
          return res.status(200).json({
            resumed: true,
            record: pendingCheck.existingRecord
          })
        } else {
          // Agent activation: show pending transaction management (variable amount)
          return res.status(200).json({
            pendingTransaction: true,
            record: pendingCheck.existingRecord
          })
        }
      }
    }
  }

  // For license activation, check if reactivation is needed
  if (type === 'license_activation') {
    const needsReactivation = await checkLicenseReactivationNeeded(body.initiatorWallet)
    if (!needsReactivation) {
      // Check if user already has active license
      const userRes = await query<{ license_status: string; license_expiration: string | null }>(
        'SELECT license_status, license_expiration FROM users WHERE user_address = $1 LIMIT 1',
        [body.initiatorWallet]
      )
      if (userRes.rows.length) {
        const user = userRes.rows[0]
        if (user.license_status === 'active') {
          const now = new Date()
          const expAt = user.license_expiration ? new Date(user.license_expiration) : null
          if (expAt && expAt > now) {
            return res.status(200).json({
              error: 'License already active',
              active: true
            })
          }
        }
      }
    }
  }

  // Create new transaction record
  const dbRow = {
    type,
    status: 'pending' as TransactionStatus,
    signature: null,
    initiator_wallet: body.initiatorWallet,
    recipient_wallet: null, // Activations don't have recipients
    program_id: body.programId ?? null,
    amount: body.amount,
    mint_address: body.mintAddress,
    decimals: body.decimals,
    metadata: body.metadata ?? {},
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
    { ...dbRow.metadata, phase: 'created', completed: false },
    orderId,
  ])

  return res.status(201).json({ record: rows[0] })
}

/**
 * Generic signature recording handler - replaces type-specific signature endpoints
 */
async function recordTransactionSignatureHandler(req: Request, res: Response) {
  const schema = z.object({
    orderId: z.string().uuid(),
    signature: z.string().min(32).max(128),
    metadata: z.record(z.string(), z.any()).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { orderId, signature, metadata } = parsed.data

  // Find transaction by orderId
  const { rows } = await query<Transaction>('SELECT * FROM transactions WHERE order_id = $1 LIMIT 1', [orderId])
  if (!rows.length) return res.status(404).json({ error: 'Transaction not found' })

  let record = rows[0]

  // Update signature and metadata
  const metaBase = metadataToObject(record.metadata)
  const metaPayload = JSON.stringify({ ...metaBase, ...(metadata ?? {}), phase: 'signature_recorded' })

  if (record.signature !== signature) {
    const update = await query<Transaction>(
      'UPDATE transactions SET signature = $1, metadata = $2::jsonb WHERE id = $3 RETURNING *',
      [signature, metaPayload, record.id]
    )
    record = update.rows[0] ?? record
  } else if (metadata) {
    const updateMeta = await query<Transaction>(
      'UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2 RETURNING *',
      [JSON.stringify(metadata), record.id]
    )
    record = updateMeta.rows[0] ?? record
  }

  // Verify and process the transaction - ALWAYS use mainnet for Solairus Pay transactions
  const connection = new Connection(resolveMainnetRpcUrl(), 'confirmed')
  console.log(`[recordTransactionSignatureHandler] Starting verification for orderId: ${orderId}, signature: ${signature}`)
  console.log(`[recordTransactionSignatureHandler] Using mainnet RPC endpoint: ${connection.rpcEndpoint}`)
  const result = await verifyAndProcessTransaction(connection, record, { requireOrderIdMatch: true })
  console.log(`[recordTransactionSignatureHandler] Verification result: verified=${result.verified}, reason=${result.reason}, status=${result.record.status}`)

  return res.status(200).json({
    updated: true,
    verified: result.verified,
    reason: result.reason,
    record: result.record
  })
}

// Apply post-confirmation side effects for specific transaction types
async function applyPostConfirmation(record: Transaction) {
  if (record.status !== 'confirmed') return

  // Use unified processing
  await processTransactionByType(record)

  // Handle distribution logic (only for USDT payments)
  const isUsdtPayment = record.signature && record.mint_address &&
    (record.type === 'license_activation' || record.type === 'agent_activation')

  if (isUsdtPayment) {
    const ures = await query<{ id: number }>('SELECT id FROM users WHERE user_address = $1 LIMIT 1', [record.initiator_wallet])
    const userId = ures.rows[0]?.id

    if (userId) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Distribute affiliate bonuses
        await distributeAffiliateBonuses(userId, record.amount, record.id)

        // Distribute payment to buckets based on transaction type
        const amountUsdt = (record.amount / 1_000_000).toFixed(6)

        const settingsKey = record.type === 'license_activation' ? 'license' : 'agent'
        const settingsRes = await client.query(`
          SELECT key, value FROM settings
          WHERE key LIKE '${settingsKey}.%_pct'
        `)

        // Default fallback percentages (should be overridden by settings)
        let adminPct = record.type === 'license_activation' ? 30 : 10
        let devPct = record.type === 'license_activation' ? 30 : 10
        let traderPct = record.type === 'license_activation' ? 0 : 15
        let reservePct = record.type === 'license_activation' ? 20 : 45
        let marketer1Pct = 5 // 5% for marketer1 bucket
        let marketer2Pct = 5 // 5% for marketer2 bucket

        for (const row of settingsRes.rows) {
          const parseVal = (v: unknown): number => {
            if (typeof v === 'number') return v
            if (typeof v === 'string') return Number(v)
            if (typeof v === 'object' && v !== null) {
              const inner = (v as Record<string, unknown>).value
              return typeof inner === 'number' ? inner : Number(inner as string)
            }
            return 0
          }

          switch (row.key) {
            case `${settingsKey}.admin_pct`: adminPct = parseVal(row.value) || adminPct; break
            case `${settingsKey}.dev_pct`: devPct = parseVal(row.value) || devPct; break
            case `${settingsKey}.trader_pct`: traderPct = parseVal(row.value) || traderPct; break
            case `${settingsKey}.reserve_pct`: reservePct = parseVal(row.value) || reservePct; break
            case `${settingsKey}.marketer1_pct`: marketer1Pct = parseVal(row.value) || marketer1Pct; break
            case `${settingsKey}.marketer2_pct`: marketer2Pct = parseVal(row.value) || marketer2Pct; break
          }
        }

        // Distribute payment to buckets
        const totalPct = adminPct + devPct + traderPct + reservePct + marketer1Pct + marketer2Pct
        if (totalPct > 0) {
          const adminAmount = (parseFloat(amountUsdt) * adminPct / totalPct).toFixed(6)
          const devAmount = (parseFloat(amountUsdt) * devPct / totalPct).toFixed(6)
          const traderAmount = (parseFloat(amountUsdt) * traderPct / totalPct).toFixed(6)
          const reserveAmount = (parseFloat(amountUsdt) * reservePct / totalPct).toFixed(6)
          const marketer1Amount = (parseFloat(amountUsdt) * marketer1Pct / totalPct).toFixed(6)
          const marketer2Amount = (parseFloat(amountUsdt) * marketer2Pct / totalPct).toFixed(6)

          if (parseFloat(adminAmount) > 0) await applyBucketChange(client, 'admin', 'credit', adminAmount, record.id)
          if (parseFloat(devAmount) > 0) await applyBucketChange(client, 'dev', 'credit', devAmount, record.id)
          if (parseFloat(traderAmount) > 0) await applyBucketChange(client, 'trader', 'credit', traderAmount, record.id)
          if (parseFloat(reserveAmount) > 0) await applyBucketChange(client, 'reserve', 'credit', reserveAmount, record.id)
          if (parseFloat(marketer1Amount) > 0) await applyBucketChange(client, 'marketer_1', 'credit', marketer1Amount, record.id)
          if (parseFloat(marketer2Amount) > 0) await applyBucketChange(client, 'marketer_2', 'credit', marketer2Amount, record.id)
        }

        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error distributing payment:', error)
      } finally {
        client.release()
      }
    }
  }
}
