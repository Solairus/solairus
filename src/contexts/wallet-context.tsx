import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { Connection, PublicKey, clusterApiUrl, Transaction, VersionedTransaction } from "@solana/web3.js"
import { WalletManager } from "@/services/wallet/wallet-manager"
import { getHealthyRpcConnection, handleRpcError, onNetworkChange } from "@/utils/rpc-switcher"
import * as anchor from "@coral-xyz/anchor"
import { AuthService } from '@/services/auth/auth-service'
import { API_CONFIG, ApiClient } from '@/config/service-endpoints'

// Interface for wallet provider with signing capabilities
interface WalletProviderWithSigning {
  signTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  signAllTransactions?: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>
}

// AppKit event interfaces
interface AppKitAccountEvent {
  address?: string
  isConnected?: boolean
}

interface AppKitStateEvent {
  selectedNetworkId?: string
  address?: string
  data?: {
    wallet?: {
      name?: string
      id?: string
      type?: string
    }
  }
}

type WalletContextType = {
  account: string | null
  chainId: number | null
  balance: string | null
  isConnecting: boolean
  isConnected: boolean
  isInitializing: boolean
  provider: Connection | null
  connectWallet: (providerType: string) => Promise<void>
  disconnectWallet: () => Promise<void>
  switchNetwork: (targetChainId: number) => Promise<void>
  formatAddress: (address: string) => string
  getChainInfo: (chainId: number | null) => { name: string; symbol: string; explorer: string }
  openConnectModal: () => void
  lastError: Error | null
  clearError: () => void
  // Smart contract capabilities
  anchorProvider: anchor.AnchorProvider | null
  publicKey: PublicKey | null
  signTransaction: ((transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null
  signAllTransactions: ((transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>) | null
  // Manual balance refresh
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isInitializing] = useState(false)
  const [provider, setProvider] = useState<Connection | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [anchorProvider, setAnchorProvider] = useState<anchor.AnchorProvider | null>(null)
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [walletProvider, setWalletProvider] = useState<WalletProviderWithSigning | null>(null)
  const [lastBalanceUpdate, setLastBalanceUpdate] = useState<number>(0)
  const [balanceUpdateInProgress, setBalanceUpdateInProgress] = useState(false)

  const walletManager = WalletManager.getInstance()

  // Balance update throttling - only update every 30 seconds
  const BALANCE_UPDATE_INTERVAL = 30000 // 30 seconds

  const updateBalance = useCallback(async (
    solanaConn: Connection,
    address: string,
    forceUpdate: boolean = false
  ) => {
    // Throttle balance updates to prevent excessive RPC calls
    const now = Date.now()
    if (!forceUpdate && balanceUpdateInProgress) {
      console.log("⏳ Balance update already in progress, skipping")
      return
    }
    
    if (!forceUpdate && (now - lastBalanceUpdate) < BALANCE_UPDATE_INTERVAL) {
      console.log("⏱️ Balance update throttled, last update was", Math.round((now - lastBalanceUpdate) / 1000), "seconds ago")
      return
    }

    setBalanceUpdateInProgress(true)
    
    try {
      const pubkey = new PublicKey(address)
      console.log("💰 Fetching balance for", address.slice(0, 8) + "...")
      const lamports = await solanaConn.getBalance(pubkey)
      setBalance((lamports / 1_000_000_000).toString())
      setLastBalanceUpdate(now)
      console.log("✅ Balance updated:", (lamports / 1_000_000_000).toFixed(4), "SOL")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Handle specific RPC errors
      if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
        console.warn("🔄 RPC rate limit hit - switching to next endpoint")
        try {
          // Determine current cluster
          const overrideCluster = (() => {
            try { return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() } catch { return "" }
          })()
          const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase()
          const effectiveCluster = (overrideCluster || envCluster)
          const normalizedCluster = effectiveCluster.startsWith("mainnet")
            ? "mainnet-beta"
            : effectiveCluster === "testnet"
              ? "testnet"
              : "devnet"
          
          // Switch to next RPC and update provider
          const newConnection = await handleRpcError(error, normalizedCluster as 'mainnet-beta' | 'devnet' | 'testnet')
          setProvider(newConnection)
          
          // Retry balance fetch with new connection
          const pubkey = new PublicKey(address)
          const newLamports = await newConnection.getBalance(pubkey)
          setBalance((newLamports / 1_000_000_000).toString())
          setLastBalanceUpdate(now)
          console.log("✅ Balance updated after RPC switch:", (newLamports / 1_000_000_000).toFixed(4), "SOL")
          return
        } catch (switchError) {
          console.error("Failed to switch RPC and retry balance:", switchError)
          setBalance("Rate limited")
          setLastError(new Error("All RPC endpoints are rate limited. Please wait a moment and try again."))
          return
        }
      } else if (errorMessage.includes("403") || errorMessage.includes("Access forbidden")) {
        console.warn("RPC access forbidden - balance unavailable")
        setBalance("Access denied")
        setLastError(new Error("RPC access denied. Consider using a custom RPC endpoint for mainnet."))
      } else {
        console.error("Failed to get balance:", error)
        setBalance("Error")
        setLastError(error as Error)
      }
    } finally {
      setBalanceUpdateInProgress(false)
    }
  }, [lastBalanceUpdate, balanceUpdateInProgress, BALANCE_UPDATE_INTERVAL])

  const handleWalletConnection = useCallback(
    async (address: string, provider: WalletProviderWithSigning) => {
      try {
        setAccount(address)
        setIsConnected(true)
        setWalletProvider(provider)

        // Determine effective cluster: prioritize localStorage override (UI network switcher), then env
        const overrideCluster = (() => {
          try { return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() } catch { return "" }
        })()
        const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase()
        const effectiveCluster = overrideCluster || envCluster
        const normalizedCluster = effectiveCluster.startsWith("mainnet")
          ? "mainnet-beta"
          : effectiveCluster === "testnet"
            ? "testnet"
            : "devnet"
        // Use smart RPC switcher for better reliability
        console.log(`🌐 Getting RPC connection for: ${normalizedCluster} (override: ${overrideCluster || 'none'}, env: ${envCluster})`)
        let conn: Connection
        try {
          conn = await getHealthyRpcConnection(normalizedCluster as 'mainnet-beta' | 'devnet' | 'testnet')
          console.log("✅ Connected to healthy RPC:", conn.rpcEndpoint)
        } catch (error) {
          console.warn("⚠️ Smart RPC failed, falling back to legacy method:", error)
          // Fallback to legacy RPC selection
          const { getCustomRpcUrl, getRpcEndpoint } = await import('@/utils/rpc-endpoints')
          const customRpcUrl = getCustomRpcUrl(normalizedCluster)
          const endpoint = customRpcUrl || getRpcEndpoint(normalizedCluster)
          
          console.log("Using fallback endpoint:", endpoint, "cluster:", normalizedCluster)
          conn = new Connection(endpoint, "confirmed")
        }
        setProvider(conn)
        setChainId(null)

        // Set public key for smart contract interactions
        const pubKey = new PublicKey(address)
        setPublicKey(pubKey)

        // Create Anchor provider only if wallet provider supports signing
        if (provider && typeof (provider as WalletProviderWithSigning).signTransaction === 'function') {
          try {
            const anchorWallet = {
              publicKey: pubKey,
              signTransaction: (provider as WalletProviderWithSigning).signTransaction!.bind(provider),
              signAllTransactions: (provider as WalletProviderWithSigning).signAllTransactions?.bind(provider) ||
                (async (txs: (Transaction | VersionedTransaction)[]) => {
                  const signed = []
                  for (const tx of txs) {
                    const wp = provider as WalletProviderWithSigning
                    if (typeof wp.signTransaction === 'function') {
                      signed.push(await wp.signTransaction(tx))
                    }
                  }
                  return signed
                }),
            } as anchor.Wallet

            const anchorProv = new anchor.AnchorProvider(conn, anchorWallet, {
              commitment: "confirmed",
              preflightCommitment: "confirmed",
            })
            setAnchorProvider(anchorProv)
          } catch (providerError) {
            console.warn("Failed to create Anchor provider:", providerError)
            setAnchorProvider(null)
          }
        }

        // Skip initial balance fetch to avoid unnecessary RPC calls
        // Balance will be fetched only when user explicitly requests it
        console.log("✅ Wallet connected - skipping automatic balance fetch to preserve RPC limits")

        // Silent backend authentication to create/refresh session
        try {
          const res = await AuthService.authenticateWallet(address)
          console.log('✅ Backend session established for', res.user.user_address)
        } catch (authError) {
          console.warn('⚠️ Silent auth failed:', authError)
        }

        // Silent pending withdrawals resolver (one-shot per page load)
        try {
          const url = `${API_CONFIG.getBaseUrl()}/transactions/pending/resolve`
          await ApiClient.post(url, { walletAddress: address })
        } catch {}
      } catch (error) {
        console.error("Wallet connection failed:", error)
        setLastError(error as Error)
      }
    },
    [] // Remove walletManager dependency to prevent recreation
  )

  // WalletConnect/Reown integration - listen to AppKit events
  useEffect(() => {
    const initializeWalletContext = async () => {
      try {
        console.log("WalletContextProvider: Starting initialization...")
        // Add a small delay to ensure AppKitProvider has finished initialization
        await new Promise(resolve => setTimeout(resolve, 200))

        console.log("WalletContextProvider: Getting AppKit instance...")
        const appKit = walletManager.getAppKit()
        if (!appKit) {
          console.log("WalletContextProvider: No AppKit instance available")
          return
        }
        console.log("WalletContextProvider: AppKit instance obtained, subscribing to events...")

        const handleAccountChange = (event: AppKitAccountEvent) => {
          console.log("AppKit account changed:", event)
          const address = event?.address
          const isConnectedState = event?.isConnected

          if (address && isConnectedState && address !== account) {
            console.log("User connected wallet:", address)
            const provider = appKit.getWalletProvider()
            handleWalletConnection(address, provider)
          } else if (!address || !isConnectedState) {
            console.log("User disconnected wallet")
            // Wallet disconnected
            setAccount(null)
            setIsConnected(false)
            setWalletProvider(null)
            setProvider(null)
            setAnchorProvider(null)
            setPublicKey(null)
            setBalance(null)
          }
        }

        const handleStateChange = (event: AppKitStateEvent) => {
          console.log("AppKit state changed:", event)

          // Check if this is a connection event with wallet address
          if (event?.address && event.address !== account) {
            console.log("Connection state change detected:", event.address)
            const provider = appKit.getWalletProvider()
            handleWalletConnection(event.address, provider)
          }
        }

        // Subscribe to AppKit events
        try {
          appKit.subscribeAccount(handleAccountChange)
          appKit.subscribeState(handleStateChange)

          console.log("WalletContextProvider: Successfully subscribed to AppKit events")

          // Check for existing connection (auto-reconnect without modal)
          // This only reconnects if the user was previously connected and hasn't explicitly disconnected
          const connectionState = walletManager.getConnectionState()
          if (connectionState.isConnected && connectionState.address) {
            console.log("WalletContextProvider: Found existing connection, auto-reconnecting:", connectionState.address)
            const provider = appKit.getWalletProvider()
            if (provider) {
              handleWalletConnection(connectionState.address, provider)
            }
          } else {
            console.log("WalletContextProvider: No existing connection found")
          }
        } catch (error) {
          console.error("Failed to subscribe to AppKit events:", error)
        }

        // Cleanup function
        return () => {
          try {
            // AppKit might not have unsubscribe methods, so we'll just ignore cleanup errors
            console.log("WalletContextProvider: Cleaning up event subscriptions")
          } catch (error) {
            console.debug("AppKit cleanup error:", error)
          }
        }
      } catch (error) {
        console.error("Failed to initialize wallet context:", error)
      }
    }

    initializeWalletContext()
  }, [account, handleWalletConnection, walletManager]) // Empty dependency array - only initialize once on mount

  // Removed automatic balance updates to prevent unnecessary RPC calls
  // Balance will only be fetched when explicitly requested by user actions

  // Removed periodic balance updates to prevent unnecessary RPC calls
  // Balance will only update when account/provider changes or user manually refreshes

  const connectWallet = async (providerType: string) => {
    setIsConnecting(true)
    setLastError(null)

    try {
      console.log("Connecting wallet:", providerType)

      // Clear any previous connection state
      setAccount(null)
      setIsConnected(false)
      setWalletProvider(null)
      setProvider(null)
      setAnchorProvider(null)
      setPublicKey(null)
      setBalance(null)

      // Store the requested provider type
      localStorage.setItem("connectedWallet", providerType)

      // Open the AppKit modal
      walletManager.openConnectModal()

      console.log("Wallet connection modal opened")
    } catch (error) {
      console.error("Error connecting wallet:", error)
      setLastError(error as Error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = useCallback(async () => {
    try {
      walletManager.disconnect()

      setAccount(null)
      setChainId(null)
      setBalance(null)
      setProvider(null)
      setIsConnected(false)
      setAnchorProvider(null)
      setPublicKey(null)
      setWalletProvider(null)

      localStorage.removeItem("connectedWallet")
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
      setLastError(error as Error)
    }
  }, [walletManager])

  const switchNetwork = async (_targetChainId: number) => {
    try {
      const current = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase()
      const override = (() => {
        try {
          return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase()
        } catch {
          return ""
        }
      })()
      const effective = override || current
      const next = effective === "mainnet" || effective === "mainnet-beta" ? "devnet" : "mainnet-beta"
      
      console.log(`Switching network from ${effective} to ${next}`)
      
      // 1. Update localStorage
      try {
        localStorage.setItem("solana_cluster_override", next)
        // Clear RPC cache when network changes
        onNetworkChange()
      } catch {
        // ignore storage errors
      }
      
      // 2. Try to switch the wallet network via AppKit
      try {
        const appKit = walletManager.getAppKit()
        if (appKit && typeof appKit.switchNetwork === 'function') {
          // Import the network objects
          const { solana, solanaDevnet } = await import('@reown/appkit/networks')
          const targetNetwork = next === "mainnet-beta" ? solana : solanaDevnet
          
          console.log(`Switching AppKit to network: ${targetNetwork.name}`)
          await appKit.switchNetwork(targetNetwork)
        }
      } catch (switchError) {
        console.warn("AppKit network switch failed, will reload page:", switchError)
      }
      
      // 3. Reload page to ensure clean state
      window.location.reload()
    } catch (error) {
      console.error("Failed to switch network:", error)
      setLastError(error as Error)
    }
  }

  const formatAddress = (address: string): string => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getChainInfo = (_cid: number | null) => {
    const override = (() => {
      try {
        return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase()
      } catch {
        return ""
      }
    })()
    const clusterStr = (override || (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet")).toLowerCase()
    const isMainnet = clusterStr === "mainnet" || clusterStr === "mainnet-beta"
    const isTestnet = clusterStr === "testnet"
    return {
      name: isMainnet ? "Solana Mainnet" : isTestnet ? "Solana Testnet" : "Solana Devnet",
      symbol: "SOL",
      explorer: isMainnet
        ? "https://explorer.solana.com"
        : isTestnet
          ? "https://explorer.solana.com?cluster=testnet"
          : "https://explorer.solana.com?cluster=devnet",
    }
  }

  const openConnectModal = () => {
    walletManager.openConnectModal()
  }

  const clearError = () => {
    setLastError(null)
  }

  const refreshBalance = useCallback(async () => {
    if (!account || !provider) {
      console.warn("Cannot refresh balance - no account or provider")
      return
    }
    console.log("🔄 Manual balance refresh requested")
    await updateBalance(provider, account, true)
  }, [account, provider, updateBalance])

  // Transaction signing methods
  const signTransaction = useCallback(async (transaction: Transaction | VersionedTransaction) => {
    if (!walletProvider || typeof walletProvider !== 'object' || !('signTransaction' in walletProvider)) {
      throw new Error("Wallet not connected or does not support transaction signing")
    }
    try {
      const wp = walletProvider as WalletProviderWithSigning
      if (!wp.signTransaction) {
        throw new Error("Wallet does not support transaction signing")
      }
      return await wp.signTransaction(transaction)
    } catch (error) {
      console.error("Transaction signing failed:", error)
      setLastError(error as Error)
      throw error
    }
  }, [walletProvider])

  const signAllTransactions = useCallback(async (transactions: (Transaction | VersionedTransaction)[]) => {
    if (!walletProvider || typeof walletProvider !== 'object') {
      throw new Error("Wallet not connected")
    }
    try {
      const wp = walletProvider as WalletProviderWithSigning
      if (wp.signAllTransactions) {
        return await wp.signAllTransactions(transactions)
      } else if (wp.signTransaction) {
        // Fallback: sign transactions one by one
        const signed = []
        for (const tx of transactions) {
          signed.push(await wp.signTransaction(tx))
        }
        return signed
      } else {
        throw new Error("Wallet does not support transaction signing")
      }
    } catch (error) {
      console.error("Batch transaction signing failed:", error)
      setLastError(error as Error)
      throw error
    }
  }, [walletProvider])

  const value: WalletContextType = {
    account,
    chainId,
    balance,
    isConnecting,
    isConnected,
    isInitializing,
    provider,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    formatAddress,
    getChainInfo,
    openConnectModal,
    lastError,
    clearError,
    // Smart contract capabilities
    anchorProvider,
    publicKey,
    signTransaction: isConnected ? signTransaction : null,
    signAllTransactions: isConnected ? signAllTransactions : null,
    // Manual balance refresh
    refreshBalance,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletContextProvider')
  }
  return context
}