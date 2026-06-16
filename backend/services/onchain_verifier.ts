import { Connection, PublicKey } from '@solana/web3.js'
import { BorshCoder, EventParser, Idl } from '@coral-xyz/anchor'
import solairusPayIdl from '../idl/solairus_pay.json'
import crypto from 'crypto'
import type { PoolClient } from 'pg'

type ParsedEventResult = {
  signature: string
  slot: number
  event: {
    name: 'PaymentMade' | 'RewardsClaimed'
    payer?: PublicKey
    recipient?: PublicKey
    mint?: PublicKey
    amount?: bigint
    decimals?: number
    reference?: PublicKey
    memo?: string
  }
}

type SolairusPayEventData = {
  payer?: unknown
  recipient?: unknown
  mint?: unknown
  amount?: unknown
  decimals?: unknown
  reference?: unknown
  memo?: unknown
}

type VerifyOptions = {
  types?: Array<'payment' | 'withdrawal'>
  maxSignatures?: number
}

function resolveProgramId(): string {
  const idlAddr = (solairusPayIdl as { address?: string }).address
  return process.env.SOLAIRUS_PAY_PROGRAM_ID || idlAddr || ''
}

export function deriveReference(orderId: string, programId: string): PublicKey {
  const sha = crypto.createHash('sha256').update(orderId).digest()
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('withdraw'), sha], new PublicKey(programId))
  return pda
}

export async function findPaymentSignatureByOrderId(
  connection: Connection,
  walletPubkey: PublicKey,
  orderId: string,
  options?: VerifyOptions
): Promise<ParsedEventResult | null> {
  const programId = resolveProgramId()
  if (!programId) return null

  const types = options?.types ?? ['payment', 'withdrawal']
  const maxSignatures = options?.maxSignatures ?? 100

  const coder = new BorshCoder(solairusPayIdl as Idl)
  const parser = new EventParser(new PublicKey(programId), coder)

  const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit: maxSignatures })
  for (const sig of signatures) {
    const tx = await connection.getParsedTransaction(sig.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    if (!tx || !tx.meta?.logMessages) continue

    for (const event of parser.parseLogs(tx.meta.logMessages)) {
      const name = String(event.name)
      const isPayment = name === 'PaymentMade'
      const isWithdrawal = name === 'RewardsClaimed'
      if ((isPayment && !types.includes('payment')) || (isWithdrawal && !types.includes('withdrawal'))) continue

      const data = event.data as SolairusPayEventData
      const memoField = data.memo
      const memo =
        typeof memoField === 'string'
          ? memoField
          : memoField instanceof Uint8Array
            ? Buffer.from(memoField).toString('utf8')
            : memoField && typeof memoField === 'object' && 'toString' in memoField
              ? (memoField as { toString(): string }).toString()
              : undefined

      if (memo === orderId) {
        const normalizeKey = (value: unknown): PublicKey | undefined => {
          try {
            if (!value) return undefined
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
          signature: sig.signature,
          slot: tx.slot,
          event: {
            name: isPayment ? 'PaymentMade' : 'RewardsClaimed',
            payer: normalizeKey(data.payer),
            recipient: normalizeKey(data.recipient),
            mint: normalizeKey(data.mint),
            amount: data.amount ? BigInt(String(data.amount)) : undefined,
            decimals: typeof data.decimals === 'number' ? data.decimals : undefined,
            reference: normalizeKey(data.reference),
            memo,
          },
        }
      }
    }
  }

  return null
}

export async function findEventByReference(
  connection: Connection,
  reference: PublicKey,
  options?: VerifyOptions
): Promise<ParsedEventResult | null> {
  const programId = resolveProgramId()
  if (!programId) return null

  const types = options?.types ?? ['payment', 'withdrawal']
  const maxSignatures = options?.maxSignatures ?? 20

  const coder = new BorshCoder(solairusPayIdl as Idl)
  const parser = new EventParser(new PublicKey(programId), coder)

  // Get signatures for the reference account
  const signatures = await connection.getSignaturesForAddress(reference, { limit: maxSignatures })

  for (const sig of signatures) {
    if (sig.err) continue // Skip failed transactions

    const tx = await connection.getParsedTransaction(sig.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    if (!tx || !tx.meta?.logMessages) continue

    for (const event of parser.parseLogs(tx.meta.logMessages)) {
      const name = String(event.name)
      const isPayment = name === 'PaymentMade'
      const isWithdrawal = name === 'RewardsClaimed'
      if ((isPayment && !types.includes('payment')) || (isWithdrawal && !types.includes('withdrawal'))) continue

      const normalizeKey = (value: unknown): PublicKey | undefined => {
        try {
          if (!value) return undefined
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

      // Check if the event's reference matches our target reference
      const data = event.data as SolairusPayEventData
      const eventRef = normalizeKey(data.reference)
      if (eventRef && eventRef.equals(reference)) {
        const memoField = data.memo
        const memo =
          typeof memoField === 'string'
            ? memoField
            : memoField instanceof Uint8Array
              ? Buffer.from(memoField).toString('utf8')
              : memoField && typeof memoField === 'object' && 'toString' in memoField
                ? (memoField as { toString(): string }).toString()
                : undefined

        return {
          signature: sig.signature,
          slot: tx.slot,
          event: {
            name: isPayment ? 'PaymentMade' : 'RewardsClaimed',
            payer: normalizeKey(data.payer),
            recipient: normalizeKey(data.recipient),
            mint: normalizeKey(data.mint),
            amount: data.amount ? BigInt(String(data.amount)) : undefined,
            decimals: typeof data.decimals === 'number' ? data.decimals : undefined,
            reference: eventRef,
            memo,
          },
        }
      }
    }
  }


  return null
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
 * Verify that on-chain transaction matches expected amount/mint/initiator/recipient.
 * Migrated from transactions.ts
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
