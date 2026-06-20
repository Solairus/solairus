import { Connection, PublicKey } from '@solana/web3.js'
import type { PoolClient } from 'pg'

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

/**
 * Verify that on-chain transaction matches expected amount/mint/initiator/recipient
 * using pre/post token balance deltas — no smart contract required.
 */
export async function verifyTransactionMatchesOnChain(
  connection: Connection,
  record: {
    signature?: string | null
    initiator_wallet: string
    recipient_wallet?: string | null
    mint_address: string
    amount: string | number | bigint
    decimals: number
    type: string
    metadata?: unknown
  }
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

  const toBigInt = (s: string | number | bigint) => BigInt(typeof s === 'string' ? s : String(s))
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

  const refFromMeta = (() => {
    const m = record.metadata as Record<string, unknown> | null
    const r = m && (m['reference'] as string | undefined)
    return typeof r === 'string' ? r : null
  })()
  let referenceOk = true
  if (refFromMeta) {
    referenceOk = accountKeys.some((k) => k?.pubkey?.toBase58() === refFromMeta)
  }

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
