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
import * as anchor from "@coral-xyz/anchor"

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

  const walletManager = WalletManager.getInstance()

  const updateBalance = async (
    solanaConn: Connection,
    address: string
  ) => {
    try {
      const pubkey = new PublicKey(address)
      const lamports = await solanaConn.getBalance(pubkey)
      setBalance((lamports / 1_000_000_000).toString())
    } catch (error) {
      console.error("Failed to get balance:", error)
    }
  }

  const handleWalletConnection = useCallback(
    async (address: string, provider: WalletProviderWithSigning) => {
      try {
        setAccount(address)
        setIsConnected(true)
        setWalletProvider(provider)

        const clusterStr = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase()
        const endpoint = clusterApiUrl(
          clusterStr === "mainnet" || clusterStr === "mainnet-beta"
            ? "mainnet-beta"
            : clusterStr === "testnet"
              ? "testnet"
              : "devnet"
        )
        const conn = new Connection(endpoint, "confirmed")
        setProvider(conn)
        setChainId(null)

        // Set public key for smart contract interactions
        const pubKey = new PublicKey(address)
        setPublicKey(pubKey)

        // Create Anchor provider if wallet provider is available
        if (provider && typeof provider === 'object' && 'signTransaction' in provider) {
          try {
            const anchorWallet = {
              publicKey: pubKey,
              signTransaction: provider.signTransaction?.bind(provider),
              signAllTransactions: provider.signAllTransactions?.bind(provider) ||
                (async (txs: (Transaction | VersionedTransaction)[]) => {
                  const signed = []
                  for (const tx of txs) {
                    if (provider.signTransaction) {
                      signed.push(await provider.signTransaction(tx))
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

        await updateBalance(conn, address)
      } catch (error) {
        console.error("Wallet connection failed:", error)
        setLastError(error as Error)
      }
    },
    []
  )

  // WalletConnect/Reown integration - listen to AppKit events
  useEffect(() => {
    const appKit = walletManager.getAppKit()
    if (!appKit) return

    const handleAccountChange = (event: AppKitAccountEvent) => {
      console.log("AppKit account changed:", event)
      const address = event?.address
      if (address && address !== account) {
        const provider = appKit.getWalletProvider()
        handleWalletConnection(address, provider)
      } else if (!address && isConnected) {
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

    const handleConnect = (event: AppKitStateEvent) => {
      console.log("AppKit connected:", event)
      // Check the current state after connection
      const state = appKit.getState()
      const selectedNetworkId = (state as { selectedNetworkId?: string })?.selectedNetworkId

      if (selectedNetworkId && selectedNetworkId.includes('solana:')) {
        const parts = selectedNetworkId.split(':')
        if (parts.length === 3) {
          const walletAddress = parts[2]
          if (walletAddress && walletAddress !== account) {
            const provider = appKit.getWalletProvider()
            handleWalletConnection(walletAddress, provider)
          }
        }
      }
    }

    const handleDisconnect = () => {
      console.log("AppKit disconnected")
      setAccount(null)
      setIsConnected(false)
      setWalletProvider(null)
      setProvider(null)
      setAnchorProvider(null)
      setPublicKey(null)
      setBalance(null)
    }

    // Subscribe to AppKit events
    try {
      appKit.subscribeAccount(handleAccountChange)
      appKit.subscribeState(handleConnect)

      // Also check initial state
      const initialState = appKit.getState()
      const selectedNetworkId = (initialState as { selectedNetworkId?: string })?.selectedNetworkId

      if (selectedNetworkId && selectedNetworkId.includes('solana:')) {
        const parts = selectedNetworkId.split(':')
        if (parts.length === 3) {
          const walletAddress = parts[2]
          if (walletAddress && walletAddress !== account) {
            const provider = appKit.getWalletProvider()
            handleWalletConnection(walletAddress, provider)
          }
        }
      }
    } catch (error) {
      console.error("Failed to subscribe to AppKit events:", error)
      // Fallback: check state once
      try {
        const state = appKit.getState()
        const selectedNetworkId = (state as { selectedNetworkId?: string })?.selectedNetworkId

        if (selectedNetworkId && selectedNetworkId.includes('solana:')) {
          const parts = selectedNetworkId.split(':')
          if (parts.length === 3) {
            const walletAddress = parts[2]
            if (walletAddress && walletAddress !== account) {
              const provider = appKit.getWalletProvider()
              handleWalletConnection(walletAddress, provider)
            }
          }
        }
      } catch (stateError) {
        console.error("Failed to check initial AppKit state:", stateError)
      }
    }

    // Cleanup function
    return () => {
      try {
        // AppKit might not have unsubscribe methods, so we'll just ignore cleanup errors
      } catch (error) {
        console.debug("AppKit cleanup error:", error)
      }
    }
  }, [account, isConnected, handleWalletConnection, walletManager])

  useEffect(() => {
    if (account && provider) {
      updateBalance(provider, account)
    }
  }, [account, provider])

  const connectWallet = async (providerType: string) => {
    setIsConnecting(true)
    try {
      localStorage.setItem("connectedWallet", providerType)
      walletManager.openConnectModal()
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
      try {
        localStorage.setItem("solana_cluster_override", next)
      } catch {
        // ignore storage errors
      }
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