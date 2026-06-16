// Solana RPC endpoint configuration with fallbacks

export const RPC_ENDPOINTS = {
  'mainnet-beta': [
    // Primary RPC endpoints (with API keys)
    'https://solana-mainnet.core.chainstack.com/31b504e5061038deb849fef18ca51009',
    'https://solana-mainnet.g.alchemy.com/v2/NTfRANLBBSl4wOmIIX3Xc',
    
    // Free public endpoints (with rate limits)
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    
    // Note: For production, consider paid RPC providers:
    // - Helius: https://helius.xyz
    // - QuickNode: https://quicknode.com
    // - Alchemy: https://alchemy.com
    // - Chainstack: https://chainstack.com
  ],
  'devnet': [
    'https://api.devnet.solana.com',
  ],
  'testnet': [
    'https://api.testnet.solana.com',
  ]
}

export function getRpcEndpoint(cluster: string): string {
  const endpoints = RPC_ENDPOINTS[cluster as keyof typeof RPC_ENDPOINTS]
  if (!endpoints || endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for cluster: ${cluster}`)
  }
  
  // For now, return the first endpoint
  // In the future, you could implement endpoint health checking and rotation
  return endpoints[0]
}

export function getCustomRpcUrl(cluster: string): string | null {
  // Check for cluster-specific environment variables
  if (cluster === "mainnet-beta") {
    return import.meta.env.VITE_SOLANA_RPC_URL_MAINNET || import.meta.env.VITE_SOLANA_RPC_URL || null
  }
  if (cluster === "devnet") {
    return import.meta.env.VITE_SOLANA_RPC_URL_DEVNET || import.meta.env.VITE_SOLANA_RPC_URL || null
  }
  if (cluster === "testnet") {
    return import.meta.env.VITE_SOLANA_RPC_URL_TESTNET || import.meta.env.VITE_SOLANA_RPC_URL || null
  }
  return null
}