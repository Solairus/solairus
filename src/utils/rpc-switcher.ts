import { Connection } from '@solana/web3.js'
import Swal from 'sweetalert2'

type ClusterName = 'mainnet-beta' | 'devnet' | 'testnet'

interface RpcEndpoint {
  url: string
  name: string
  headers?: Record<string, string>
  isWorking?: boolean
  lastChecked?: number
  responseTime?: number
}

class RpcSwitcher {
  private static instance: RpcSwitcher
  private currentEndpoints: Map<ClusterName, RpcEndpoint[]> = new Map()
  private activeConnections: Map<ClusterName, Connection> = new Map()
  private healthCheckCache: Map<string, { isHealthy: boolean; timestamp: number }> = new Map()
  private readonly HEALTH_CHECK_TIMEOUT = 5000 // 5 seconds
  private readonly CACHE_DURATION = 300000 // 5 minutes (increased from 1 minute)
  private readonly RATE_LIMIT_CACHE_DURATION = 60000 // 1 minute for rate limited endpoints
  private readonly SELECT_TTL_MS = 60_000
  private endpointCooldownUntil: Map<string, number> = new Map()

  constructor() {
    this.initializeEndpoints()
  }

  static getInstance(): RpcSwitcher {
    if (!RpcSwitcher.instance) {
      RpcSwitcher.instance = new RpcSwitcher()
    }
    return RpcSwitcher.instance
  }

  private initializeEndpoints(): void {
    // Parse RPC URLs from environment variables (supports both comma-separated and multiple vars)
    const mainnetUrls = this.parseRpcUrlsFromMultipleVars('mainnet-beta')
    const devnetUrls = this.parseRpcUrlsFromMultipleVars('devnet')
    const testnetUrls = this.parseRpcUrlsFromMultipleVars('testnet')

    // Fallback to CORS-friendly endpoints if environment variables are empty
    const corsMainnetFallback = [
      { url: 'https://solana-mainnet.core.chainstack.com/31b504e5061038deb849fef18ca51009', name: 'Chainstack' },
      { url: 'https://solana-mainnet.g.alchemy.com/v2/NTfRANLBBSl4wOmIIX3Xc', name: 'Alchemy (Premium)' },
      { url: 'https://api.mainnet-beta.solana.com', name: 'Solana Labs (Official)' },
      { url: 'https://solana-api.projectserum.com', name: 'Project Serum' }
    ]
    
    const corsDevnetFallback = [
      { url: 'https://api.devnet.solana.com', name: 'Solana Labs Devnet' }
    ]
    
    const corsTestnetFallback = [
      { url: 'https://api.testnet.solana.com', name: 'Solana Labs Testnet' }
    ]

    this.currentEndpoints.set('mainnet-beta', mainnetUrls.length > 0 ? mainnetUrls : corsMainnetFallback)
    this.currentEndpoints.set('devnet', devnetUrls.length > 0 ? devnetUrls : corsDevnetFallback)
    this.currentEndpoints.set('testnet', testnetUrls.length > 0 ? testnetUrls : corsTestnetFallback)
    
    // Get current cluster from environment
    const currentCluster = this.getCurrentCluster()
    
    // Log the endpoints being used for debugging - only for current cluster
    console.log(`🔧 RPC Switcher initialized for ${currentCluster}:`, 
      this.currentEndpoints.get(currentCluster)?.map(ep => `${ep.name} (${ep.url})`)
    )
  }

  private getCurrentCluster(): ClusterName {
    // Check localStorage override first (set by UI network switcher), then environment
    const override = (() => {
      try { 
        return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() 
      } catch { 
        return "" 
      }
    })()
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "mainnet-beta").toLowerCase()
    const effectiveCluster = override || envCluster
    
    console.log(`🌐 Current network: ${effectiveCluster} (override: ${override || 'none'}, env: ${envCluster})`)
    
    if (effectiveCluster.startsWith("mainnet")) return "mainnet-beta"
    if (effectiveCluster === "testnet") return "testnet"
    if (effectiveCluster === "devnet") return "devnet"
    return "mainnet-beta"
  }

  private parseRpcUrls(envVar: string | undefined): RpcEndpoint[] {
    if (!envVar) return []
    
    return envVar
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .map((raw) => this.parseEndpoint(raw))
  }

  private parseRpcUrlsFromMultipleVars(cluster: ClusterName): RpcEndpoint[] {
    const urls: string[] = []
    
    if (cluster === 'mainnet-beta') {
      // Collect from multiple environment variables for Vercel compatibility
      const mainnetVars = [
        import.meta.env.VITE_SOLANA_RPC_URL_MAINNET,
        import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_2,
        import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_3,
        import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_4,
        import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_5,
      ].filter(Boolean)
      
      // First try comma-separated parsing on the primary variable
      if (mainnetVars[0]) {
        const commaSeparated = this.parseRpcUrls(mainnetVars[0])
        if (commaSeparated.length > 1) {
          return commaSeparated
        }
      }
      
      // Otherwise use individual variables
      urls.push(...mainnetVars)
    } else if (cluster === 'devnet') {
      const devnetVars = [
        import.meta.env.VITE_SOLANA_RPC_URL_DEVNET,
        import.meta.env.VITE_SOLANA_RPC_URL_DEVNET_2,
        import.meta.env.VITE_SOLANA_RPC_URL_DEVNET_3,
      ].filter(Boolean)
      urls.push(...devnetVars)
    } else if (cluster === 'testnet') {
      const testnetVars = [
        import.meta.env.VITE_SOLANA_RPC_URL_TESTNET,
        import.meta.env.VITE_SOLANA_RPC_URL_TESTNET_2,
        import.meta.env.VITE_SOLANA_RPC_URL_TESTNET_3,
      ].filter(Boolean)
      urls.push(...testnetVars)
    }
    
    return urls.map((raw) => this.parseEndpoint(raw))
  }

  private parseEndpoint(raw: string): RpcEndpoint {
    const [urlPart, ...headerParts] = raw.split('|').map((segment) => segment.trim()).filter(Boolean)
    const sanitizedUrl = urlPart.endsWith('/') ? urlPart : `${urlPart}/`
    const headers: Record<string, string> = {}
    for (const segment of headerParts) {
      const [key, value] = segment.split('=')
      if (key && value) {
        headers[key.trim()] = value.trim()
      }
    }
    return {
      url: sanitizedUrl,
      name: this.extractProviderName(sanitizedUrl),
      headers: Object.keys(headers).length ? headers : undefined,
    }
  }

  private extractProviderName(url: string): string {
    try {
      const hostname = new URL(url).hostname
      if (hostname.includes('chainstack')) return 'Chainstack'
      if (hostname.includes('helius')) return 'Helius'
      if (hostname.includes('alchemy')) return 'Alchemy'
      if (hostname.includes('ankr')) return 'Ankr'
      if (hostname.includes('quicknode')) return 'QuickNode'
      if (hostname.includes('projectserum')) return 'Project Serum'
      if (hostname.includes('metaplex')) return 'Metaplex'
      if (hostname.includes('solana.com')) return 'Solana Labs'
      if (hostname.includes('public-rpc')) return 'Public RPC'
      return hostname
    } catch {
      return 'Unknown Provider'
    }
  }

  // REMOVED: Health checks are disabled to prevent unnecessary RPC calls
  // Connections are only tested when actually used for real operations

  private categorizeRpcError(error: unknown, endpoint: RpcEndpoint): string {
    const errorStr = String(error).toLowerCase()
    
    if (errorStr.includes('cors') || errorStr.includes('access-control-allow-origin')) {
      return `CORS blocked (${endpoint.name} doesn't allow browser requests)`
    }
    
    if (errorStr.includes('403') || errorStr.includes('forbidden')) {
      return `Access forbidden (${endpoint.name} may require API key)`
    }
    
    if (errorStr.includes('401') || errorStr.includes('unauthorized')) {
      return `Unauthorized (${endpoint.name} requires valid API key)`
    }
    
    if (errorStr.includes('429') || errorStr.includes('too many requests')) {
      return `Rate limited (${endpoint.name} is temporarily throttling requests)`
    }
    
    if (errorStr.includes('timeout')) {
      return `Timeout (${endpoint.name} is too slow)`
    }
    
    if (errorStr.includes('cert') || errorStr.includes('ssl') || errorStr.includes('tls')) {
      return `SSL/Certificate error (${endpoint.name} has invalid certificate)`
    }
    
    if (errorStr.includes('name_not_resolved') || errorStr.includes('dns')) {
      return `DNS error (${endpoint.name} domain not found)`
    }
    
    if (errorStr.includes('network') || errorStr.includes('connection')) {
      return `Network error (${endpoint.name} unreachable)`
    }
    
    return `Unknown error: ${error}`
  }

  public async getHealthyConnection(cluster: ClusterName): Promise<Connection> {
    // Validate cluster
    const currentCluster = this.getCurrentCluster()
    if (cluster !== currentCluster) {
      console.warn(`⚠️ Requested ${cluster} but current network is ${currentCluster}. Using ${currentCluster} instead.`)
      cluster = currentCluster
    }

    const endpoints = this.currentEndpoints.get(cluster) || []
    if (endpoints.length === 0) throw new Error(`No RPC endpoints configured for ${cluster}`)

    // TTL reuse
    const cached = this.activeConnections.get(cluster)
    if (cached) return cached

    const now = Date.now()
    // Probe sequentially with lightweight call and short timeout
    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i]
      const cooldownUntil = this.endpointCooldownUntil.get(ep.url) || 0
      if (now < cooldownUntil) continue
      try {
        const conn = new Connection(ep.url, { commitment: 'confirmed', httpHeaders: ep.headers })
        await withTimeout(conn.getVersion(), 1200)
        this.activeConnections.set(cluster, conn)
        return conn
      } catch (probeErr) {
        const estr = String(probeErr).toLowerCase()
        if (estr.includes('402') || estr.includes('payment required') || estr.includes('out of cu')) {
          this.endpointCooldownUntil.set(ep.url, now + 180_000)
        }
        continue
      }
    }
    await this.showRpcFailureAlert(cluster, endpoints)
    throw new Error(`Failed to create connection to any RPC endpoint for ${cluster}`)
  }

  public async switchToNextRpc(cluster: ClusterName): Promise<Connection> {
    const endpoints = this.currentEndpoints.get(cluster) || []
    const currentConnection = this.activeConnections.get(cluster)
    
    if (!currentConnection || endpoints.length <= 1) {
      return this.getHealthyConnection(cluster)
    }

    // Find current endpoint and try the next one
    let currentIndex = -1
    for (let i = 0; i < endpoints.length; i++) {
      if (endpoints[i].url === currentConnection.rpcEndpoint) {
        currentIndex = i
        break
      }
    }

    // Try endpoints starting from the next one - probe lightly before selecting
    const startIndex = (currentIndex + 1) % endpoints.length
    for (let i = 0; i < endpoints.length; i++) {
      const index = (startIndex + i) % endpoints.length
      const endpoint = endpoints[index]
      
      // Skip the current endpoint
      if (index === currentIndex) continue
      
      try {
        const connection = new Connection(endpoint.url, { commitment: 'confirmed', httpHeaders: endpoint.headers })
        await withTimeout(connection.getVersion(), 1200)
        this.activeConnections.set(cluster, connection)
        return connection
      } catch (error) {
        console.warn(`❌ Failed to switch to ${endpoint.name}:`, error)
        const estr = String(error).toLowerCase()
        if (estr.includes('402') || estr.includes('payment required') || estr.includes('out of cu')) {
          this.endpointCooldownUntil.set(endpoint.url, Date.now() + 180_000)
        }
        continue
      }
    }

    // If no endpoints work
    await this.showRpcFailureAlert(cluster, endpoints)
    throw new Error(`No working RPC endpoints available for ${cluster}`)
  }

  private showRpcNotification(type: 'success' | 'info' | 'warning', message: string, cluster: ClusterName): void {
    const icon = type === 'success' ? '✅' : type === 'info' ? '🔄' : '⚠️'
    
    Swal.fire({
      icon: type,
      title: `${icon} RPC Connection`,
      text: `${message} (${cluster})`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  }

  private async showRpcFailureAlert(cluster: ClusterName, endpoints: RpcEndpoint[]): Promise<void> {
    const workingEndpoints = endpoints.filter(ep => ep.isWorking === true)
    const failedEndpoints = endpoints.filter(ep => ep.isWorking === false)
    
    const corsIssues = failedEndpoints.filter(ep => 
      this.categorizeRpcError(new Error('cors'), ep).includes('CORS')
    ).length
    
    const endpointList = endpoints
      .map(ep => {
        if (ep.isWorking === true) {
          return `• ${ep.name}: ✅ Working (${ep.responseTime}ms)`
        } else if (ep.isWorking === false) {
          const errorType = this.categorizeRpcError(new Error('generic'), ep)
          return `• ${ep.name}: ❌ ${errorType}`
        }
        return `• ${ep.name}: ⏳ Checking...`
      })
      .join('\n')

    const corsWarning = corsIssues > 0 ? `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <strong>⚠️ CORS Issues Detected:</strong><br>
        ${corsIssues} endpoint(s) blocked by browser CORS policy.<br>
        This is normal for localhost development.
      </div>
    ` : ''

    await Swal.fire({
      icon: workingEndpoints.length > 0 ? 'warning' : 'error',
      title: workingEndpoints.length > 0 ? '⚠️ Limited RPC Availability' : '🚨 All RPCs Failed',
      html: `
        <div style="text-align: left;">
          <p><strong>RPC Status for ${cluster}:</strong></p>
          <pre style="font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 200px; overflow-y: auto;">${endpointList}</pre>
          ${corsWarning}
          <p><strong>Recommended solutions:</strong></p>
          <ul style="font-size: 14px;">
            <li>🔑 <strong>Get API Keys:</strong> Sign up for Helius, QuickNode, or Alchemy</li>
            <li>🌐 <strong>Use Public RPCs:</strong> Solana Labs endpoints work but have rate limits</li>
            <li>🔄 <strong>Try Again:</strong> Some endpoints may be temporarily down</li>
            <li>📱 <strong>Production Deploy:</strong> CORS issues don't affect deployed apps</li>
          </ul>
        </div>
      `,
      confirmButtonText: 'Retry Connection',
      showCancelButton: true,
      cancelButtonText: 'Use Default RPC',
      width: 600
    })
  }

  public async testAllEndpoints(cluster: ClusterName): Promise<RpcEndpoint[]> {
    const endpoints = this.currentEndpoints.get(cluster) || []
    
    console.error('🚫 Health checks are disabled to prevent rate limit exhaustion!')
    console.log('Endpoints will only be tested when actually used for real operations')
    
    // Return endpoints without testing them
    return endpoints.map(endpoint => ({ ...endpoint, isWorking: undefined }))
  }

  public getEndpointStatsWithoutHealthCheck(cluster: ClusterName): RpcEndpoint[] {
    const endpoints = this.currentEndpoints.get(cluster) || []
    const currentConnection = this.activeConnections.get(cluster)
    
    // Mark the currently active endpoint
    return endpoints.map(endpoint => ({
      ...endpoint,
      isWorking: currentConnection?.rpcEndpoint === endpoint.url ? true : undefined,
      lastChecked: currentConnection?.rpcEndpoint === endpoint.url ? Date.now() : endpoint.lastChecked
    }))
  }

  public getEndpointStats(cluster: ClusterName): RpcEndpoint[] {
    return this.currentEndpoints.get(cluster) || []
  }

  public clearCache(): void {
    this.healthCheckCache.clear()
    this.activeConnections.clear()
  }

  public reinitialize(): void {
    this.clearCache()
    this.initializeEndpoints()
    console.log('🔄 RPC Switcher reinitialized')
  }

  public onNetworkChange(): void {
    // Clear all cached connections when network changes
    this.activeConnections.clear()
    this.healthCheckCache.clear()
    console.log('🌐 Network changed - cleared all cached RPC connections')
  }
}

// Export singleton instance
export const rpcSwitcher = RpcSwitcher.getInstance()

// Export utility functions
export async function getHealthyRpcConnection(cluster: ClusterName = 'mainnet-beta'): Promise<Connection> {
  return rpcSwitcher.getHealthyConnection(cluster)
}

export async function switchRpcEndpoint(cluster: ClusterName = 'mainnet-beta'): Promise<Connection> {
  return rpcSwitcher.switchToNextRpc(cluster)
}

export async function testRpcEndpoints(cluster: ClusterName = 'mainnet-beta'): Promise<RpcEndpoint[]> {
  return rpcSwitcher.testAllEndpoints(cluster)
}

export function getRpcStats(cluster: ClusterName = 'mainnet-beta'): RpcEndpoint[] {
  return rpcSwitcher.getEndpointStats(cluster)
}

export function reinitializeRpcSwitcher(): void {
  rpcSwitcher.reinitialize()
}

export function onNetworkChange(): void {
  rpcSwitcher.onNetworkChange()
}

export async function handleRpcError(error: unknown, cluster: ClusterName = 'mainnet-beta'): Promise<Connection> {
  const errorStr = String(error).toLowerCase()
  const errorJson = typeof error === 'object' && error !== null ? JSON.stringify(error) : ''
  
  // Check for various RPC failure conditions that warrant switching
  const shouldSwitch = 
    errorStr.includes('402') || errorStr.includes('payment required') || errorStr.includes('out of cu') || // Plan/CU limits
    errorStr.includes('429') || errorStr.includes('too many requests') || // Rate limits
    errorStr.includes('403') || errorStr.includes('forbidden') || // Access denied
    errorStr.includes('plan upgrade') || errorStr.includes('requires plan') || // Plan limits (Chainstack)
    errorStr.includes('32602') || // Method not allowed / plan upgrade required
    errorStr.includes('timeout') || errorStr.includes('timed out') || // Timeouts
    errorStr.includes('502') || errorStr.includes('503') || errorStr.includes('504') || // Server errors
    errorStr.includes('network error') || errorStr.includes('connection') // Network issues
  
  if (shouldSwitch) {
    const errorType = 
      errorStr.includes('plan upgrade') || errorStr.includes('32602') ? 'Plan upgrade required' :
      errorStr.includes('429') ? 'Rate limit' :
      errorStr.includes('403') ? 'Access forbidden' :
      errorStr.includes('timeout') ? 'Timeout' :
      errorStr.includes('50') ? 'Server error' :
      'Network error'
    
    console.warn(`🔄 ${errorType} detected, switching to next RPC endpoint`)
    console.log('📋 Error details:', errorJson.slice(0, 200) + (errorJson.length > 200 ? '...' : ''))
    
    try {
      return await switchRpcEndpoint(cluster)
    } catch (switchError) {
      console.error('❌ Failed to switch RPC after error:', switchError)
      throw error
    }
  }
  
  // For other errors, just throw the original error
  throw error
}

// Internal timeout helper
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout')), ms)
    p.then((v) => { clearTimeout(to); resolve(v) }).catch((e) => { clearTimeout(to); reject(e) })
  })
}