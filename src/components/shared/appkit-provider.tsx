import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { WalletManager } from "@/services/wallet/wallet-manager"

export function AppKitProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeAppKit = async () => {
      try {
        // Add a small delay to ensure React is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const walletManager = WalletManager.getInstance()
        // Clear rotation cache per user request
        WalletManager.clearRotationCache()
        
        // Initialize AppKit without preflight gating
        if (walletManager.hasProjectId()) {
          await walletManager.getAppKit()
          setIsInitialized(true)
        } else {
          console.warn("AppKitProvider: VITE_WALLETCONNECT_PROJECT_ID not set; skipping AppKit init")
          setIsInitialized(true)
        }
      } catch (error) {
        console.error("AppKitProvider: Failed to initialize AppKit:", error)
        setIsInitialized(true) // Still render children even if AppKit fails
      }
    }

    initializeAppKit()
  }, [])

  // Suppress RPC connection notifications
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      /* Hide wallet connection notifications */
      [data-testid="w3m-toast"],
      .w3m-toast,
      .wallet-adapter-toast,
      .solana-wallet-toast,
      w3m-toast,
      w3m-modal w3m-toast,
      .appkit-toast,
      [data-testid="appkit-toast"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  // Only render children after AppKit is initialized to prevent hook conflicts
  if (!isInitialized) {
    return <div>Initializing wallet...</div>
  }

  return <>{children}</>
}