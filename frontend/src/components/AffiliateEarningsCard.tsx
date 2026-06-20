import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, TrendingUp } from "lucide-react";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { AffiliateBackendService } from "@/services/affiliate/affiliate-backend";

export default function AffiliateEarningsCard() {
  const { account } = useWalletConnection();
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    totalWithdrawn: 0,
    availableToWithdraw: 0,
    level1Earnings: 0,
    level2Earnings: 0,
    level3Earnings: 0,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // Avoid backend call when wallet is not connected
        if (!account) return;
        const summary = await AffiliateBackendService.getSummary();
        const per = summary.per_level_micro || {};
        const bn = (v?: string | number) => Number(v ?? 0);
        const next = {
          totalEarnings: bn(summary.total_earnings_affiliate_micro ?? 0),
          totalWithdrawn: bn(summary.total_withdrawn_micro ?? 0),
          availableToWithdraw: bn(summary.available_to_withdraw_micro ?? summary.bonus_balance_micro ?? 0),
          level1Earnings: bn(per['L1'] ?? per['1'] ?? 0),
          level2Earnings: bn(per['L2'] ?? per['2'] ?? 0),
          level3Earnings: bn(per['L3'] ?? per['3'] ?? 0),
        };
        if (mounted) setEarnings(next);
      } catch (e) {
        console.error('Failed to fetch affiliate summary', e);
      }
    };
    load();
    return () => { mounted = false; };
  }, [account]);

  // Early return after hooks are declared to keep hook order consistent
  if (!account) {
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
  
  const formatUsdt = (amountMicro: number) => {
    const whole = Math.floor(amountMicro / 1_000_000);
    const frac = String(Math.abs(amountMicro) % 1_000_000).padStart(6, '0');
    return `${whole}.${frac.slice(0, 2)}`;
  };

  const totalEarningsDisplay = formatUsdt(earnings.totalEarnings);
  const totalWithdrawnDisplay = formatUsdt(earnings.totalWithdrawn);
  const availableDisplay = formatUsdt(earnings.availableToWithdraw);
  const level1Display = formatUsdt(earnings.level1Earnings);
  const level2Display = formatUsdt(earnings.level2Earnings);
  const level3Display = formatUsdt(earnings.level3Earnings);



  const hasEarnings = earnings.totalEarnings > 0;

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
        {earnings.totalWithdrawn > 0 && (
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