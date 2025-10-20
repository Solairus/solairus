import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { WalletManager } from "@/services/wallet/wallet-manager"
import { logEnvironmentStatus, validateEnvironmentVariables } from "@/utils/env-validation"
import { debugEnvironmentVariables } from "@/utils/env-debug-vercel"

export function AppKitProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAppKit = async () => {
      try {
        // Validate environment variables first
        const validation = validateEnvironmentVariables()
        if (!validation.isValid) {
          console.error("Environment validation failed:", validation.errors)
          setInitError(`Environment configuration error: ${validation.errors.join(', ')}`)
          setIsInitialized(true)
          return
        }
        
        // Log environment status for debugging
        const envDebug = debugEnvironmentVariables()
        console.log('📊 Environment Summary:', envDebug)
        
        if (import.meta.env.DEV || import.meta.env.VITE_SHOW_DETAILED_ERRORS === 'true') {
          logEnvironmentStatus()
        }
        
        // Add a small delay to ensure React is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const walletManager = WalletManager.getInstance()
        // Clear rotation cache per user request
        WalletManager.clearRotationCache()
        
        // Initialize AppKit without preflight gating
        if (walletManager.hasProjectId()) {
          console.log("🔗 Initializing AppKit with project IDs...")
          await walletManager.getAppKit()
          console.log("✅ AppKit initialized successfully")
          setIsInitialized(true)
        } else {
          console.warn("AppKitProvider: No WalletConnect project IDs found; skipping AppKit init")
          setInitError("No WalletConnect project IDs configured")
          setIsInitialized(true)
        }
      } catch (error) {
        console.error("AppKitProvider: Failed to initialize AppKit:", error)
        setInitError(error instanceof Error ? error.message : String(error))
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Initializing wallet...</p>
        </div>
      </div>
    )
  }

  // Show error message if initialization failed but still render children
  if (initError && (import.meta.env.DEV || import.meta.env.VITE_SHOW_DETAILED_ERRORS === 'true')) {
    console.warn("AppKit initialization error:", initError)
  }

  return <>{children}</>
}