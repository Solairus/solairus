/**
 * Authority keypair loader
 * Purpose: Securely load Solairus backend authority keypair for signing on-chain ops
 * Inputs:
 *  - `SOLAIRUS_AUTHORITY_SECRET_BASE58` (preferred): base58-encoded secret key (64-byte)
 *  - `SOLAIRUS_AUTHORITY_KEYPAIR_PATH` (fallback): path to JSON array secret key file
 * Output:
 *  - `Keypair` instance for backend authority
 */
import fs from 'fs'
import bs58 from 'bs58'
import { Keypair } from '@solana/web3.js'

/** Load and return the Solairus backend authority keypair */
export function getAuthorityKeypair(): Keypair {
  const base58 = process.env.SOLAIRUS_AUTHORITY_SECRET_BASE58
  const path = process.env.SOLAIRUS_AUTHORITY_KEYPAIR_PATH

  if (base58 && base58.trim().length > 0) {
    try {
      const secret = bs58.decode(base58.trim())
      return Keypair.fromSecretKey(secret)
    } catch (e) {
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
    const secret = Uint8Array.from(raw)
    return Keypair.fromSecretKey(secret)
  }

  throw new Error(
    'Authority key not configured. Set SOLAIRUS_AUTHORITY_SECRET_BASE58 or SOLAIRUS_AUTHORITY_KEYPAIR_PATH.'
  )
}

/** Return the base58 public key of backend authority (safe to expose for verification) */
export function getAuthorityPublicKeyBase58(): string {
  const kp = getAuthorityKeypair()
  return kp.publicKey.toBase58()
}