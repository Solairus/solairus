import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, TrendingUp, Wallet, ArrowDownToLine } from "lucide-react";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { getProgram, withdrawAffiliateEarnings, getAffiliateEarnings, UserProfile } from "@/lib/solairus-main";
import { useWallet } from "@/contexts/wallet-context";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";

interface AffiliateEarningsCardProps {
  userProfile: UserProfile | null;
}

export default function AffiliateEarningsCard({ 
  userProfile
}: AffiliateEarningsCardProps) {

  if (!userProfile) {
    return (
      <Card className="bg-background/50 border-border/30">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Connect wallet to view affiliate earnings
          </p>
        </CardContent>
      </Card>
    );
  }

  const earnings = getAffiliateEarnings(userProfile);
  
  // Convert from smallest unit (6 decimals for USDT) to display format
  const formatUsdt = (amount: anchor.BN) => {
    // Use string division to avoid precision issues with large numbers
    const amountStr = amount.toString();
    const wholePart = amountStr.slice(0, -6) || '0';
    const decimalPart = amountStr.slice(-6).padStart(6, '0');
    return `${wholePart}.${decimalPart.slice(0, 2)}`;
  };

  const totalEarningsDisplay = formatUsdt(earnings.totalEarnings);
  const totalWithdrawnDisplay = formatUsdt(earnings.totalWithdrawn);
  const availableDisplay = formatUsdt(earnings.availableToWithdraw);
  const level1Display = formatUsdt(earnings.level1Earnings);
  const level2Display = formatUsdt(earnings.level2Earnings);
  const level3Display = formatUsdt(earnings.level3Earnings);



  const hasEarnings = earnings.totalEarnings.gt(new anchor.BN(0));
  const hasAvailableEarnings = earnings.availableToWithdraw.gt(new anchor.BN(0));

  return (
    <Card className="bg-background/50 border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-green-500/10">
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <CardTitle className="text-base">Unilevel Incomes</CardTitle>
          {hasEarnings && (
            <Badge variant="secondary" className="text-xs">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">


        {/* Level Breakdown */}
        {hasEarnings && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Earnings by Level</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background/40 rounded-md p-2 text-center">
                  <div className="text-sm font-semibold text-green-600">${level1Display}</div>
                  <div className="text-xs text-muted-foreground">L1 (5%)</div>
                </div>
                <div className="bg-background/40 rounded-md p-2 text-center">
                  <div className="text-sm font-semibold text-green-600">${level2Display}</div>
                  <div className="text-xs text-muted-foreground">L2 (3%)</div>
                </div>
                <div className="bg-background/40 rounded-md p-2 text-center">
                  <div className="text-sm font-semibold text-green-600">${level3Display}</div>
                  <div className="text-xs text-muted-foreground">L3 (2%)</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Withdrawal History */}
        {earnings.totalWithdrawn.gt(new anchor.BN(0)) && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Withdrawn:</span>
              <span className="font-medium">${totalWithdrawnDisplay}</span>
            </div>
          </>
        )}



        {/* Info Message */}
        {!hasEarnings && (
          <div className="text-center py-4">
            <TrendingUp className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Start earning by referring new users!
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Earn 5% + 3% + 2% from referral license activations
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}