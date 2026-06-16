#!/usr/bin/env node
/**
 * Create a Solana signer keypair and store it at solana/signer.json
 * Purpose: Generate a dedicated backend signer for program administration.
 * Inputs: Optional flag `--force` to overwrite existing file.
 * Outputs: Writes JSON array secret key to `solana/signer.json` with chmod 600; logs public key.
 */
const fs = require('fs')
const path = require('path')
const { Keypair } = require('@solana/web3.js')

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true })
  }
}

function main() {
  const force = process.argv.includes('--force')
  const home = process.env.HOME || ''
  const dir = path.join(home, '.config', 'solana')
  const outPath = path.join(dir, 'solairus_authority.json')

  ensureDir(dir)

  if (fs.existsSync(outPath) && !force) {
    console.error(`Keyfile already exists at ${outPath}. Use --force to overwrite.`)
    process.exit(1)
  }

  const kp = Keypair.generate()
  const secret = Array.from(kp.secretKey)

  fs.writeFileSync(outPath, JSON.stringify(secret))
  try {
    // Restrict permissions: chmod 600
    fs.chmodSync(outPath, 0o600)
  } catch (_) {}

  console.log(`[create-signer] Created signer at ${outPath}`)
  console.log(`[create-signer] Public Key: ${kp.publicKey.toBase58()}`)
}

main()