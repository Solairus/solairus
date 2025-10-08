import React from "react";
import { Download, ShoppingCart, RefreshCcw, Coins, Send } from "lucide-react";

type WalletActionsCardProps = {
  onReceive?: () => void;
  onBuy?: () => void;
  onSwap?: () => void;
  onStake?: () => void;
  onSend?: () => void;
};

export default function WalletActionsCard({
  onReceive,
  onBuy,
  onSwap,
  onStake,
  onSend,
}: WalletActionsCardProps) {
  const Action: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    ariaLabel: string;
  }> = ({ label, icon, onClick, ariaLabel }) => (
    <div className="flex flex-col items-center gap-2">
      <button
        aria-label={ariaLabel}
        onClick={onClick}
        className="w-12 h-12 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition"
      >
        {icon}
      </button>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center justify-between mt-0 mb-0 text-white">
      <Action label="Receive" ariaLabel="Receive" onClick={onReceive} icon={<Download className="w-5 h-5" />} />
      <Action label="Buy" ariaLabel="Buy" onClick={onBuy} icon={<ShoppingCart className="w-5 h-5" />} />
      <Action label="Swap" ariaLabel="Swap" onClick={onSwap} icon={<RefreshCcw className="w-5 h-5" />} />
      <Action label="Stake" ariaLabel="Stake" onClick={onStake} icon={<Coins className="w-5 h-5" />} />
      <Action label="Send" ariaLabel="Send" onClick={onSend} icon={<Send className="w-5 h-5" />} />
    </div>
  );
}