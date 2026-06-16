import { useCallback } from "react"
import { useWallet } from "@/contexts/wallet-context"

export function useWalletConnection() {
  const {
    account,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    openConnectModal,
  } = useWallet()

  const connect = useCallback(async (providerType: string) => {
    try {
      await connectWallet(providerType)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      throw error
    }
  }, [connectWallet])

  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet()
    } catch (error) {
      console.error("Failed to disconnect wallet:", error)
      throw error
    }
  }, [disconnectWallet])

  const openModal = useCallback(() => {
    try {
      openConnectModal()
    } catch (error) {
      console.error("Failed to open connect modal:", error)
    }
  }, [openConnectModal])

  return {
    account,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    openModal,
  }
}