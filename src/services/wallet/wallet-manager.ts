import { createAppKit } from "@reown/appkit/react"
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react"
import { solana, solanaDevnet, solanaTestnet } from "@reown/appkit/networks"
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"

type ClusterName = "mainnet-beta" | "devnet" | "testnet"

export class WalletManager {
  private static instance: WalletManager
  private appKitInstance: AppKitInstance | null = null
  private projectId: string

  constructor() {
    this.projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ""

    if (!this.projectId) {
      console.warn("WalletConnect project ID not found in environment variables")
    }
  }

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
    }
    return WalletManager.instance
  }

  private selectSolanaNetwork() {
    const clusterRaw = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase()
    const cluster: ClusterName = clusterRaw === "mainnet" || clusterRaw === "mainnet-beta"
      ? "mainnet-beta"
      : clusterRaw === "testnet"
      ? "testnet"
      : "devnet"

    if (cluster === "mainnet-beta") return solana
    if (cluster === "testnet") return solanaTestnet
    return solanaDevnet
  }

  public getAppKit(): AppKitInstance {
    if (!this.appKitInstance) {
      try {
        this.appKitInstance = this.createAppKitInstance()
      } catch (error) {
        console.error("Failed to initialize AppKit:", error)
        return {
          open: async () => {
            console.error("AppKit not properly initialized")
            return
          },
          disconnect: async () => {
            console.error("AppKit not properly initialized")
            return
          }
        } as AppKitInstance
      }
    }
    return this.appKitInstance
  }

  private createAppKitInstance(): AppKitInstance {
    if (!this.projectId) {
      throw new Error("WalletConnect project ID is required")
    }

    const metadata = {
      name: "Solairus",
      description: "AI-Powered DeFi Wealth Protocol",
      url: typeof window !== "undefined" ? window.location.origin : "https://solairus.ai",
      icons: [
        typeof window !== "undefined"
          ? `${window.location.origin}/favicon.ico`
          : "https://solairus.ai/favicon.ico",
      ],
    }

    const config: AppKitConfig = {
      adapters: [
        new SolanaAdapter({ wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()] }),
      ],
      metadata,
      networks: [this.selectSolanaNetwork()],
      projectId: this.projectId,
      features: {
        analytics: false,
        email: false,
        socials: false,
      },
      themeMode: "dark" as const,
      themeVariables: {
        "--w3m-z-index": 1000,
      },
      enableWallets: true,
      excludeWalletIds: [],
      featuredWalletIds: [
        // Solana-centric wallets (IDs may change across catalog versions; leave empty if causing issues)
        "1ca0bdd4747578705b1939af023d120677c64fe6ca76add81fda36e350605e79", // Solflare
        // Phantom ID is managed internally; AppKit shows it by default when using SolanaAdapter
      ],
    }

    return createAppKit(config)
  }

  public openConnectModal(): void {
    const appKit = this.getAppKit()
    if (appKit && typeof appKit.open === "function") {
      appKit.open()
    } else {
      console.error("AppKit instance not available")
    }
  }

  public disconnect(): void {
    const appKit = this.getAppKit()
    if (appKit && typeof appKit.disconnect === "function") {
      appKit.disconnect()
    }
  }
}

// Use library function types to stay aligned with expected shapes
type AppKitInstance = ReturnType<typeof createAppKit>
type AppKitConfig = Parameters<typeof createAppKit>[0]