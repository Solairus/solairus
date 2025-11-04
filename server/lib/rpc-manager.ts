/**
 * Backend RPC Manager
 * 
 * Provides simple RPC failover for backend Solana connections
 * - Supports multiple RPC endpoints per network (devnet/mainnet)
 * - Round-robin endpoint switching on failure
 * - Retry mechanism (3 attempts across different endpoints)
 * - No caching or health checks (keep it lightweight)
 */

import { Connection, clusterApiUrl } from '@solana/web3.js'

type ClusterName = 'devnet' | 'mainnet-beta'

interface RpcEndpoint {
  url: string
  name: string
}

class BackendRpcManager {
  private endpoints: Map<ClusterName, RpcEndpoint[]> = new Map()
  private currentIndex: Map<ClusterName, number> = new Map()
  private cluster: ClusterName

  constructor() {
    this.cluster = this.determineCluster()
    this.initializeEndpoints()
    console.log(`🌐 Backend RPC Manager initialized for ${this.cluster}`)
  }

  /**
   * Determine which cluster to use based on environment
   */
  private determineCluster(): ClusterName {
    const cluster = (process.env.SOLANA_CLUSTER || 'devnet').toLowerCase()
    
    if (cluster === 'mainnet' || cluster === 'mainnet-beta') {
      return 'mainnet-beta'
    }
    
    return 'devnet'
  }

  /**
   * Initialize RPC endpoints from environment variables
   * Supports separate variables for each network (Railway-friendly)
   */
  private initializeEndpoints(): void {
    // Devnet endpoints
    const devnetEndpoints: RpcEndpoint[] = []
    
    // Check for multiple devnet URLs (SOLANA_RPC_URL_DEVNET_1, _2, _3, etc.)
    for (let i = 1; i <= 5; i++) {
      const url = process.env[`SOLANA_RPC_URL_DEVNET_${i}`]
      if (url) {
        devnetEndpoints.push({
          url,
          name: `Devnet RPC ${i}`
        })
      }
    }
    
    // Fallback to single SOLANA_RPC_URL if cluster is devnet
    if (devnetEndpoints.length === 0 && this.cluster === 'devnet') {
      const fallbackUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
      devnetEndpoints.push({
        url: fallbackUrl,
        name: 'Devnet RPC (default)'
      })
    }
    
    // Always add public devnet as final fallback
    if (this.cluster === 'devnet' && !devnetEndpoints.some(ep => ep.url === clusterApiUrl('devnet'))) {
      devnetEndpoints.push({
        url: clusterApiUrl('devnet'),
        name: 'Solana Labs Devnet (public)'
      })
    }

    // Mainnet endpoints
    const mainnetEndpoints: RpcEndpoint[] = []
    
    // Check for multiple mainnet URLs
    for (let i = 1; i <= 5; i++) {
      const url = process.env[`SOLANA_RPC_URL_MAINNET_${i}`]
      if (url) {
        mainnetEndpoints.push({
          url,
          name: `Mainnet RPC ${i}`
        })
      }
    }
    
    // Fallback to single SOLANA_RPC_URL if cluster is mainnet
    if (mainnetEndpoints.length === 0 && this.cluster === 'mainnet-beta') {
      const fallbackUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta')
      mainnetEndpoints.push({
        url: fallbackUrl,
        name: 'Mainnet RPC (default)'
      })
    }

    // Store endpoints
    this.endpoints.set('devnet', devnetEndpoints)
    this.endpoints.set('mainnet-beta', mainnetEndpoints)
    
    // Initialize current index
    this.currentIndex.set('devnet', 0)
    this.currentIndex.set('mainnet-beta', 0)

    // Log configuration
    const currentEndpoints = this.endpoints.get(this.cluster) || []
    console.log(`📡 ${this.cluster} RPC endpoints configured: ${currentEndpoints.length}`)
    currentEndpoints.forEach((ep, idx) => {
      console.log(`  ${idx + 1}. ${ep.name}: ${ep.url}`)
    })
  }

  /**
   * Get a Solana connection for the current cluster
   */
  public getConnection(): Connection {
    const endpoints = this.endpoints.get(this.cluster) || []
    
    if (endpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for ${this.cluster}`)
    }

    const currentIdx = this.currentIndex.get(this.cluster) || 0
    const endpoint = endpoints[currentIdx]
    
    console.log(`🔗 Using ${endpoint.name} for ${this.cluster}`)
    return new Connection(endpoint.url, 'confirmed')
  }

  /**
   * Switch to the next endpoint in round-robin fashion
   */
  private switchToNext(): void {
    const endpoints = this.endpoints.get(this.cluster) || []
    const currentIdx = this.currentIndex.get(this.cluster) || 0
    const nextIdx = (currentIdx + 1) % endpoints.length
    
    this.currentIndex.set(this.cluster, nextIdx)
    
    const nextEndpoint = endpoints[nextIdx]
    console.log(`🔄 Switched to ${nextEndpoint.name}`)
  }

  /**
   * Retry an operation across multiple RPC endpoints
   * Will try up to 3 times, switching endpoints on failure
   */
  public async retryOperation<T>(
    operation: (connection: Connection) => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    const maxAttempts = 3
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const connection = this.getConnection()
        const result = await operation(connection)
        
        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`)
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        console.warn(`⚠️ ${operationName} failed on attempt ${attempt}/${maxAttempts}:`, error)
        
        // If not the last attempt, switch to next endpoint
        if (attempt < maxAttempts) {
          this.switchToNext()
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    // All attempts failed
    console.error(`❌ ${operationName} failed after ${maxAttempts} attempts`)
    throw lastError || new Error(`${operationName} failed after ${maxAttempts} attempts`)
  }

  /**
   * Check if an error indicates we should retry with a different RPC
   */
  public shouldRetry(error: unknown): boolean {
    if (!error) return false
    
    const errorStr = error.toString().toLowerCase()
    
    return (
      errorStr.includes('429') || // Rate limit
      errorStr.includes('timeout') ||
      errorStr.includes('econnreset') ||
      errorStr.includes('network') ||
      errorStr.includes('fetch failed') ||
      errorStr.includes('503') ||
      errorStr.includes('504')
    )
  }

  /**
   * Get current cluster name
   */
  public getCluster(): ClusterName {
    return this.cluster
  }

  /**
   * Get current endpoint URL
   */
  public getCurrentEndpoint(): string {
    const endpoints = this.endpoints.get(this.cluster) || []
    const currentIdx = this.currentIndex.get(this.cluster) || 0
    const endpoint = endpoints[currentIdx]
    return endpoint?.url || 'unknown'
  }
}

// Singleton instance
let rpcManagerInstance: BackendRpcManager | null = null

/**
 * Get the singleton RPC manager instance
 */
export function getRpcManager(): BackendRpcManager {
  if (!rpcManagerInstance) {
    rpcManagerInstance = new BackendRpcManager()
  }
  return rpcManagerInstance
}

/**
 * Get a Solana connection for the current cluster
 */
export function getConnection(): Connection {
  return getRpcManager().getConnection()
}

/**
 * Retry an operation with automatic RPC failover
 */
export async function retryOperation<T>(
  operation: (connection: Connection) => Promise<T>,
  operationName?: string
): Promise<T> {
  return getRpcManager().retryOperation(operation, operationName)
}

/**
 * Get current cluster
 */
export function getCurrentCluster(): ClusterName {
  return getRpcManager().getCluster()
}

