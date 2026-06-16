import { createAppKit } from "@reown/appkit"
import { SolanaAdapter } from "@reown/appkit-adapter-solana"
import { solana, solanaDevnet, solanaTestnet } from "@reown/appkit/networks"

type ClusterName = "mainnet-beta" | "devnet" | "testnet"

export class WalletManager {
  private static instance: WalletManager
  private appKitInstance: AppKitInstance | null = null
  private projectId: string

  constructor() {
    // Support comma-separated project IDs and pick a single effective ID
    const pick = this.pickProjectId()
    this.projectId = pick || ""

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

  // Parse env and choose a single projectId (supports comma-separated values)
  private getProjectIds(): string[] {
    const raw = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ""
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }

  private pickProjectId(): string | null {
    const ids = this.getProjectIds()
    if (!ids.length) return null
    let idx = 0
    try {
      const saved = Number(localStorage.getItem("wc_pid_idx") ?? "0") || 0
      idx = Math.min(Math.max(saved, 0), ids.length - 1)
    } catch {
      // ignore storage errors
    }
    const chosen = ids[idx]
    // Persist the resolved index against the full list order if possible
    try {
      const allRaw = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const indexInAll = allRaw.findIndex((id) => id === chosen)
      if (indexInAll >= 0) localStorage.setItem("wc_pid_idx", String(indexInAll))
    } catch {
      // ignore storage errors
    }
    return chosen
  }

  // Optional manual rotation to next ID in list
  private rotateProjectId(): void {
    const ids = this.getProjectIds()
    if (!ids.length) return
    const currentIndex = Math.max(0, Math.min(ids.findIndex((id) => id === this.projectId), ids.length - 1))
    const next = ids[(currentIndex + 1) % ids.length]
    this.projectId = next
    try {
      const allRaw = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean)
      const indexInAll = allRaw.findIndex((id) => id === next)
      if (indexInAll >= 0) localStorage.setItem("wc_pid_idx", String(indexInAll))
    } catch {
      // ignore storage errors
    }
    this.appKitInstance = null
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
    if (!this.projectId) {
      throw new Error("WalletConnect project ID is required")
    }
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

  // Ensure AppKit is initialized only after a successful preflight.
  // Initialize without gating; preflight can be used manually if desired
  public async ensureInitialized(): Promise<AppKitInstance> {
    return this.getAppKit()
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
        new SolanaAdapter(),
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
      featuredWalletIds: [
        // Remove hardcoded wallet IDs that may cause SVG issues
        // Let AppKit show all available Solana wallets naturally
      ],
    }

    return createAppKit(config)
  }

  // Perform a lightweight validation against WalletConnect services.
  private async preflightProjectId(projectId: string): Promise<boolean> {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://localhost"
      // Validate against Web3Modal catalog; rotate on any non-2xx (401/403/429) or thrown error
      const url = `https://api.web3modal.org/wallets?projectId=${encodeURIComponent(projectId)}&origin=${encodeURIComponent(origin)}`
      const res = await fetch(url, { method: "GET", cache: "no-store" })
      return res.ok
    } catch {
      // Treat network/CORS/service worker errors as invalid
      return false
    }
  }

  public openConnectModal(): void {
    if (!this.projectId) {
      console.error("WalletConnect project ID missing; cannot open connect modal")
      return
    }
    const appKit = this.getAppKit()
    if (appKit && typeof appKit.open === "function") {
      appKit.open()
    } else {
      console.error("AppKit instance not available")
    }
  }

  public hasProjectId(): boolean {
    return this.getProjectIds().length > 0
  }

  // Utility to clear rotation cache keys
  public static clearRotationCache(): void {
    try {
      localStorage.removeItem("wc_pid_idx")
      const keys = Object.keys(localStorage)
      keys.forEach((k) => {
        if (k.startsWith("wc_pid_expired_")) localStorage.removeItem(k)
      })
    } catch {
      // ignore storage errors
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