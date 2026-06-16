// Devnet test provisioner: creates a 6-decimal SPL mint to stand in for USDT and
// mints test tokens to a wallet. The treasury (SOLAIRUS_AUTHORITY_SECRET_BASE58)
// is the payer + mint authority, so it must hold a little devnet SOL first.
//
// Fund the treasury (and your test wallet) with devnet SOL first — if `solana airdrop`
// is rate-limited, use the web faucet: https://faucet.solana.com
//
// Usage (from backend/):
//   node scripts/devnet-setup.js <recipientWallet> [amountWholeTokens]
//   e.g. node scripts/devnet-setup.js 7QUcVEDXpVU7sCW6Htb37jwpgrZrnBVPzk4LRBuzxRD9 1000
//
// Then put the printed mint into backend/.env as USDT_MINT_ADDRESS and restart (./start-dev.sh).
require('dotenv').config()
const bs58 = require('bs58')
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js')
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token')

const RPC = process.env.DEVNET_RPC || 'https://api.devnet.solana.com'
const DECIMALS = 6
const recipient = process.argv[2]
const amountWhole = BigInt(process.argv[3] || '1000')

async function main() {
  const secret = process.env.SOLAIRUS_AUTHORITY_SECRET_BASE58
  if (!secret) throw new Error('SOLAIRUS_AUTHORITY_SECRET_BASE58 not set in .env')
  const treasury = Keypair.fromSecretKey(bs58.decode(secret.trim()))
  const conn = new Connection(RPC, 'confirmed')

  const bal = await conn.getBalance(treasury.publicKey)
  console.log(`treasury ${treasury.publicKey.toBase58()} — ${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL (devnet)`)
  if (bal < 0.05 * LAMPORTS_PER_SOL) {
    console.log('Treasury low on SOL — trying a 1 SOL airdrop...')
    try {
      const sig = await conn.requestAirdrop(treasury.publicKey, LAMPORTS_PER_SOL)
      await conn.confirmTransaction(sig, 'confirmed')
      console.log('  airdrop ok')
    } catch (e) {
      throw new Error(`Treasury has too little SOL and airdrop failed (${e.message}). Fund ${treasury.publicKey.toBase58()} via https://faucet.solana.com then re-run.`)
    }
  }

  console.log('Creating 6-decimal test mint (treasury = payer + mint authority)...')
  const mint = await createMint(conn, treasury, treasury.publicKey, null, DECIMALS)
  console.log('  MINT:', mint.toBase58())

  if (recipient) {
    const owner = new PublicKey(recipient)
    const ata = await getOrCreateAssociatedTokenAccount(conn, treasury, mint, owner)
    await mintTo(conn, treasury, mint, ata.address, treasury, amountWhole * (10n ** BigInt(DECIMALS)))
    console.log(`  Minted ${amountWhole} test-USDT to ${owner.toBase58()}`)
  }

  console.log('\n=> Set in backend/.env:  USDT_MINT_ADDRESS=' + mint.toBase58())
  console.log('   (SOLANA_CLUSTER=devnet) then restart with ./start-dev.sh')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
