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

/** Load payer keypair: prefer ANCHOR_WALLET or DEPLOYER_KEYPAIR, fallback to default CLI wallet */
function getPayerKeypair() {
  const candidate = process.env.ANCHOR_WALLET || process.env.DEPLOYER_KEYPAIR || path.resolve(process.env.HOME || '', '.config', 'solana', 'id.json')
  if (!fs.existsSync(candidate)) {
    throw new Error(`Payer keyfile not found at ${candidate}. Set ANCHOR_WALLET or DEPLOYER_KEYPAIR env to the deployer keyfile path.`)
  }
  const raw = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
  const secret = Uint8Array.from(raw)
  return Keypair.fromSecretKey(secret)
}

/** Load backend authority pubkey: prefer SOLAIRUS_AUTHORITY_SECRET_BASE58, fallback to ~/.config/solana/solairus_authority.json */
function getBackendAuthorityPubkey() {
  const base58 = process.env.SOLAIRUS_AUTHORITY_SECRET_BASE58
  if (base58 && base58.trim().length > 0) {
    try {
      const secret = bs58.decode(base58.trim())
      const kp = Keypair.fromSecretKey(secret)
      return kp.publicKey
    } catch (_) {
      throw new Error('Invalid SOLAIRUS_AUTHORITY_SECRET_BASE58: failed to decode')
    }
  }
  const signerPath = path.resolve(process.env.HOME || '', '.config', 'solana', 'solairus_authority.json')
  if (!fs.existsSync(signerPath)) {
    throw new Error(`Backend authority file not found at ${signerPath}. Run 'node scripts/create-signer.js' and set SOLAIRUS_AUTHORITY_SECRET_BASE58 in .env.`)
  }
  const raw = JSON.parse(fs.readFileSync(signerPath, 'utf-8'))
  const secret = Uint8Array.from(raw)
  const kp = Keypair.fromSecretKey(secret)
  return kp.publicKey
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

function getSetBackendAuthorityDiscriminator() {
  // Anchor instruction discriminator: sha256("global:set_backend_authority").slice(0, 8)
  const h = crypto.createHash('sha256').update('global:set_backend_authority').digest()
  return h.slice(0, 8)
}

function buildSetBackendAuthorityIx({ programId, authority, newBackendAuthority }) {
  const configPda = deriveConfigPda(programId)
  const disc = getSetBackendAuthorityDiscriminator()
  const data = Buffer.concat([disc, newBackendAuthority.toBuffer() /* 32 bytes */])
  return new TransactionInstruction({
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true }, // current backend authority
      { pubkey: configPda, isSigner: false, isWritable: true }, // config
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
  const payer = getPayerKeypair()
  const programId = getProgramId()
  const backendAuthorityPubkey = getBackendAuthorityPubkey()

  // Try initialize_config first (fresh setup); if it fails with already exists, fallback to set_backend_authority
  let sig
  try {
    const initIx = buildInitializeConfigIx({ programId, payer, backendAuthority: backendAuthorityPubkey })
    sig = await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [payer], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    })
    console.log('[set-backend-authority] initialize_config confirmed:', sig)
  } catch (e) {
    console.log('[set-backend-authority] initialize_config failed, attempting set_backend_authority...')
    // set_backend_authority must be signed by current backend authority; payer cannot perform it
    console.log('[set-backend-authority] Skipping set_backend_authority fallback: requires current backend authority signer.')
    throw e
  }

  // Verify backend_authority from config
  const configPda = deriveConfigPda(programId)
  const info = await conn.getAccountInfo(configPda)
  if (!info || !info.data || info.data.length < 8 + 32) {
    throw new Error('Config account missing or invalid after set_backend_authority')
  }
  const backendAuthorityBytes = info.data.slice(8, 8 + 32)
  const backendAuthority = new PublicKey(backendAuthorityBytes)
  const expected = backendAuthorityPubkey.toBase58()
  const actual = backendAuthority.toBase58()
  console.log('[set-backend-authority] on-chain backend_authority:', actual)
  if (actual !== expected) throw new Error('On-chain backend_authority does not match wallet')

  // Update backend .env with base58-encoded secret from signer
  // If env already contains SOLAIRUS_AUTHORITY_SECRET_BASE58, keep it; otherwise attempt to write from local signer file
  const secretBase58 = process.env.SOLAIRUS_AUTHORITY_SECRET_BASE58 || (() => {
    try {
      const signerPath = path.resolve(process.env.HOME || '', '.config', 'solana', 'solairus_authority.json')
      const raw = JSON.parse(fs.readFileSync(signerPath, 'utf-8'))
      return bs58.encode(Uint8Array.from(raw))
    } catch (_) {
      return ''
    }
  })()
  const envPath = path.resolve(__dirname, '..', '.env')
  if (secretBase58 && secretBase58.length > 0) {
    updateEnvSecretBase58({ envPath, secretBase58 })
    console.log('[set-backend-authority] ensured backend .env has SOLAIRUS_AUTHORITY_SECRET_BASE58')
  } else {
    console.log('[set-backend-authority] skipped .env secret update (no local signer secret available)')
  }
}

main().catch((err) => {
  console.error('[set-backend-authority] failed:', err)
  process.exit(1)
})