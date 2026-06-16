/**
 * Environment variable validation for production deployments
 */

interface EnvValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required variables
  const requiredVars = [
    'VITE_SOLANA_CLUSTER',
    'VITE_DEFAULT_SPONSOR_ADDRESS',
  ]

  for (const varName of requiredVars) {
    if (!import.meta.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`)
    }
  }

  // Validate WalletConnect Project IDs
  const projectIds = getWalletConnectProjectIds()
  if (projectIds.length === 0) {
    warnings.push('No WalletConnect project IDs found - wallet connection may not work')
  } else {
    console.log(`✅ Found ${projectIds.length} WalletConnect project ID(s)`)
  }

  // Validate RPC URLs
  const rpcUrls = getSolanaRpcUrls()
  if (rpcUrls.length === 0) {
    warnings.push('No Solana RPC URLs found - using fallback endpoints')
  } else {
    console.log(`✅ Found ${rpcUrls.length} Solana RPC URL(s)`)
  }

  // Validate cluster setting
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER?.toLowerCase()
  if (!['mainnet-beta', 'mainnet', 'devnet', 'testnet'].includes(cluster)) {
    errors.push(`Invalid VITE_SOLANA_CLUSTER: ${cluster}. Must be 'mainnet-beta', 'devnet', or 'testnet'`)
  }

  // Validate Solairus program IDs (now optional for lazy initialization)
  const mainProgramId = import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID
  const payProgramId = import.meta.env.VITE_SOLAIRUS_PAY_PROGRAM_ID
  
  if (!mainProgramId) {
    warnings.push('VITE_SOLAIRUS_MAIN_PROGRAM_ID not set - will validate during payment/withdrawal initialization')
  }
  
  if (!payProgramId) {
    warnings.push('VITE_SOLAIRUS_PAY_PROGRAM_ID not set - will validate during payment/withdrawal initialization')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

function getWalletConnectProjectIds(): string[] {
  const projectIds: string[] = []
  
  // Primary project ID
  const primary = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
  if (primary) {
    // Check if it's comma-separated
    if (primary.includes(',')) {
      projectIds.push(...primary.split(',').map(id => id.trim()).filter(Boolean))
    } else {
      projectIds.push(primary)
    }
  }
  
  // Fallback project IDs
  const fallbacks = [
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_2,
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_3,
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_4,
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID_5,
  ].filter(Boolean)
  
  projectIds.push(...fallbacks)
  
  return projectIds
}

function getSolanaRpcUrls(): string[] {
  const urls: string[] = []
  
  // Mainnet URLs
  const mainnet = import.meta.env.VITE_SOLANA_RPC_URL_MAINNET
  if (mainnet) {
    if (mainnet.includes(',')) {
      urls.push(...mainnet.split(',').map(url => url.trim()).filter(Boolean))
    } else {
      urls.push(mainnet)
    }
  }
  
  // Additional mainnet URLs
  const additionalMainnet = [
    import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_2,
    import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_3,
    import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_4,
    import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_5,
  ].filter(Boolean)
  
  urls.push(...additionalMainnet)
  
  // Devnet and testnet
  const devnet = import.meta.env.VITE_SOLANA_RPC_URL_DEVNET
  const testnet = import.meta.env.VITE_SOLANA_RPC_URL_TESTNET
  
  if (devnet) urls.push(devnet)
  if (testnet) urls.push(testnet)
  
  return urls
}

export function logEnvironmentStatus(): void {
  const validation = validateEnvironmentVariables()
  
  console.log('🔍 Environment Variable Validation:')
  
  if (validation.isValid) {
    console.log('✅ All required environment variables are present')
  } else {
    console.error('❌ Environment validation failed:')
    validation.errors.forEach(error => console.error(`  - ${error}`))
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:')
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }
  
  // Log current configuration
  console.log('📋 Current Configuration:')
  console.log(`  - Cluster: ${import.meta.env.VITE_SOLANA_CLUSTER}`)
  console.log(`  - Main Program ID: ${import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID || 'Not set (lazy validation)'}`)
  console.log(`  - Pay Program ID: ${import.meta.env.VITE_SOLAIRUS_PAY_PROGRAM_ID || 'Not set (lazy validation)'}`)
  console.log(`  - Wallet Guard: ${import.meta.env.VITE_ENABLE_WALLET_GUARD}`)
  console.log(`  - License Guard: ${import.meta.env.VITE_ENABLE_LICENSE_GUARD}`)
  console.log(`  - Project IDs: ${getWalletConnectProjectIds().length} configured`)
  console.log(`  - RPC URLs: ${getSolanaRpcUrls().length} configured`)
}