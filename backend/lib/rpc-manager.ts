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
  private lastSelectedAt: Map<ClusterName, number> = new Map()
  private endpointCooldownUntil: Map<string, number> = new Map()
  private readonly SELECT_TTL_MS = 60_000
  private readonly COOLDOWN_MS = 180_000

  constructor() {
    this.cluster = this.determineCluster()
    this.initializeEndpoints()
    console.log(`🌐 Backend RPC Manager initialized for ${this.cluster}`)
  }

  /**
   * Determine which cluster to use based on environment
   */
  private determineCluster(): ClusterName {
    const cluster = (process.env.SOLANA_CLUSTER || 'mainnet-beta').toLowerCase()
    if (cluster === 'mainnet' || cluster === 'mainnet-beta') return 'mainnet-beta'
    if (cluster === 'devnet') return 'devnet'
    if (cluster === 'testnet') return 'devnet'
    return 'mainnet-beta'
  }

  /**
   * Initialize RPC endpoints from environment variables
   * Supports separate variables for each network (Railway-friendly)
   */
  private initializeEndpoints(): void {
    // Devnet endpoints
    const devnetEndpoints: RpcEndpoint[] = []
    
    // Check for SOLANA_RPC_URL_DEVNET first (without number)
    const devnetMain = process.env.SOLANA_RPC_URL_DEVNET
    if (devnetMain) {
      devnetEndpoints.push({
        url: devnetMain,
        name: 'Devnet RPC 1'
      })
    }
    
    // Check for numbered devnet URLs (SOLANA_RPC_URL_DEVNET_0.._9)
    for (let i = 0; i <= 9; i++) {
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
    
    // Check for SOLANA_RPC_URL_MAINNET first (without number)
    const mainnetMain = process.env.SOLANA_RPC_URL_MAINNET
    if (mainnetMain) {
      mainnetEndpoints.push({
        url: mainnetMain,
        name: 'Mainnet RPC 1'
      })
    }
    
    // Check for numbered mainnet URLs (SOLANA_RPC_URL_MAINNET_0.._9)
    for (let i = 0; i <= 9; i++) {
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
   * Return a working connection by probing endpoints sequentially with a light call.
   */
  public async getWorkingConnection(): Promise<Connection> {
    const endpoints = this.endpoints.get(this.cluster) || []
    if (endpoints.length === 0) throw new Error(`No RPC endpoints configured for ${this.cluster}`)

    const now = Date.now()
    const ttlAt = this.lastSelectedAt.get(this.cluster) || 0
    if (now - ttlAt < this.SELECT_TTL_MS) {
      const cachedIdx = this.currentIndex.get(this.cluster) || 0
      const ep = endpoints[cachedIdx]
      return new Connection(ep.url, 'confirmed')
    }

    // Start from current index and probe sequentially
    const startIdx = this.currentIndex.get(this.cluster) || 0
    for (let i = 0; i < endpoints.length; i++) {
      const idx = (startIdx + i) % endpoints.length
      const ep = endpoints[idx]
      const cooldownUntil = this.endpointCooldownUntil.get(ep.url) || 0
      if (now < cooldownUntil) continue
      try {
        const conn = new Connection(ep.url, 'confirmed')
        // Lightweight probe with timeout
        await this.withTimeout(conn.getVersion(), 1200)
        // Success
        this.currentIndex.set(this.cluster, idx)
        this.lastSelectedAt.set(this.cluster, Date.now())
        console.log(`🔗 Using ${ep.name} for ${this.cluster}`)
        return conn
      } catch (probeErr) {
        const estr = String(probeErr).toLowerCase()
        if (estr.includes('402') || estr.includes('payment required') || estr.includes('out of cu')) {
          this.endpointCooldownUntil.set(ep.url, now + this.COOLDOWN_MS)
        }
        continue
      }
    }
    throw new Error(`No working RPC endpoint available for ${this.cluster}`)
  }

  /** Existing accessor aligns to async selector */
  public getConnection(): Connection {
    // Synchronous accessor kept for compatibility; selects last chosen endpoint
    const endpoints = this.endpoints.get(this.cluster) || []
    if (endpoints.length === 0) throw new Error(`No RPC endpoints configured for ${this.cluster}`)
    const currentIdx = this.currentIndex.get(this.cluster) || 0
    const ep = endpoints[currentIdx]
    return new Connection(ep.url, 'confirmed')
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
    const endpoints = this.endpoints.get(this.cluster) || []
    const maxAttempts = Math.min(endpoints.length || 1, 5)
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const connection = await this.getWorkingConnection()
        const result = await operation(connection)
        
        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`)
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        console.warn(`⚠️ ${operationName} failed on attempt ${attempt}/${maxAttempts}:`, error)
        // Mark cooldown on CU exhaustion
        const estr = String(error).toLowerCase()
        const currentEp = (this.endpoints.get(this.cluster) || [])[this.currentIndex.get(this.cluster) || 0]
        if (currentEp && (estr.includes('402') || estr.includes('payment required') || estr.includes('out of cu'))) {
          this.endpointCooldownUntil.set(currentEp.url, Date.now() + this.COOLDOWN_MS)
        }
        // Switch index for next probe
        if (attempt < maxAttempts) this.switchToNext()
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
      errorStr.includes('402') || // Payment required / Out of CU
      errorStr.includes('payment required') ||
      errorStr.includes('out of cu') ||
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

  public async pingAllEndpoints(): Promise<void> {
    const endpoints = this.endpoints.get(this.cluster) || []
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const conn = new Connection(endpoints[i].url, 'confirmed')
        await conn.getVersion()
      } catch {}
    }
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout')), ms)
      p.then((v) => { clearTimeout(to); resolve(v) }).catch((e) => { clearTimeout(to); reject(e) })
    })
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

export async function pingAllRpcEndpoints(): Promise<void> {
  await getRpcManager().pingAllEndpoints()
}

export async function getWorkingConnection(): Promise<Connection> {
  return getRpcManager().getWorkingConnection()
}

