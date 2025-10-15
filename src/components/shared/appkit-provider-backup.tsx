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
        
        // Clear any existing wallet connections to prevent auto-reconnect
        try {
          localStorage.removeItem("connectedWallet")
          // Clear AppKit's internal storage
          const keysToRemove = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && (key.startsWith("walletconnect") || key.startsWith("reown"))) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key))
        } catch (error) {
          console.debug("Failed to clear wallet storage:", error)
        }
        
        // Initialize AppKit without preflight gating
        if (walletManager.hasProjectId()) {
          await walletManager.getAppKit()
          
          // Fix SVG attributes after AppKit initialization
          const fixSvgAttributes = () => {
            const svgs = document.querySelectorAll('svg')
            svgs.forEach(svg => {
              if (svg.getAttribute('width') === '' || svg.getAttribute('height') === '') {
                svg.setAttribute('width', '40')
                svg.setAttribute('height', '40')
              }
            })
          }
          
          // Override SVG creation to prevent empty attributes
          const originalCreateElement = document.createElement
          document.createElement = function(tagName: string) {
            const element = originalCreateElement.call(this, tagName)
            if (tagName.toLowerCase() === 'svg') {
              element.setAttribute('width', '40')
              element.setAttribute('height', '40')
            }
            return element
          }
          
          // Fix SVGs immediately and on DOM changes
          fixSvgAttributes()
          const observer = new MutationObserver(fixSvgAttributes)
          observer.observe(document.body, { childList: true, subtree: true })
          
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

  // Only render children after AppKit is initialized to prevent hook conflicts
  if (!isInitialized) {
    return <div>Initializing wallet...</div>
  }

  return <>{children}</>
}