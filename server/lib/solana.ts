/**
 * Solana helper utilities
 * Purpose: Derive SolairusPay config PDA and read backend authority pubkey
 * Inputs: `SOLANA_RPC_URL` (optional), `SOLAIRUS_PAY_PROGRAM_ID` (optional)
 * Outputs: Backend authority public key (base58 string)
 */
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'

/** Default program ID for solairus_pay (from IDL). Can be overridden by env. */
const DEFAULT_SOLAIRUS_PAY_PROGRAM_ID = new PublicKey('6hvnwbkJqbFAWBKbrj22giH33hVUTLuLcPAvtCkkpSZ4')

/** Derive the config PDA for solairus_pay */
export function deriveSolairusPayConfigPda(programId?: PublicKey): PublicKey {
  const pid = programId || DEFAULT_SOLAIRUS_PAY_PROGRAM_ID
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('config')], pid)
  return pda
}

/**
 * Read backend authority from the solairus_pay config account.
 * - Verifies account exists
 * - Extracts 8-byte discriminator then 32-byte pubkey
 */
export async function getBackendAuthorityPublicKey(): Promise<string> {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
  const programIdStr = process.env.SOLAIRUS_PAY_PROGRAM_ID
  const programId = programIdStr ? new PublicKey(programIdStr) : DEFAULT_SOLAIRUS_PAY_PROGRAM_ID

  const connection = new Connection(rpcUrl, 'confirmed')
  const configPda = deriveSolairusPayConfigPda(programId)
  const info = await connection.getAccountInfo(configPda)

  if (!info || !info.data || info.data.length < 8 + 32) {
    throw new Error('SolairusPay config account not found or invalid')
  }

  // Discriminator (8 bytes) + backend_authority pubkey (32 bytes)
  const backendAuthorityBytes = info.data.slice(8, 8 + 32)
  const backendAuthority = new PublicKey(backendAuthorityBytes)
  return backendAuthority.toBase58()
}