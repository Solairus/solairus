/**
 * Debug utility to check environment variables on Vercel
 */

export function debugEnvironmentVariables() {
  console.log('🔍 Vercel Environment Debug:')
  console.log('='.repeat(50))
  
  // Check WalletConnect Project IDs
  console.log('📱 WalletConnect Project IDs:')
  console.log('  Primary:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'NOT SET')
  console.log('  Fallback 2:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_2 || 'NOT SET')
  console.log('  Fallback 3:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_3 || 'NOT SET')
  console.log('  Fallback 4:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_4 || 'NOT SET')
  
  // Check RPC URLs
  console.log('🌐 Solana RPC URLs:')
  console.log('  Primary:', import.meta.env.VITE_SOLANA_RPC_URL_MAINNET || 'NOT SET')
  console.log('  Fallback 2:', import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_2 || 'NOT SET')
  console.log('  Fallback 3:', import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_3 || 'NOT SET')
  console.log('  Fallback 4:', import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_4 || 'NOT SET')
  
  // Check other critical variables
  console.log('⚙️ Other Configuration:')
  console.log('  Cluster:', import.meta.env.VITE_SOLANA_CLUSTER || 'NOT SET')
  console.log('  Program ID:', import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID || 'NOT SET')
  console.log('  Wallet Guard:', import.meta.env.VITE_ENABLE_WALLET_GUARD || 'NOT SET')
  
  // Check if we're in production
  console.log('🏗️ Build Environment:')
  console.log('  Mode:', import.meta.env.MODE)
  console.log('  Dev:', import.meta.env.DEV)
  console.log('  Prod:', import.meta.env.PROD)
  
  console.log('='.repeat(50))
  
  // Return summary for programmatic use
  return {
    hasProjectIds: !!(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID),
    hasRpcUrls: !!(import.meta.env.VITE_SOLANA_RPC_URL_MAINNET),
    projectIdCount: [
      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_2,
      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_3,
      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_4,
    ].filter(Boolean).length,
    rpcUrlCount: [
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET,
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_2,
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_3,
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_4,
    ].filter(Boolean).length
  }
}