/**
 * Withdrawals service
 * Purpose: Build Anchor-compatible claim_rewards transaction for user withdrawals.
 * Inputs:
 *  - initiatorWallet: authenticated user's wallet (fee payer)
 *  - recipient: recipient wallet (must match initiator for self-withdrawal)
 *  - mintAddress: USDT mint address (string)
 *  - amountMicro: amount in micro-USDT (6 decimals) as integer
 *  - recipientAta: recipient's USDT ATA (must exist on-chain)
 *  - memo: optional string memo
 * Outputs:
 *  - { referencePubkey, txBase64, ttlMs }
 * Core Logic:
 *  - Validate recipient ATA owner/mint using getParsedAccountInfo
 *  - Derive PDAs (config, vault_authority, vault_ata)
 *  - Build claim_rewards instruction using IDL discriminator and Borsh encoding
 *  - Construct Transaction (feePayer=user), set recent blockhash (TTL ~2 min), partial-sign with backend authority
 *  - Serialize base64 with requireAllSignatures=false
 */
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, ParsedAccountData } from '@solana/web3.js'
import { getAuthorityKeypair } from '../lib/authority'
import { getConnection } from '../lib/rpc-manager'

// Program IDs and constants from IDL
const PROGRAM_ID = new PublicKey(process.env.SOLAIRUS_PAY_PROGRAM_ID || '5eRuzYxGUE4VHadPEhihHMpuPa6n2WvCR6ENx3WSW6ek')
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

// IDL discriminator for claim_rewards
const CLAIM_REWARDS_DISC = Buffer.from([4, 144, 132, 71, 116, 23, 151, 80])

// Borsh-like helpers for encoding args (pubkey, u64 le, u8, string length + bytes)
function encodePubkey(pubkey: PublicKey): Buffer {
  return pubkey.toBuffer()
}
function encodeU64LE(n: bigint): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(n)
  return buf
}
function encodeU8(n: number): Buffer {
  const buf = Buffer.alloc(1)
  buf.writeUInt8(n)
  return buf
}
function encodeString(str: string): Buffer {
  const data = Buffer.from(str, 'utf8')
  const len = Buffer.alloc(4)
  len.writeUInt32LE(data.length)
  return Buffer.concat([len, data])
}

function deriveConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID)
  return pda
}
function deriveVaultAuthority(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), mint.toBuffer()], PROGRAM_ID)
  return pda
}
function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return pda
}

export async function buildClaimRewardsTx(params: {
  initiatorWallet: string
  recipient: string
  mintAddress: string
  amountMicro: number
  recipientAta: string
  memo?: string
  referencePubkey: string
}): Promise<{ referencePubkey: string; txBase64: string; ttlMs: number }> {
  // Use RPC manager for automatic failover
  const connection = getConnection()

  const initiator = new PublicKey(params.initiatorWallet)
  const recipient = new PublicKey(params.recipient)
  const mint = new PublicKey(params.mintAddress)
  const recipientAta = new PublicKey(params.recipientAta)
  const reference = new PublicKey(params.referencePubkey)
  const amountMicro = BigInt(params.amountMicro)
  const memo = params.memo ?? ''

  if (!initiator.equals(recipient)) {
    throw new Error('Initiator must match recipient for user_withdrawal')
  }
  if (amountMicro <= 0n) {
    throw new Error('Withdrawal amount must be positive')
  }

  // Validate recipient ATA exists and matches owner/mint via parsed account info
  const parsedInfo = await connection.getParsedAccountInfo(recipientAta, 'confirmed')
  if (!parsedInfo.value || parsedInfo.value.owner?.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
    throw new Error('Recipient ATA not found or invalid')
  }
  const accountData = parsedInfo.value.data as ParsedAccountData
  const parsedToken = accountData.parsed as { info: { owner: string; mint: string } }
  const ownerMatch = parsedToken?.info?.owner === recipient.toBase58()
  const mintMatch = parsedToken?.info?.mint === mint.toBase58()
  if (!ownerMatch || !mintMatch) {
    throw new Error('Recipient ATA owner/mint mismatch')
  }

  const config = deriveConfigPda()
  const vaultAuth = deriveVaultAuthority(mint)
  const vaultAta = deriveAta(vaultAuth, mint)

  // Build claim_rewards instruction data
  const argsBuf = Buffer.concat([
    encodePubkey(recipient),
    encodePubkey(mint),
    encodeU64LE(amountMicro),
    encodeU8(6), // USDT decimals
    encodeString(memo),
  ])
  const ixData = Buffer.concat([CLAIM_REWARDS_DISC, argsBuf])

  const keys = [
    { pubkey: getAuthorityKeypair().publicKey, isSigner: true, isWritable: true }, // authority
    { pubkey: recipient, isSigner: false, isWritable: false }, // recipient
    { pubkey: mint, isSigner: false, isWritable: false }, // mint
    { pubkey: vaultAuth, isSigner: false, isWritable: false }, // vault_authority (PDA)
    { pubkey: vaultAta, isSigner: false, isWritable: true }, // vault_ata
    { pubkey: recipientAta, isSigner: false, isWritable: true }, // recipient_ata
    { pubkey: reference, isSigner: false, isWritable: false }, // reference
    { pubkey: config, isSigner: false, isWritable: false }, // config
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ]
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data: ixData })

  const recent = await connection.getLatestBlockhash('confirmed')
  const tx = new Transaction()
  tx.feePayer = initiator
  tx.recentBlockhash = recent.blockhash
  tx.add(ix)

  // Partial sign with backend authority
  const authority = getAuthorityKeypair()
  tx.partialSign(authority)

  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  const txBase64 = serialized.toString('base64')

  // TTL guidance: ~2 minutes (blockhash expiry). Caller shows countdown and no auto-retry.
  const ttlMs = 120000

  return { referencePubkey: reference.toBase58(), txBase64, ttlMs }
}