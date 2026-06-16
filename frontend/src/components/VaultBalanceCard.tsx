import React, { useMemo, useState, useEffect, useCallback } from "react";
import cardBg from "@/assets/card-bg.jpg";
import { Info, Copy, RefreshCcw, Repeat, LogOut, Shield, AlertTriangle } from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { useAuth } from "@/contexts/auth-context";
import { useLicense } from "@/contexts/license-context";
import { getUserAgents } from "@/services/agent/agent-service";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from "sweetalert2";
import { fetchGlobalPnlSummary } from "@/services/agent/pnl-backend";

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
  const { account, formatAddress, getChainInfo, switchNetwork, openConnectModal, disconnectWallet, provider, publicKey } = useWallet();
  const { user, refreshSession } = useAuth();
  const { hasValidLicense, isNearExpiry, daysRemaining, licenseInfo } = useLicense();

  // State for claimable balance
  const [totalClaimable, setTotalClaimable] = useState<number>(0);
  const [affiliateCommission, setAffiliateCommission] = useState<number>(0);
  const [unclaimedAgentsUsd, setUnclaimedAgentsUsd] = useState<number>(0);
  const [hasActiveAgents, setHasActiveAgents] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Dynamic font size for balance
  const [balanceFontSize, setBalanceFontSize] = useState<string>("text-4xl");

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
  const isDevEnv = useMemo(() => (import.meta.env.VITE_ENV ?? '').toString().toLowerCase().trim() === 'dev', []);

  // Read bonus and reward balances from auth user (micro-USDT -> display USD)
  const { bonusBalance, rewardBalance } = useMemo(() => {
    const bonusMicro = user?.bonus_balance_micro ? Number(user.bonus_balance_micro) : 0;
    const rewardMicro = user?.reward_balance_micro ? Number(user.reward_balance_micro) : 0;
    return {
      bonusBalance: bonusMicro / 1_000_000,
      rewardBalance: rewardMicro / 1_000_000
    };
  }, [user?.bonus_balance_micro, user?.reward_balance_micro]);

  // Calculate total string length to adjust font size
  const totalBalanceValue = (bonusBalance || 0) + (rewardBalance || 0) + (unclaimedAgentsUsd || 0);
  const formattedTotalBalance = totalBalanceValue.toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  });

  useEffect(() => {
    const len = formattedTotalBalance.length;
    // Base is 4xl. If length > 12 chars (e.g. $1,000.000000 is 13 chars), shrink it.
    if (len > 18) setBalanceFontSize("text-xl");
    else if (len > 14) setBalanceFontSize("text-2xl");
    else if (len > 11) setBalanceFontSize("text-3xl");
    else setBalanceFontSize("text-4xl");
  }, [formattedTotalBalance]);

  // Fetch total claimable amount from all active agents + affiliate commission
  const fetchTotalClaimable = useCallback(async () => {
    if (!publicKey) {
      setTotalClaimable(0);
      setAffiliateCommission(0);
      setHasActiveAgents(false);
      return;
    }

    setIsRefreshing(true);
    try {
      // Removed explicit session refresh to prevent infinite loops
      // The session is already managed by AuthContext and refreshed on mount/intervals

      const [agentsResult, pnlSummary] = await Promise.all([
        getUserAgents({ connection: provider || undefined }, publicKey),
        fetchGlobalPnlSummary(),
      ]);

      setHasActiveAgents(agentsResult.totalCount > 0);

      const remaining = typeof pnlSummary.remainingWithdrawable === 'string'
        ? Number(pnlSummary.remainingWithdrawable.replace(/[^0-9.-]+/g, ''))
        : Number(pnlSummary.remainingWithdrawable ?? 0);

      const safeRemaining = Number.isFinite(remaining) ? remaining : 0;

      const unclaimed = Number(typeof pnlSummary.unclaimedAgentResults === 'string' ? pnlSummary.unclaimedAgentResults.replace(/[^0-9.-]+/g, '') : 0);
      const safeUnclaimed = Number.isFinite(unclaimed) ? unclaimed : 0;
      setUnclaimedAgentsUsd(safeUnclaimed);
      setTotalClaimable(safeRemaining);
      setAffiliateCommission(0);
    } catch (error) {
      console.error('Error fetching total claimable:', error);
      setTotalClaimable(0);
      setUnclaimedAgentsUsd(0);
      setAffiliateCommission(0);
      setHasActiveAgents(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [publicKey, provider]);

  // Fetch on mount and when wallet changes
  useEffect(() => {
    fetchTotalClaimable();
  }, [fetchTotalClaimable]);

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
          {isDevEnv && (
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
          )}
        </div>

        {/* Balance label */}
        <div className="mt-4 flex items-center gap-2 text-xs tracking-[0.15em] uppercase text-white/80">
          <span>Total Available</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 opacity-70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Combined total of claimable agent ROI and available affiliate commissions.
                  This includes earnings from your AI trading agents and referral network.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Total Amount with refresh */}
        <div className="mt-1 flex items-center gap-2">
          <div className={`${balanceFontSize} font-bold transition-all duration-200`}>
            ${formattedTotalBalance}
          </div>
          <button
            onClick={fetchTotalClaimable}
            disabled={isRefreshing}
            className="hover:opacity-100 opacity-70 transition-opacity p-1 rounded-full hover:bg-white/10"
            aria-label="Refresh available balance"
          >
            <RefreshCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Breakdown */}
        {(totalClaimable > 0 || affiliateCommission > 0 || rewardBalance > 0) && (
          <div className="mt-3 space-y-1">
            {bonusBalance > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>Affiliate Bonus (DB):</span>
                <span>${bonusBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</span>
              </div>
            )}
            {unclaimedAgentsUsd > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>Agent Results (Unclaimed):</span>
                <span>${unclaimedAgentsUsd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</span>
              </div>
            )}
            {rewardBalance > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>Reward Balance (Refunds):</span>
                <span>${rewardBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</span>
              </div>
            )}
            {totalClaimable > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>Target PnL:</span>
                <span>${totalClaimable.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</span>
              </div>
            )}
            {affiliateCommission > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>Affiliate Commission:</span>
                <span>${affiliateCommission.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons moved to WalletActionsCard */}
      </div>
    </div>
  );
}
