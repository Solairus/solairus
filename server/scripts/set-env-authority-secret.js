#!/usr/bin/env node
/**
 * Update SOLAIRUS_AUTHORITY_SECRET_BASE58 in .env without any on-chain calls
 *
 * Purpose:
 *  - Read signer keypair from ~/.config/solana/solairus_authority.json (or SOLAIRUS_AUTHORITY_KEYPAIR_PATH)
 *  - Base58-encode the secret key and write SOLAIRUS_AUTHORITY_SECRET_BASE58 to env files
 *
 * Safety:
 *  - Does NOT print or log the secret; only writes to .env
 *  - Does not require SOL or network access; purely local update
 *
 * Usage:
 *  - `node scripts/set-env-authority-secret.js`
 *  - Optional: set `SOLAIRUS_AUTHORITY_KEYPAIR_PATH` to override keypair location
 */
const fs = require('fs')
const path = require('path')
const bs58 = require('bs58').default

function getKeypairPath() {
  const fromEnv = process.env.SOLAIRUS_AUTHORITY_KEYPAIR_PATH
  if (fromEnv && fromEnv.trim().length > 0) return path.resolve(fromEnv.trim())
  return path.resolve(process.env.HOME || '', '.config', 'solana', 'solairus_authority.json')
}

function readSecretBase58(keypairPath) {
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Signer file not found at ${keypairPath}. Run 'node scripts/create-signer.js' first.`)
  }
  const raw = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))
  const secret = Uint8Array.from(raw)
  return bs58.encode(secret)
}

function updateEnv(envPath, secretBase58) {
  let content = ''
  try {
    content = fs.readFileSync(envPath, 'utf-8')
  } catch (_) {
    // Bootstrap from example if available
    const examplePath = path.join(path.dirname(envPath), '.env.example')
    if (fs.existsSync(examplePath)) content = fs.readFileSync(examplePath, 'utf-8')
  }

  const lines = content.split('\n')
  let found = false
  const updated = lines.map((line) => {
    if (line.startsWith('SOLAIRUS_AUTHORITY_SECRET_BASE58=')) {
      found = true
      return `SOLAIRUS_AUTHORITY_SECRET_BASE58=${secretBase58}`
    }
    return line
  })
  if (!found) updated.push(`SOLAIRUS_AUTHORITY_SECRET_BASE58=${secretBase58}`)
  fs.writeFileSync(envPath, updated.join('\n'))
}

function main() {
  const keypairPath = getKeypairPath()
  const secretBase58 = readSecretBase58(keypairPath)

  // Update backend .env
  const backendEnv = path.resolve(__dirname, '..', '.env')
  updateEnv(backendEnv, secretBase58)

  // Also attempt to update project root .env if present
  const rootEnv = path.resolve(__dirname, '..', '..', '.env')
  try {
    updateEnv(rootEnv, secretBase58)
  } catch (_) {}

  console.log('[set-env-authority-secret] updated .env files with SOLAIRUS_AUTHORITY_SECRET_BASE58=(secret)')
}

try {
  main()
} catch (err) {
  console.error('[set-env-authority-secret] failed:', err.message || err)
  process.exit(1)
}