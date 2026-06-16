import type React from "react"
import { useWallet } from "@/contexts/wallet-context"

type WalletConnectionGuardProps = {
  children: React.ReactNode
}

export function WalletConnectionGuard({ children }: WalletConnectionGuardProps) {
  const {
    isConnected,
    isConnecting,
    openConnectModal,
    lastError,
    clearError,
  } = useWallet()

  if (lastError && !isConnected) {
    return (
      <div className="p-3 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md rounded-xl bg-red-900/20 p-5 shadow-xl backdrop-blur-xl border border-red-500/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Connection Error</h2>
            <button onClick={clearError} className="text-white/70 hover:text-white text-xs">✕</button>
          </div>
          <p className="text-sm text-white/70 mb-4">{lastError.message || "An error occurred while connecting your wallet"}</p>
          <button className="w-full bg-red-600 hover:bg-red-700 text-white h-10 text-sm" onClick={openConnectModal}>Retry</button>
        </div>
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className="p-3 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md rounded-xl bg-slate-900/90 p-5 shadow-xl backdrop-blur-xl border border-white/10">
          <h2 className="text-lg font-bold text-white text-center mb-2">Connecting Wallet</h2>
          <p className="text-sm text-white/70 text-center">Please approve the connection in your wallet...</p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="p-3 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md rounded-xl bg-slate-900/90 p-5 shadow-xl backdrop-blur-xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
            <span className="text-white/70 text-xs">Locked</span>
          </div>
          <p className="text-sm text-white/70 mb-4">Connect your wallet to access dApp features.</p>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white h-10 text-sm" onClick={openConnectModal}>Connect Wallet</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}