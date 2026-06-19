/**
 * USDT SPL transfer helpers (contract-free).
 *  - getUsdtBalanceMicro: read a deposit address's USDT balance via its ATA
 *  - sweepToTreasury: order address -> treasury (dual-signer; treasury pays the fee)
 *  - sendUsdt: treasury -> recipient (payout)
 * Notes: amounts are micro-USDT (bigint). The backend holds both keypairs, so sweeps
 *        need NO per-address SOL gas funding (treasury is fee payer). USDT mint from env.
 */
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  createTransferInstruction,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token'
import { getWorkingConnection } from './rpc-manager'
import { deriveOrderKeypair, getTreasuryKeypair, getTreasuryAddress } from './hd-wallet'

/** Resolve the configured USDT mint. */
export function getUsdtMint(): PublicKey {
  const m = process.env.USDT_MINT_ADDRESS
  if (!m || !m.trim()) throw new Error('USDT_MINT_ADDRESS not set')
  return new PublicKey(m.trim())
}

/** True only for a syntactically valid, on-curve Solana address (rejects PDAs/garbage). */
export function isValidSolAddress(addr: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(addr).toBytes())
  } catch {
    return false
  }
}

/** Read USDT balance (micro) at an owner's ATA. Returns 0n when the ATA does not exist yet. */
export async function getUsdtBalanceMicro(owner: PublicKey, connection?: Connection): Promise<bigint> {
  const conn = connection ?? (await getWorkingConnection())
  const mint = getUsdtMint()
  const ata = await getAssociatedTokenAddress(mint, owner, true)
  try {
    const acc = await getAccount(conn, ata, 'confirmed')
    return acc.amount
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError || e instanceof TokenInvalidAccountOwnerError) return 0n
    const msg = e instanceof Error ? e.message : String(e)
    // Some RPCs return a generic "could not find account" instead of the typed error.
    if (msg.includes('could not find account') || msg.includes('Account does not exist')) return 0n
    throw e
  }
}

/**
 * Sweep USDT from an order address to the treasury.
 * Dual-signer: treasury = fee payer (holds SOL), order keypair = token authority. Both backend-held.
 */
/**
 * Sweep USDT from an order address to the treasury.
 * Dual-signer: treasury = fee payer (holds SOL), order keypair = token authority. Both backend-held.
 *
 * @param p.orderIndex - PG returns INT8 as string; accept number|string|bigint.
 */
export async function sweepToTreasury(p: { orderIndex: number | string | bigint; amountMicro: bigint }): Promise<{ signature: string }> {
  if (p.amountMicro <= 0n) throw new Error('Sweep amount must be positive')
  const connection = await getWorkingConnection()
  const order = deriveOrderKeypair(p.orderIndex)
  const treasury = getTreasuryKeypair()
  const mint = getUsdtMint()

  const sourceAta = await getAssociatedTokenAddress(mint, order.publicKey, true)
  let treasuryAta: Awaited<ReturnType<typeof getAccount>>
  try {
    treasuryAta = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, treasury.publicKey)
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) {
      throw new Error(
        `Treasury USDT ATA does not exist and could not be created (treasury=${getTreasuryAddress()}). ` +
        `The treasury keypair has insufficient SOL on this cluster to pay rent (~0.002 SOL). ` +
        `Fund it at https://faucet.solana.com then retry.`
      )
    }
    throw e
  }

  const ix = createTransferInstruction(sourceAta, treasuryAta.address, order.publicKey, p.amountMicro)
  const tx = new Transaction().add(ix)
  tx.feePayer = treasury.publicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash
  tx.sign(treasury, order)

  const signature = await connection.sendRawTransaction(tx.serialize())
  await connection.confirmTransaction(signature, 'confirmed')
  return { signature }
}

/**
 * Payout: send USDT from the treasury to a recipient. Treasury is fee payer and pays
 * recipient ATA rent if needed. Destination MUST be validated on-curve by the caller path.
 */
export async function sendUsdt(p: { toAddress: string; amountMicro: bigint }): Promise<{ signature: string }> {
  if (!isValidSolAddress(p.toAddress)) throw new Error(`Invalid destination address: ${p.toAddress}`)
  if (p.amountMicro <= 0n) throw new Error('Payout amount must be positive')
  const connection = await getWorkingConnection()
  const treasury = getTreasuryKeypair()
  const mint = getUsdtMint()
  const recipient = new PublicKey(p.toAddress)

  const fromAta = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, treasury.publicKey)
  const toAta = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, recipient)

  const ix = createTransferInstruction(fromAta.address, toAta.address, treasury.publicKey, p.amountMicro)
  const tx = new Transaction().add(ix)
  tx.feePayer = treasury.publicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash
  tx.sign(treasury)

  const signature = await connection.sendRawTransaction(tx.serialize())
  await connection.confirmTransaction(signature, 'confirmed')
  return { signature }
}
