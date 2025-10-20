import { Connection } from '@solana/web3.js';

type ClusterName = 'mainnet-beta' | 'devnet' | 'testnet';

class RpcConnectionManager {
  private static instance: RpcConnectionManager;
  private currentEndpointIndex: Map<ClusterName, number> = new Map();
  private endpoints: Map<ClusterName, string[]> = new Map();

  constructor() {
    this.initializeEndpoints();
  }

  static getInstance(): RpcConnectionManager {
    if (!RpcConnectionManager.instance) {
      RpcConnectionManager.instance = new RpcConnectionManager();
    }
    return RpcConnectionManager.instance;
  }

  private initializeEndpoints(): void {
    // Get endpoints from environment variables
    const mainnetEndpoints = [
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET,
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_2,
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_3,
      import.meta.env.VITE_SOLANA_RPC_URL_MAINNET_4,
    ].filter(Boolean);

    const devnetEndpoints = [
      import.meta.env.VITE_SOLANA_RPC_URL_DEVNET || 'https://api.devnet.solana.com'
    ];

    const testnetEndpoints = [
      import.meta.env.VITE_SOLANA_RPC_URL_TESTNET || 'https://api.testnet.solana.com'
    ];

    this.endpoints.set('mainnet-beta', mainnetEndpoints);
    this.endpoints.set('devnet', devnetEndpoints);
    this.endpoints.set('testnet', testnetEndpoints);

    // Initialize current index to 0 for all clusters
    this.currentEndpointIndex.set('mainnet-beta', 0);
    this.currentEndpointIndex.set('devnet', 0);
    this.currentEndpointIndex.set('testnet', 0);

    console.log('🔧 RPC Connection Manager initialized with endpoints:', {
      'mainnet-beta': mainnetEndpoints.length,
      'devnet': devnetEndpoints.length,
      'testnet': testnetEndpoints.length
    });
  }

  private getCurrentCluster(): ClusterName {
    const override = (() => {
      try { 
        return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() 
      } catch { 
        return "" 
      }
    })();
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase();
    const effective = override || envCluster;
    
    if (effective.startsWith("mainnet")) return "mainnet-beta";
    if (effective === "testnet") return "testnet";
    return "devnet";
  }

  /**
   * Get current RPC connection - no health checks, just return the current endpoint
   */
  public getConnection(): Connection {
    const cluster = this.getCurrentCluster();
    const endpoints = this.endpoints.get(cluster) || [];
    const currentIndex = this.currentEndpointIndex.get(cluster) || 0;
    
    if (endpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for ${cluster}`);
    }

    const currentEndpoint = endpoints[currentIndex];
    console.log(`🔗 Using RPC: ${currentEndpoint} (${cluster})`);
    
    return new Connection(currentEndpoint, 'confirmed');
  }

  /**
   * Switch to next RPC endpoint - called when current one fails
   */
  public switchToNext(): Connection {
    const cluster = this.getCurrentCluster();
    const endpoints = this.endpoints.get(cluster) || [];
    
    if (endpoints.length <= 1) {
      console.warn('⚠️ Only one RPC endpoint available, cannot switch');
      return this.getConnection();
    }

    const currentIndex = this.currentEndpointIndex.get(cluster) || 0;
    const nextIndex = (currentIndex + 1) % endpoints.length;
    
    this.currentEndpointIndex.set(cluster, nextIndex);
    
    const newEndpoint = endpoints[nextIndex];
    console.log(`🔄 Switched RPC: ${newEndpoint} (${cluster})`);
    
    return new Connection(newEndpoint, 'confirmed');
  }

  /**
   * Check if error warrants switching RPC
   */
  public shouldSwitchRpc(error: unknown): boolean {
    const errorStr = String(error).toLowerCase();
    
    return (
      errorStr.includes('403') || // Forbidden / plan upgrade
      errorStr.includes('429') || // Rate limit
      errorStr.includes('32602') || // Method requires plan upgrade
      errorStr.includes('plan upgrade') ||
      errorStr.includes('timeout') ||
      errorStr.includes('502') || errorStr.includes('503') || errorStr.includes('504')
    );
  }
}

// Export singleton
export const rpcManager = RpcConnectionManager.getInstance();

// Simple utility functions
export function getCurrentRpcConnection(): Connection {
  return rpcManager.getConnection();
}

export function switchRpcEndpoint(): Connection {
  return rpcManager.switchToNext();
}

export function shouldSwitchRpc(error: unknown): boolean {
  return rpcManager.shouldSwitchRpc(error);
}