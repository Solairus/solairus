// One-time USDT account setup for the connected wallet.
// RULE: the platform never pays rent to create a recipient's USDT token account
// (see no-platform-ata-rent-rule). The user creates their own — they pay the small,
// refundable network deposit (~0.002 SOL) from their own wallet.
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token'

/** Backend status discriminator returned when the user must set up their USDT account first. */
export const ATA_SETUP_REQUIRED = 'ata_setup_required'

export interface AtaSetupRequired {
  status: typeof ATA_SETUP_REQUIRED
  recipient: string
  recipientAta: string
  mint: string
  rentLamports: number
  rentSol: number
  message?: string
}

export function isAtaSetupRequired(payload: unknown): payload is AtaSetupRequired {
  return !!payload && typeof payload === 'object' && (payload as { status?: string }).status === ATA_SETUP_REQUIRED
}

/** Resolve the active USDT mint from env (honours a local devnet override). */
export function resolveUsdtMint(): PublicKey {
  let override: string | null = null
  try { override = localStorage.getItem('solana_cluster_override')?.toLowerCase() ?? null } catch { /* ignore */ }
  const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'mainnet-beta').toLowerCase()
  const effective = override || envCluster
  const isMainnet = effective.startsWith('mainnet')
  const mintStr = isMainnet
    ? (import.meta.env.VITE_USDT_MINT as string)
    : (import.meta.env.VITE_USDT_MINT_DEVNET as string)
  if (!mintStr) throw new Error('USDT mint not configured')
  return new PublicKey(mintStr)
}

export type WalletSigner = {
  publicKey: PublicKey
  signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
}

/**
 * Ensure the connected wallet has a USDT account, creating it (user-paid) if missing.
 * Returns { created } so callers can tailor messaging. Throws if the user rejects the signature.
 */
export async function ensureUserUsdtAta(
  connection: Connection,
  signer: WalletSigner,
  mint?: PublicKey,
): Promise<{ ata: PublicKey; created: boolean; signature?: string }> {
  const usdtMint = mint ?? resolveUsdtMint()
  const owner = signer.publicKey
  const ata = getAssociatedTokenAddressSync(usdtMint, owner, false)

  // Already set up?
  try {
    await getAccount(connection, ata, 'confirmed')
    return { ata, created: false }
  } catch (e) {
    const known =
      e instanceof TokenAccountNotFoundError ||
      e instanceof TokenInvalidAccountOwnerError ||
      (e instanceof Error && (e.message.includes('could not find account') || e.message.includes('Account does not exist')))
    if (!known) throw e
  }

  // Create it — the USER is both payer and owner, so the user pays the rent.
  const ix = createAssociatedTokenAccountInstruction(owner, ata, owner, usdtMint)
  const tx = new Transaction().add(ix)
  tx.feePayer = owner
  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash
  const signed = (await signer.signTransaction(tx)) as Transaction
  const signature = await connection.sendRawTransaction(signed.serialize())
  await connection.confirmTransaction(signature, 'confirmed')
  return { ata, created: true, signature }
}
