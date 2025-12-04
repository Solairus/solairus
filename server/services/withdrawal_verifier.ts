import { PublicKey, Connection } from '@solana/web3.js'
import crypto from 'crypto'
import type { PoolClient } from 'pg'

export function deriveReference(orderId: string, programId: string): PublicKey {
  const sha = crypto.createHash('sha256').update(orderId).digest()
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('withdraw'), sha], new PublicKey(programId))
  return pda
}

export async function findSignatureByReference(conn: Connection, ref: PublicKey): Promise<string | null> {
  const sigs = await conn.getSignaturesForAddress(ref, { limit: 20 })
  if (!sigs || sigs.length === 0) return null

  // Iterate through all found signatures to find a successful one
  for (const sigInfo of sigs) {
    if (sigInfo.err) continue // Skip failed transactions
    return sigInfo.signature
  }
  return null
}

export async function verifyTokenDelta(
  conn: Connection,
  signature: string,
  owner: string,
  mint: string,
  amountMicro: bigint,
  decimals: number = 6
): Promise<boolean> {
  const tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 })
  if (!tx || !tx.meta) return false
  const pre = tx.meta.preTokenBalances || []
  const post = tx.meta.postTokenBalances || []

  let delta = 0n
  for (const p of post) {
    if (p.owner === owner && p.mint === mint) {
      const postAmt = p.uiTokenAmount?.amount ? BigInt(p.uiTokenAmount.amount) : 0n
      const preMatch = pre.find(pp => pp.accountIndex === p.accountIndex)
      const preAmt = preMatch?.uiTokenAmount?.amount ? BigInt(preMatch.uiTokenAmount.amount) : 0n
      delta = postAmt - preAmt
      break
    }
  }
  return delta === amountMicro
}

export async function finalizeRecovery(
  client: PoolClient,
  recordId: number,
  signature: string,
  extraMeta: Record<string, unknown>
): Promise<void> {
  await client.query(
    'UPDATE transactions SET status = $1, signature = $2, metadata = metadata || $3::jsonb, updated_at = NOW() WHERE id = $4',
    ['confirmed', signature, JSON.stringify(extraMeta), recordId]
  )
}

export async function finalizeRefund(
  client: PoolClient,
  recordId: number,
  extraMeta: Record<string, unknown>
): Promise<void> {
  await client.query(
    'UPDATE transactions SET status = $1, metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $3',
    ['failed', JSON.stringify(extraMeta), recordId]
  )
}