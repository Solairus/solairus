import { Connection, PublicKey } from '@solana/web3.js'
import { BorshCoder, EventParser, Idl } from '@coral-xyz/anchor'
import solairusPayIdl from '../idl/solairus_pay.json'

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

type VerifyOptions = {
  types?: Array<'payment' | 'withdrawal'>
  maxSignatures?: number
}

function resolveProgramId(): string {
  const idlAddr = (solairusPayIdl as { address?: string }).address
  return process.env.SOLAIRUS_PAY_PROGRAM_ID || idlAddr || ''
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

      const memoField = (event.data as any)?.memo
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
            payer: normalizeKey((event.data as any)?.payer),
            recipient: normalizeKey((event.data as any)?.recipient),
            mint: normalizeKey((event.data as any)?.mint),
            amount: (event.data as any)?.amount ? BigInt(String((event.data as any).amount)) : undefined,
            decimals: typeof (event.data as any)?.decimals === 'number' ? (event.data as any).decimals : undefined,
            reference: normalizeKey((event.data as any)?.reference),
            memo,
          },
        }
      }
    }
  }

  return null
}