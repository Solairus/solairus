#!/usr/bin/env node
/**
 * Set backend_authority on-chain (solairus_pay) and update backend .env
 * Purpose:
 *  - Use the default Solana CLI wallet (id.json) as the backend authority
 *  - Invoke the program's `set_backend_authority` instruction (init_if_needed for config)
 *  - Base58-encode the wallet's secret and update `SOLAIRUS_AUTHORITY_SECRET_BASE58` in backend `.env`
 *
 * Safety:
 *  - Does NOT print secrets; only writes to .env
 *  - Targets Devnet by default (`SOLANA_RPC_URL` can override)
 *
 * Usage:
 *  - `node scripts/set-backend-authority.js`
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const bs58 = require('bs58').default
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} = require('@solana/web3.js')

// Load backend .env (and root .env as fallback)
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
  // also attempt root .env for local setups
  try { require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') }) } catch (_) {}
} catch (_) {}

// Constants
const BPF_LOADER_UPGRADEABLE_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')

function getDefaultWalletKeypair() {
  const walletPath = path.resolve(process.env.HOME || '', '.config/solana/id.json')
  const raw = JSON.parse(fs.readFileSync(walletPath, 'utf-8'))
  const secret = Uint8Array.from(raw)
  return Keypair.fromSecretKey(secret)
}

function getProgramId() {
  // Prefer env override if set; otherwise attempt to read IDL; fallback to env of UI if present
  const envPid = process.env.SOLAIRUS_PAY_PROGRAM_ID
  if (envPid && envPid.trim().length > 0) return new PublicKey(envPid.trim())

  const idlCandidates = [
    path.resolve(__dirname, '..', '..', 'solairus-contract', 'target', 'idl', 'solairus_pay.json'),
    path.resolve(__dirname, '..', '..', 'src', 'idl', 'solairus_pay.json'),
  ]
  for (const p of idlCandidates) {
    if (fs.existsSync(p)) {
      try {
        const idl = JSON.parse(fs.readFileSync(p, 'utf-8'))
        const addr = idl.address || (idl.metadata && idl.metadata.address)
        if (addr) return new PublicKey(addr)
      } catch (_) {}
    }
  }
  throw new Error('Program ID not found. Set SOLAIRUS_PAY_PROGRAM_ID in backend .env or ensure IDL exists.')
}

function deriveConfigPda(programId) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
  return pda
}

function getProgramDataAddress(programId) {
  const [pda] = PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_LOADER_UPGRADEABLE_ID)
  return pda
}

function getSetBackendAuthorityDiscriminator() {
  // Anchor instruction discriminator: sha256("global:set_backend_authority").slice(0, 8)
  const h = crypto.createHash('sha256').update('global:set_backend_authority').digest()
  return h.slice(0, 8)
}

function buildSetBackendAuthorityIx({ programId, upgradeAuthority, newBackendAuthority }) {
  const configPda = deriveConfigPda(programId)
  const programData = getProgramDataAddress(programId)

  const disc = getSetBackendAuthorityDiscriminator()
  const data = Buffer.concat([disc, newBackendAuthority.toBuffer() /* 32 bytes */])

  return new TransactionInstruction({
    keys: [
      { pubkey: upgradeAuthority.publicKey, isSigner: true, isWritable: true }, // upgrade_authority
      { pubkey: configPda, isSigner: false, isWritable: true }, // config (init_if_needed)
      { pubkey: programId, isSigner: false, isWritable: false }, // program (const)
      { pubkey: programData, isSigner: false, isWritable: false }, // program_data
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId,
    data,
  })
}

function getInitializeConfigDiscriminator() {
  const h = crypto.createHash('sha256').update('global:initialize_config').digest()
  return h.slice(0, 8)
}

function buildInitializeConfigIx({ programId, payer, backendAuthority }) {
  const configPda = deriveConfigPda(programId)
  const disc = getInitializeConfigDiscriminator()
  const data = Buffer.concat([disc, backendAuthority.toBuffer()])
  return new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: configPda, isSigner: false, isWritable: true }, // config (init)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId,
    data,
  })
}

function updateEnvSecretBase58({ envPath, secretBase58 }) {
  // Read existing .env, update or append the variable
  let content = ''
  try {
    content = fs.readFileSync(envPath, 'utf-8')
  } catch (_) {
    // If missing, bootstrap from example
    const examplePath = path.join(path.dirname(envPath), '.env.example')
    if (fs.existsSync(examplePath)) content = fs.readFileSync(examplePath, 'utf-8')
  }

  const lines = content.split('\n')
  let found = false
  const updatedLines = lines.map((line) => {
    if (line.startsWith('SOLAIRUS_AUTHORITY_SECRET_BASE58=')) {
      found = true
      return `SOLAIRUS_AUTHORITY_SECRET_BASE58=${secretBase58}`
    }
    return line
  })
  if (!found) {
    updatedLines.push(`SOLAIRUS_AUTHORITY_SECRET_BASE58=${secretBase58}`)
  }
  fs.writeFileSync(envPath, updatedLines.join('\n'))
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
  const conn = new Connection(rpcUrl, 'confirmed')

  const wallet = getDefaultWalletKeypair()
  const programId = getProgramId()

  // Try initialize_config first (fresh setup); if it fails with already exists, fallback to set_backend_authority
  let sig
  try {
    const initIx = buildInitializeConfigIx({ programId, payer: wallet, backendAuthority: wallet.publicKey })
    sig = await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [wallet], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    })
    console.log('[set-backend-authority] initialize_config confirmed:', sig)
  } catch (e) {
    console.log('[set-backend-authority] initialize_config failed, attempting set_backend_authority...')
    const setIx = buildSetBackendAuthorityIx({
      programId,
      upgradeAuthority: wallet,
      newBackendAuthority: wallet.publicKey,
    })
    sig = await sendAndConfirmTransaction(conn, new Transaction().add(setIx), [wallet], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    })
    console.log('[set-backend-authority] set_backend_authority confirmed:', sig)
  }

  // Verify backend_authority from config
  const configPda = deriveConfigPda(programId)
  const info = await conn.getAccountInfo(configPda)
  if (!info || !info.data || info.data.length < 8 + 32) {
    throw new Error('Config account missing or invalid after set_backend_authority')
  }
  const backendAuthorityBytes = info.data.slice(8, 8 + 32)
  const backendAuthority = new PublicKey(backendAuthorityBytes)
  const expected = wallet.publicKey.toBase58()
  const actual = backendAuthority.toBase58()
  console.log('[set-backend-authority] on-chain backend_authority:', actual)
  if (actual !== expected) throw new Error('On-chain backend_authority does not match wallet')

  // Update backend .env with base58-encoded secret
  const secretBase58 = bs58.encode(wallet.secretKey)
  const envPath = path.resolve(__dirname, '..', '.env')
  updateEnvSecretBase58({ envPath, secretBase58 })
  console.log('[set-backend-authority] updated backend .env: SOLAIRUS_AUTHORITY_SECRET_BASE58=(secret)')
}

main().catch((err) => {
  console.error('[set-backend-authority] failed:', err)
  process.exit(1)
})