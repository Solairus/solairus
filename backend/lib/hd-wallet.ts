/**
 * HD wallet + treasury loader (contract-free payment model)
 * Purpose:
 *  - Derive a unique deposit keypair per order (per-transaction HD index)
 *  - Load the treasury / hot wallet (sweep target + payout source + sweep fee payer)
 * Inputs (env):
 *  - HD_WALLET_MNEMONIC: BIP39 mnemonic for order-address derivation
 *  - SOLAIRUS_AUTHORITY_SECRET_BASE58 (preferred) or SOLAIRUS_AUTHORITY_KEYPAIR_PATH: treasury secret key
 * Security: secrets live in env only; order private keys are derived transiently, never persisted.
 */
import fs from 'fs'
import bs58 from 'bs58'
import { Keypair } from '@solana/web3.js'
import { mnemonicToSeedSync } from 'bip39'
import { derivePath } from 'ed25519-hd-key'

/** hd_index 0 is reserved for the treasury / master — never assigned to an order. */
export const TREASURY_HD_INDEX = 0

/**
 * Derive a unique deposit keypair for an order.
 * Path: m/44'/501'/<index>'/0' — Solana BIP44, fully hardened (ed25519 requires hardened).
 *
 * Accepts number | string | bigint because pg's node-postgres library returns INT8/BIGINT
 * column values as JavaScript strings by default (to avoid Number.MAX_SAFE_INTEGER overflow).
 */
export function deriveOrderKeypair(index: number | string | bigint): Keypair {
  const mnemonic = process.env.HD_WALLET_MNEMONIC
  if (!mnemonic || !mnemonic.trim()) throw new Error('HD_WALLET_MNEMONIC not set')

  // Normalise pg "bigint as string" (e.g. "1") or BigInt wrapper before the integer check.
  const n = typeof index === 'string' ? Number(index) : typeof index === 'bigint' ? Number(index) : index
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid HD index: ${index}`)

  const seed = mnemonicToSeedSync(mnemonic.trim())
  const { key } = derivePath(`m/44'/501'/${n}'/0'`, seed.toString('hex'))
  return Keypair.fromSeed(key)
}

/** Base58 deposit address for an order index. */
export function getOrderAddress(index: number | string | bigint): string {
  return deriveOrderKeypair(index).publicKey.toBase58()
}

/** Load the treasury / hot wallet keypair (reuses the existing authority secret env). */
export function getTreasuryKeypair(): Keypair {
  const base58 = process.env.SOLAIRUS_AUTHORITY_SECRET_BASE58
  const path = process.env.SOLAIRUS_AUTHORITY_KEYPAIR_PATH

  if (base58 && base58.trim().length > 0) {
    try {
      return Keypair.fromSecretKey(bs58.decode(base58.trim()))
    } catch {
      throw new Error('Invalid SOLAIRUS_AUTHORITY_SECRET_BASE58: failed to decode base58 secret')
    }
  }

  if (path && path.trim().length > 0) {
    const stat = fs.statSync(path)
    // Expect chmod 600 (no group/others permissions)
    if ((stat.mode & 0o077) !== 0) {
      throw new Error(`Unsafe permissions on ${path}. Expected chmod 600.`)
    }
    const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as number[]
    return Keypair.fromSecretKey(Uint8Array.from(raw))
  }

  throw new Error('Treasury key not configured. Set SOLAIRUS_AUTHORITY_SECRET_BASE58 or SOLAIRUS_AUTHORITY_KEYPAIR_PATH.')
}

/** Base58 public key of the treasury (safe to expose for monitoring/verification). */
export function getTreasuryAddress(): string {
  return getTreasuryKeypair().publicKey.toBase58()
}
