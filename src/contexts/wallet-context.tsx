import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react"
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js"
import { WalletManager } from "@/services/wallet/wallet-manager"

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
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [provider, setProvider] = useState<Connection | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)

  const walletManager = WalletManager.getInstance()

  // AppKit integration
  const appKitAccount = useAppKitAccount()
  const appKitProvider = useAppKitProvider("solana")
  const walletProvider = appKitProvider?.walletProvider ?? null

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
    async (address: string) => {
      try {
        setAccount(address)
        setIsConnected(true)

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
        await updateBalance(conn, address)
      } catch (error) {
        console.error("Wallet connection failed:", error)
        setLastError(error as Error)
      }
    },
    []
  )

  useEffect(() => {
    if (account && provider) {
      updateBalance(provider, account)
    }
  }, [account, provider])

  // Solana wallets don’t use window.ethereum; rely on AppKit account state

  const connectWallet = async (providerType: string) => {
    setIsConnecting(true)
    try {
      localStorage.setItem("connectedWallet", providerType)
    } catch (error) {
      console.error("Error connecting wallet:", error)
      setLastError(error as Error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = useCallback(async () => {
    walletManager.disconnect()

    setAccount(null)
    setChainId(null)
    setBalance(null)
    setProvider(null)
    setIsConnected(false)

    localStorage.removeItem("connectedWallet")
  }, [walletManager])

  useEffect(() => {
    if (appKitAccount.isConnected && appKitAccount.address) {
      if (account !== appKitAccount.address) {
        handleWalletConnection(appKitAccount.address)
      }
    } else if (!appKitAccount.isConnected && isConnected) {
      disconnectWallet()
    }
  }, [
    appKitAccount.isConnected,
    appKitAccount.address,
    account,
    isConnected,
    handleWalletConnection,
    disconnectWallet,
  ])

  useEffect(() => {
    const checkExistingConnection = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (appKitAccount.isConnected && appKitAccount.address && !account) {
        await handleWalletConnection(appKitAccount.address)
      }
    }
    checkExistingConnection()
  }, [appKitAccount.isConnected, appKitAccount.address, account, handleWalletConnection])

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
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}