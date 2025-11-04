import { config as dotenvConfig } from 'dotenv'
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import fs from 'fs'
import path from 'path'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

// Load environment variables
dotenvConfig()

async function main() {
  const defaultProgramId = 'EeyQpZxE1KqmsAinGaJf7kcTGVAHXu2KT2AzepwYRysf'
  const programIdStr = process.env.SOLAIRUS_MAIN_PROGRAM_ID || defaultProgramId
  const programId = new PublicKey(programIdStr)

  // Resolve mainnet endpoint
  const envMainnet = process.env.VITE_SOLANA_RPC_URL_MAINNET || process.env.SOLANA_RPC_URL_MAINNET || ''
  const endpointCandidates = envMainnet.split(',').map(s => s.trim()).filter(Boolean)
  const endpoint = endpointCandidates[0] || clusterApiUrl('mainnet-beta')

  const conn = new Connection(endpoint, 'confirmed')

  // Derive PDAs: config and vault
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId)

  // Load IDL and decode config via BorshCoder
  const idlPath = path.resolve(process.cwd(), 'src/idl/solairus_main.json')
  const idlRaw = fs.readFileSync(idlPath, 'utf-8')
  const idl = JSON.parse(idlRaw)

  const configInfo = await conn.getAccountInfo(configPda)
  if (!configInfo) {
    throw new Error(`Config account not found: ${configPda.toBase58()}`)
  }

  const coder = new anchor.BorshCoder(idl)
  const decodedConfig = coder.accounts.decode('Config', configInfo.data)
  const usdtMint = decodedConfig.usdt_mint // IDL uses snake_case

  // Derive the program vault's USDT ATA (owner is PDA, so set allowOwnerOffCurve=true)
  const vaultUsdtAta = getAssociatedTokenAddressSync(usdtMint, vaultPda, true)

  const ataInfo = await conn.getAccountInfo(vaultUsdtAta)
  const LAMPORTS_PER_SOL = 1_000_000_000

  // Rent-exempt minimum for SPL Token account size (165 bytes)
  const tokenAccountSize = 165
  const rentMin = await conn.getMinimumBalanceForRentExemption(tokenAccountSize)

  // Fetch token balance (if account exists)
  let tokenBalanceRaw = null
  let tokenBalanceUi = null
  let tokenBalanceDecimals = null
  if (ataInfo) {
    try {
      const bal = await conn.getTokenAccountBalance(vaultUsdtAta)
      tokenBalanceRaw = bal?.value?.amount ?? null
      tokenBalanceUi = bal?.value?.uiAmountString ?? null
      tokenBalanceDecimals = bal?.value?.decimals ?? null
    } catch (e) {
      // Not a fatal error; leave token balance fields null
    }
  }

  const result = {
    endpoint,
    programId: programId.toBase58(),
    configPda: configPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    usdtMint: usdtMint.toBase58(),
    vaultUsdtAta: vaultUsdtAta.toBase58(),
    vaultUsdtAtaExists: Boolean(ataInfo),
    vaultUsdtAtaLamports: ataInfo?.lamports ?? 0,
    vaultUsdtAtaLamportsSOL: ((ataInfo?.lamports ?? 0) / LAMPORTS_PER_SOL),
    rentExemptMinimumLamports: rentMin,
    rentExemptMinimumSOL: (rentMin / LAMPORTS_PER_SOL),
    vaultUsdtAtaTokenAmountRaw: tokenBalanceRaw,
    vaultUsdtAtaTokenAmountUi: tokenBalanceUi,
    vaultUsdtAtaTokenDecimals: tokenBalanceDecimals,
    closableNow: Boolean(ataInfo && tokenBalanceRaw === '0'),
    recoverabilityNotes: [
      'You can recover lamports by closing token accounts if you are the owner/close authority.',
      'ATAs owned by PDAs require the on-chain program to issue a close instruction; PDAs cannot sign externally.',
      'If the program exposes an instruction to close the vault ATA, those lamports can be recovered.'
    ]
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error('Failed to check USDT PDAs:', err)
  process.exit(1)
})