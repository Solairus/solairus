// Convert a Solana JSON keypair file (array of numbers) to base58 secret
// Usage: node scripts/keyfile-to-base58.js /path/to/keypair.json
const fs = require('fs')
const bs58 = require('bs58').default

function main() {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: node scripts/keyfile-to-base58.js /path/to/keypair.json')
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
  if (!Array.isArray(raw)) {
    console.error('Keyfile is not a JSON array of numbers')
    process.exit(1)
  }
  const secret = Uint8Array.from(raw)
  const base58 = bs58.encode(secret)
  console.log(base58)
}

main()