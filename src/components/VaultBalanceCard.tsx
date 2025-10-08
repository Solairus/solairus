import React from "react";
import cardBg from "@/assets/card-bg.jpg";
import { Info, Maximize, Copy } from "lucide-react";

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
            <div className="w-7 h-7 rounded-md bg-white/15 backdrop-blur-sm flex items-center justify-center text-xs font-semibold">
              {walletTag}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{walletLabel}</span>
              <Copy className="w-4 h-4 opacity-70" />
            </div>
          </div>
          <Maximize className="w-4 h-4 opacity-80" />
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