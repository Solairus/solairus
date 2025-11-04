import React, { useMemo, useState, useEffect, useCallback } from "react";
import cardBg from "@/assets/card-bg.jpg";
import { Info, Copy, RefreshCcw, Repeat, LogOut, Shield, AlertTriangle } from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { useLicense } from "@/contexts/license-context";
import { getUserAgents } from "@/services/agent/agent-service";
import { getLiveRoi } from "@/services/agent/live-roi-service";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProgram, derivePdas, UserProfile } from "@/lib/solairus-removed";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
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
  const { account, formatAddress, getChainInfo, switchNetwork, openConnectModal, disconnectWallet, provider, publicKey } = useWallet();
  const { hasValidLicense, isNearExpiry, daysRemaining, licenseInfo } = useLicense();
  
  // State for claimable balance
  const [totalClaimable, setTotalClaimable] = useState<number>(0);
  const [affiliateCommission, setAffiliateCommission] = useState<number>(0);
  const [hasActiveAgents, setHasActiveAgents] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
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

  // Helper function to format USDT amounts safely
  const formatUsdt = (amount: anchor.BN) => {
    const amountStr = amount.toString();
    const wholePart = amountStr.slice(0, -6) || '0';
    const decimalPart = amountStr.slice(-6).padStart(6, '0');
    return parseFloat(`${wholePart}.${decimalPart.slice(0, 2)}`);
  };

  // Fetch total claimable amount from all active agents + affiliate commission
  const fetchTotalClaimable = useCallback(async () => {
    if (!publicKey || !provider) {
      setTotalClaimable(0);
      setAffiliateCommission(0);
      setHasActiveAgents(false);
      return;
    }

    setIsRefreshing(true);
    try {
      // Get all user agents
      const result = await getUserAgents(provider, publicKey);
      const activeAgents = result.agents.filter(agent => !agent.yieldCapReached);
      
      setHasActiveAgents(activeAgents.length > 0);
      
      // Calculate total claimable from all active agents
      let totalClaimableAmount = 0;
      
      console.log('🔍 Calculating claimable for', activeAgents.length, 'active agents');
      
      for (const agent of activeAgents) {
        try {
          console.log('📊 Processing agent:', agent.activationId, 'canWithdraw:', agent.canWithdraw);
          
          if (agent.canWithdraw) {
            // Use the getLiveRoi service to get current withdrawable amount
            const liveRoiData = await getLiveRoi(provider, publicKey, agent.activationId);
            
            if (liveRoiData && liveRoiData.isWithdrawable) {
              console.log('💰 Agent', agent.activationId, 'claimable:', liveRoiData.currentWithdrawableAmount);
              totalClaimableAmount += liveRoiData.currentWithdrawableAmount;
            } else {
              console.log('⏳ Agent', agent.activationId, 'not ready for withdrawal');
            }
          } else {
            console.log('🚫 Agent', agent.activationId, 'cannot withdraw (cooldown active)');
          }
        } catch (error) {
          console.warn('❌ Error calculating claimable for agent:', agent.activationId, error);
        }
      }
      
      // Get affiliate commission
      let affiliateAmount = 0;
      try {
        const program = getProgram(provider);
        const { profile } = derivePdas(publicKey);
        
        const profileData = await program.account["userProfile"].fetch(profile) as UserProfile;
        const availableCommission = profileData.totalAffiliateEarnings.sub(profileData.totalAffiliateWithdrawn);
        affiliateAmount = formatUsdt(availableCommission);
        
        console.log('💼 Available affiliate commission:', affiliateAmount);
      } catch (error) {
        console.warn('❌ Error fetching affiliate commission:', error);
        affiliateAmount = 0;
      }
      
      console.log('💵 Total claimable amount calculated:', totalClaimableAmount);
      console.log('💼 Total affiliate commission:', affiliateAmount);
      
      setTotalClaimable(totalClaimableAmount);
      setAffiliateCommission(affiliateAmount);
    } catch (error) {
      console.error('Error fetching total claimable:', error);
      setTotalClaimable(0);
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
          <div className="text-4xl font-bold">
            ${(totalClaimable + affiliateCommission).toLocaleString('en-US', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 
            })}
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
        {(totalClaimable > 0 || affiliateCommission > 0) && (
          <div className="mt-3 space-y-1">
            {totalClaimable > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>Agent ROI:</span>
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