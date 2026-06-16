// CORS-friendly RPC endpoints that work from browser/localhost

export const CORS_FRIENDLY_RPCS = {
  'mainnet-beta': [
    {
      url: 'https://solana-mainnet.core.chainstack.com/31b504e5061038deb849fef18ca51009',
      name: 'Chainstack',
      corsSupport: true,
      rateLimit: 'High',
      notes: 'Chainstack RPC, reliable and fast'
    },
    {
      url: 'https://solana-mainnet.g.alchemy.com/v2/NTfRANLBBSl4wOmIIX3Xc',
      name: 'Alchemy (Premium)',
      corsSupport: true,
      rateLimit: 'Very High',
      notes: 'Alchemy premium RPC with API key, excellent performance'
    },
    {
      url: 'https://api.mainnet-beta.solana.com',
      name: 'Solana Labs (Official)',
      corsSupport: true,
      rateLimit: 'High',
      notes: 'Official Solana RPC, reliable but rate limited'
    },
    {
      url: 'https://solana-api.projectserum.com',
      name: 'Project Serum',
      corsSupport: true,
      rateLimit: 'Medium',
      notes: 'Community RPC, good for development'
    }
  ],
  'devnet': [
    {
      url: 'https://api.devnet.solana.com',
      name: 'Solana Labs Devnet',
      corsSupport: true,
      rateLimit: 'Low',
      notes: 'Official devnet RPC'
    }
  ],
  'testnet': [
    {
      url: 'https://api.testnet.solana.com',
      name: 'Solana Labs Testnet',
      corsSupport: true,
      rateLimit: 'Low',
      notes: 'Official testnet RPC'
    }
  ]
}

export const PREMIUM_RPC_PROVIDERS = {
  helius: {
    name: 'Helius',
    website: 'https://helius.xyz',
    mainnet: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    devnet: 'https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    features: ['High rate limits', 'Enhanced APIs', 'Webhooks', 'Analytics']
  },
  quicknode: {
    name: 'QuickNode',
    website: 'https://quicknode.com',
    mainnet: 'https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_API_KEY/',
    devnet: 'https://your-endpoint.solana-devnet.quiknode.pro/YOUR_API_KEY/',
    features: ['Global infrastructure', 'High performance', 'Add-ons', '24/7 support']
  },
  alchemy: {
    name: 'Alchemy',
    website: 'https://alchemy.com',
    mainnet: 'https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    devnet: 'https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY',
    features: ['Enhanced APIs', 'NFT APIs', 'Webhooks', 'Analytics dashboard']
  },
  genesysgo: {
    name: 'GenesysGo',
    website: 'https://genesysgo.com',
    mainnet: 'https://ssc-dao.genesysgo.net/',
    features: ['High performance', 'Solana-focused', 'Community-driven']
  },
  chainstack: {
    name: 'Chainstack',
    website: 'https://chainstack.com',
    mainnet: 'https://solana-mainnet.core.chainstack.com/YOUR_API_KEY',
    devnet: 'https://solana-devnet.core.chainstack.com/YOUR_API_KEY',
    features: ['CORS-friendly', 'High reliability', 'Global infrastructure', 'Developer-focused']
  }
}

export function getCorsInfo(): string {
  return `
🌐 CORS (Cross-Origin Resource Sharing) Info:

Many RPC providers block requests from localhost for security reasons.
This is normal and expected during development.

✅ CORS-Friendly (work from localhost):
• Solana Labs official RPCs
• Project Serum RPC
• Some community RPCs

❌ CORS-Blocked (require production domain):
• Most premium RPC providers
• Private/paid RPC endpoints
• Some third-party services

🚀 For Production:
• Deploy your app to a domain
• CORS restrictions don't apply to deployed apps
• All RPC providers work normally

🔑 For Development with Premium RPCs:
• Use browser extensions to disable CORS
• Set up a local proxy server
• Use API keys in environment variables
  `
}

export function getRecommendedRpcs(cluster: 'mainnet-beta' | 'devnet' | 'testnet') {
  return CORS_FRIENDLY_RPCS[cluster] || []
}