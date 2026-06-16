// Environment variable debugging utility

export function debugEnvironmentVariables() {
  console.log('🔍 Environment Variables Debug:')
  console.log('VITE_SOLANA_CLUSTER:', import.meta.env.VITE_SOLANA_CLUSTER)
  console.log('VITE_SOLANA_RPC_URL_MAINNET:', import.meta.env.VITE_SOLANA_RPC_URL_MAINNET)
  console.log('VITE_SOLANA_RPC_URL_DEVNET:', import.meta.env.VITE_SOLANA_RPC_URL_DEVNET)
  console.log('VITE_SOLANA_RPC_URL_TESTNET:', import.meta.env.VITE_SOLANA_RPC_URL_TESTNET)
  console.log('All VITE_ variables:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')))
}

// Call this immediately to see what's loaded
debugEnvironmentVariables()