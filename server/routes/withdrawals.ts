/**
 * Withdrawals router
 * Purpose: Initialize user withdrawal, create transaction record, debit bonus_balance,
 *          build partially-signed claim_rewards transaction, and return base64.
 * Inputs (JSON):
 *  - mintAddress: string (USDT mint)
 *  - amountMicro: number (integer, micro-USDT)
 *  - recipientAta: string (recipient USDT ATA; must exist)
 *  - memo?: string
 * Outputs:
 *  - { orderId, referencePubkey, txBase64, ttlMs }
 */
import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import crypto from 'crypto'
import solairusPayIdl from '../idl/solairus_pay.json'
import { getWorkingConnection } from '../lib/rpc-manager'
import { query, pool } from '../db'
import { buildClaimRewardsTx } from '../services/withdrawals'

const router = Router()

const InitSchema = z.object({
  mintAddress: z.string().min(32).max(64),
  amountMicro: z.number().int().positive(),
  recipientAta: z.string().min(32).max(64),
  memo: z.string().max(128).optional(),
})

function deriveReference(orderId: string, programId: string): string {
  // Deterministic reference pubkey: PDA with seeds ["withdraw", sha256(orderId)] under program ID
  // This is for traceability only; the account does not need to exist or be writable/signing.
  // We derive using the same algo as on-chain PDAs.
  const sha = crypto.createHash('sha256').update(orderId).digest()
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('withdraw'), sha], new PublicKey(programId))
  return pda.toBase58()
}

router.post('/withdrawals/init', async (req: Request, res: Response) => {
  const parsed = InitSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const auth = res.locals.auth as { sub: number; addr: string }
  if (!auth?.addr || !auth?.sub) return res.status(401).json({ error: 'Unauthorized' })

  // Ensure user exists (and wallet matches token)
  const userRes = await query<{ id: number; user_address: string }>(
    'SELECT id, user_address FROM users WHERE id = $1 AND user_address = $2 LIMIT 1',
    [auth.sub, auth.addr]
  )
  const user = userRes.rows[0] ?? null
  if (!user) return res.status(404).json({ error: 'User not found' })

  const PROGRAM_ID = process.env.SOLAIRUS_PAY_PROGRAM_ID || (solairusPayIdl as { address?: string }).address!
  const orderId = crypto.randomUUID()
  const referencePubkey = deriveReference(orderId, PROGRAM_ID)

  // Build transaction first to fail fast on chain-side validation (ATA existence, etc.)
  let built
  try {
    built = await buildClaimRewardsTx({
      initiatorWallet: auth.addr,
      recipient: auth.addr,
      mintAddress: parsed.data.mintAddress,
      amountMicro: parsed.data.amountMicro,
      recipientAta: parsed.data.recipientAta,
      memo: orderId,
      referencePubkey,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(400).json({ error: msg })
  }

  // Preflight: config authority and vault funding
  try {
    const connection = await getWorkingConnection()
    const mint = new PublicKey(parsed.data.mintAddress)
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], new PublicKey(PROGRAM_ID))
    const cfgInfo = await connection.getAccountInfo(configPda, 'confirmed')
    if (!cfgInfo) return res.status(400).json({ error: 'Config PDA not initialized on-chain' })
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

  // Create transaction record and debit bonus_balance atomically
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const insertSql = `
      INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata, order_id)
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      RETURNING id
    `
    const insertParams = [
      'user_withdrawal',
      'pending',
      auth.addr,
      auth.addr,
      PROGRAM_ID,
      parsed.data.amountMicro,
      parsed.data.mintAddress,
      6,
      JSON.stringify({ route: 'withdrawals.init', order_id: orderId, reference: referencePubkey, ttlMs: 120000, phase: 'created', completed: false }),
      orderId,
    ]
    const ins = await client.query(insertSql, insertParams)
    const txId = Number(ins.rows[0].id)

    // Resolve balances.id for user and debit bonus_balance
    const balRes = await client.query('SELECT id FROM balances WHERE user_id = $1 FOR UPDATE', [user.id])
    let balanceId: number
    if (balRes.rowCount === 1) {
      balanceId = Number(balRes.rows[0].id)
    } else {
      const insBal = await client.query(
        'INSERT INTO balances (user_id, bonus_balance, reward_balance, credit_balance, total_earnings) VALUES ($1, 0, 0, 0, 0) RETURNING id',
        [user.id]
      )
      balanceId = Number(insBal.rows[0].id)
    }

    // Prevent overdraft; mirrors applyBalanceBucketChange debit logic
    const updateSql = `
      UPDATE balances
         SET bonus_balance = bonus_balance - $1,
             updated_at = NOW()
       WHERE id = $2 AND bonus_balance >= $1
       RETURNING bonus_balance AS post_balance
    `
    const upd = await client.query(updateSql, [parsed.data.amountMicro.toString(), balanceId])
    if (upd.rowCount !== 1) {
      throw new Error('Insufficient bonus_balance to withdraw')
    }
    const postBalanceStr = upd.rows[0].post_balance as string

    const histSql = `
      INSERT INTO balance_history (balance_id, amount, balance, transaction_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `
    await client.query(histSql, [
      balanceId,
      parsed.data.amountMicro.toString(),
      postBalanceStr,
      txId,
      JSON.stringify({ reason: 'withdrawal_init', order_id: orderId, reference: referencePubkey, action: 'debit', bucket: 'bonus' }),
    ])

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(400).json({ error: msg })
  } finally {
    client.release()
  }

  // Return payload for the frontend to decode, sign as feePayer, and send
  return res.status(201).json({ orderId, referencePubkey, txBase64: built.txBase64, ttlMs: built.ttlMs })
})

export default router
