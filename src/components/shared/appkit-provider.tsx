import { useEffect, type ReactNode, type ReactElement } from "react"
import { WalletManager } from "@/services/wallet/wallet-manager"

export function AppKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const walletManager = WalletManager.getInstance()
      walletManager.getAppKit()
    } catch (error) {
      console.error("AppKitProvider: Failed to initialize AppKit:", error)
    }
  }, [])

  return children as ReactElement
}