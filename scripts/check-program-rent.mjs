import { config as dotenvConfig } from 'dotenv'
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'

// Load environment variables from .env if present
dotenvConfig()

async function main() {
  // Program ID from IDL, fallback to env override if provided
  const defaultProgramId = 'EeyQpZxE1KqmsAinGaJf7kcTGVAHXu2KT2AzepwYRysf'
  const programIdStr = process.env.SOLAIRUS_MAIN_PROGRAM_ID || defaultProgramId
  const programId = new PublicKey(programIdStr)

  // Resolve mainnet RPC endpoint: prefer first of VITE_SOLANA_RPC_URL_MAINNET if set
  const envMainnet = process.env.VITE_SOLANA_RPC_URL_MAINNET || process.env.SOLANA_RPC_URL_MAINNET || ''
  const endpointCandidates = envMainnet.split(',').map(s => s.trim()).filter(Boolean)
  const endpoint = endpointCandidates[0] || clusterApiUrl('mainnet-beta')

  const conn = new Connection(endpoint, 'confirmed')

  const info = await conn.getAccountInfo(programId)
  if (!info) {
    console.error('Program account not found on mainnet:', programId.toBase58())
    process.exit(2)
  }

  // Derive and fetch ProgramData account (for upgradeable programs)
  const UPGRADEABLE_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
  const programDataAddress = PublicKey.findProgramAddressSync([
    programId.toBuffer()
  ], UPGRADEABLE_LOADER_ID)[0]
  const dataInfo = await conn.getAccountInfo(programDataAddress)

  const size = info.data.length
  const lamports = info.lamports
  const rentExempt = await conn.getMinimumBalanceForRentExemption(size)

  const dataSize = dataInfo?.data?.length ?? 0
  const dataLamports = dataInfo?.lamports ?? 0
  const dataRentExempt = await conn.getMinimumBalanceForRentExemption(dataSize)

  const LAMPORTS_PER_SOL = 1_000_000_000

  const result = {
    endpoint,
    programId: programId.toBase58(),
    executable: info.executable,
    owner: info.owner.toBase58(),
    note: 'Upgradeable program: code is stored in ProgramData account',
    programAccount: {
      address: programId.toBase58(),
      sizeBytes: size,
      lamports,
      lamportsInSOL: (lamports / LAMPORTS_PER_SOL),
      rentExemptMinimumLamports: rentExempt,
      rentExemptMinimumSOL: (rentExempt / LAMPORTS_PER_SOL)
    },
    programDataAccount: {
      address: programDataAddress.toBase58(),
      sizeBytes: dataSize,
      lamports: dataLamports,
      lamportsInSOL: (dataLamports / LAMPORTS_PER_SOL),
      rentExemptMinimumLamports: dataRentExempt,
      rentExemptMinimumSOL: (dataRentExempt / LAMPORTS_PER_SOL)
    }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error('Failed to query program account:', err)
  process.exit(1)
})