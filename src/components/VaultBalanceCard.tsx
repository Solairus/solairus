import React, { useMemo } from "react";
import cardBg from "@/assets/card-bg.jpg";
import { Info, Copy, RefreshCcw, Repeat, LogOut } from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import Swal from "sweetalert2";

type VaultBalanceCardProps = {
  walletTag?: string;
  walletLabel?: string;
  balance?: string;
  delta?: string;
};

export default function VaultBalanceCard({
  walletTag = "MW",
  walletLabel = "Main Wallet",
  balance = "$0.00",
  delta = "+$0.00 · +0.00%",
}: VaultBalanceCardProps) {
  const { account, formatAddress, getChainInfo, switchNetwork, openConnectModal, disconnectWallet } = useWallet();
  const guardEnabled = useMemo(() => {
    return (
      (import.meta.env.VITE_ENABLE_WALLET_GUARD ?? "true")
        .toString()
        .toLowerCase()
        .trim() === "true"
    );
  }, []);
  const previewAddress = useMemo(() => {
    try {
      return localStorage.getItem("solairus_preview_address");
    } catch {
      return null;
    }
  }, []);
  const effectiveAccount = account ?? (!guardEnabled ? (previewAddress ?? "PreviewWallet11111111111111111111111111111") : null);
  const truncated = useMemo(() => (effectiveAccount ? formatAddress(effectiveAccount) : walletLabel), [effectiveAccount, formatAddress, walletLabel]);
  const chainInfo = getChainInfo(null);
  const networkLabel = useMemo(() => {
    if (/mainnet/i.test(chainInfo.name)) return "Mainnet";
    if (/testnet/i.test(chainInfo.name)) return "Testnet";
    return "Devnet";
  }, [chainInfo.name]);
  const networkColorClass = useMemo(() => {
    return networkLabel === "Mainnet" ? "text-green-400" : networkLabel === "Testnet" ? "text-orange-400" : "text-cyan-400";
  }, [networkLabel]);

  const copyAddress = async () => {
    if (!effectiveAccount) return;
    try {
      await navigator.clipboard.writeText(effectiveAccount);
    } catch {
      // ignore clipboard failures
    }
  };
  return (
    <div className="relative rounded-2xl overflow-hidden text-white shadow-xl">
      {/* Background image */}
      <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${cardBg})` }} />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/90" />

      {/* Content */}
      <div className="relative p-4">
        {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{truncated}</span>
              <button
                aria-label="Copy address"
                onClick={async () => {
                  await copyAddress();
                  Swal.fire({ title: "Copied!", text: "Wallet address copied.", icon: "success", timer: 1500, showConfirmButton: false });
                }}
                className="hover:opacity-100 opacity-70 transition"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                aria-label="Switch address"
                onClick={() => {
                  openConnectModal();
                }}
                className="hover:opacity-100 opacity-70 transition"
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                aria-label="Disconnect"
                onClick={async () => {
                  const res = await Swal.fire({
                    title: "Disconnect Wallet?",
                    text: "You can reconnect at any time.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Yes, disconnect",
                    cancelButtonText: "Cancel",
                  });
                  if (res.isConfirmed) {
                    await disconnectWallet();
                    await Swal.fire({ title: "Disconnected", icon: "success", timer: 1500, showConfirmButton: false });
                  }
                }}
                className="hover:opacity-100 opacity-70 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${networkColorClass}`}>{networkLabel}</span>
              <button
                aria-label="Switch network"
                onClick={async () => {
                  const nextLabel = networkLabel === "Mainnet" ? "Devnet" : "Mainnet";
                  const res = await Swal.fire({
                    title: "Switch Network?",
                    text: `Switch from ${networkLabel} to ${nextLabel}?`,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Yes, switch",
                    cancelButtonText: "Cancel",
                  });
                  if (res.isConfirmed) {
                    await switchNetwork(0);
                  }
                }}
                className="hover:opacity-100 opacity-80 transition"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

        {/* Balance label */}
        <div className="mt-4 flex items-center gap-2 text-xs tracking-[0.15em] uppercase text-white/80">
          <span>Balance</span>
          <Info className="w-3.5 h-3.5 opacity-70" />
        </div>

        {/* Amount */}
        <div className="mt-1 text-4xl font-bold">{balance}</div>
        <div className="mt-1 text-sm text-white/70">{delta}</div>

        {/* Action buttons moved to WalletActionsCard */}
      </div>
    </div>
  );
}