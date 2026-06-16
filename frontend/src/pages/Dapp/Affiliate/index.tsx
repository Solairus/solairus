import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useWallet } from "@/contexts/wallet-context";
import { AffiliateBackendService, type AffiliateSummary } from "@/services/affiliate/affiliate-backend";
import { PublicKey } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { confirmAndRecord } from '@/services/transactions/confirmAndRecord';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ApiClient, API_CONFIG } from "@/config/service-endpoints";
import { toast } from "sonner";
import AffiliateEarningsCard from "@/components/AffiliateEarningsCard";
import ReferralNetworkCard from "@/components/ReferralNetworkCard";
import AffiliateLinkCard from "@/components/AffiliateLinkCard";
import MyReferralsCard from "@/components/MyReferralsCard";
// import EarningsHistoryCard from "@/components/EarningsHistoryCard";
import { DollarSign, Users, Share2, TrendingUp, RefreshCw, ArrowDownToLine } from "lucide-react";
// Removed on-chain calls; using backend-only services
import BackButton from '@/components/ui/BackButton';

export default function AffiliatePage() {
  // Helper function to format USDT micro amounts safely
  const formatUsdtMicro = (micro?: number | string) => {
    const n = Number(micro ?? 0);
    const usd = Math.floor(n) / 1_000_000;
    return usd.toFixed(6);
  };

  const formatMicroExact = (micro?: number | string | bigint) => {
    const m = BigInt(String(micro ?? 0));
    const sign = m < 0n ? "-" : "";
    const abs = m < 0n ? -m : m;
    const whole = abs / 1_000_000n;
    const frac = abs % 1_000_000n;
    return `${sign}${whole.toString()}.${frac.toString().padStart(6, "0")}`;
  };

  const { account } = useWalletConnection();
  const { anchorProvider, signTransaction } = useWallet();

  // Referral count not provided via backend summary yet; default to 0
  const [referralCount, setReferralCount] = useState<number>(0);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!account) return;
    try {
      setIsLoading(true);
      setError(null);
      const s = await AffiliateBackendService.getSummary();
      setSummary(s);
    } catch (err) {
      console.error("Failed to load affiliate summary:", err);
      setError("Failed to load affiliate data");
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (account) {
      loadSummary();
      // Also fetch referrals to derive count
      (async () => {
        try {
          const list = await AffiliateBackendService.getReferrals();
          setReferralCount(Array.isArray(list) ? list.length : 0);
        } catch (e) {
          // Keep previous value on error; avoid noisy toasts on initial load
          console.warn('Failed to load referrals for count:', e);
        }
      })();
    }
  }, [account, loadSummary]);

  const handleRefresh = () => {
    loadSummary();
    toast.success("Data refreshed");
  };

  // Helper: resolve USDT mint based on cluster override/env
  const resolveUsdtMint = useCallback((): PublicKey => {
    let override = "";
    try {
      override = (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase();
    } catch {
      // ignore
    }
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase();
    const effective = override || envCluster;
    const normalized = effective.startsWith("mainnet") ? "mainnet-beta" : "devnet";

    const mintStr = normalized === "mainnet-beta"
      ? (import.meta.env.VITE_USDT_MINT as string)
      : (import.meta.env.VITE_USDT_MINT_DEVNET as string);

    if (!mintStr) throw new Error("USDT mint not configured in environment (.env)");
    return new PublicKey(mintStr);
  }, []);

  const handleWithdraw = async () => {
    try {
      if (!account || !anchorProvider) throw new Error("Wallet not connected");
      if (!signTransaction) throw new Error("Wallet does not support transaction signing");

      // Ensure backend auth session exists before calling protected endpoint
      try {
        const hasJwt = (() => {
          try { return Boolean(localStorage.getItem('solairus.jwt')); } catch { return false; }
        })();
        if (!hasJwt) {
          const { AuthService } = await import('@/services/auth/auth-service');
          await AuthService.authenticateWallet(account);
        }
      } catch {
        // proceed; server will respond clearly if unauthorized
      }

      const availableMicro = Number(summary?.available_to_withdraw_micro ?? summary?.bonus_balance_micro ?? 0);
      const requestedUsd = Number(withdrawAmount);
      if (!Number.isFinite(requestedUsd) || requestedUsd <= 0) {
        toast.error("Enter a valid amount in USDT");
        return;
      }
      const amountMicro = Math.floor(requestedUsd * 1_000_000);
      if (amountMicro > availableMicro) {
        toast.error("Amount exceeds available balance");
        return;
      }

      setIsWithdrawing(true);

      // Prepare init payload
      const userPubkey = new PublicKey(account);
      const mint = resolveUsdtMint();
      const recipientAta = getAssociatedTokenAddressSync(
        mint,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Call backend to init withdrawal and build tx
      const baseUrl = API_CONFIG.getBaseUrl();
      const initUrl = `${baseUrl}/withdrawals/init`;
      const initResp = await ApiClient.post(initUrl, {
        type: 'balance',
        mintAddress: mint.toBase58(),
        amountMicro,
        recipientAta: recipientAta.toBase58(),
      });
      const initJson = await initResp.json();
      const { orderId, txBase64 } = initJson as { orderId: string; txBase64: string };
      if (!orderId || !txBase64) throw new Error("Invalid init response from backend");

      // Decode, sign and confirm transaction using shared utility (REST-only; no WebSockets)
      const tx = Transaction.from(Buffer.from(txBase64, "base64"));
      const signed = await signTransaction(tx) as Transaction;
      const { signature } = await confirmAndRecord({
        connection: anchorProvider.connection,
        signedTx: signed,
        orderId,
      });
      const ok = Boolean(signature && signature.length > 0);

      // Backend verification will be handled via orderId polling below.
      // The initial record created by /withdrawals/init has no signature yet,
      // so posting to /transactions/verify by signature would 404 until it’s attached.
      // We rely on GET /transactions/:orderId which resolves the signature via reference
      // and updates status accordingly.

      // Order polling is already handled in confirmAndRecord; no extra WebSocket confirmation

      if (ok) {
        toast.success("Withdrawal sent and confirmed");
        setShowWithdrawForm(false);
        setWithdrawAmount("");
        await loadSummary();
      } else {
        toast.error("Withdrawal broadcast failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Compute and fill the maximum withdrawable amount safely
  const handleFillMax = useCallback(() => {
    const availableMicroNum = Number(summary?.available_to_withdraw_micro ?? summary?.bonus_balance_micro ?? 0);
    const availableMicro = BigInt(Math.max(0, Math.floor(availableMicroNum)));
    const feeBpsRaw = Number((import.meta.env as any).VITE_WITHDRAWAL_FEE_BPS ?? 0);
    const feeBps = Number.isFinite(feeBpsRaw) ? Math.max(0, Math.floor(feeBpsRaw)) : 0;
    const feeMicro = (availableMicro * BigInt(feeBps)) / 10_000n;
    const netMicro = availableMicro - feeMicro;
    const maxStr = formatMicroExact(netMicro);
    setWithdrawAmount(maxStr);
    toast.info(`Max amount filled: ${maxStr} USDT`);
  }, [summary?.available_to_withdraw_micro, summary?.bonus_balance_micro]);

  if (!account) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Share2 className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <h2 className="text-base font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-xs text-muted-foreground">
              Connect your wallet to access the affiliate dashboard and start earning commissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userPubkey = new PublicKey(account);

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <div className="flex items-center justify-start">
        <BackButton to="/dapp" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Affiliate Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Manage your referrals and track your earnings
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-xs">Refresh</span>
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <Button
              onClick={loadSummary}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <DollarSign className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Total Earned</p>
                  <p
                    className="text-sm font-bold"
                    style={{ fontSize: `clamp(0.95rem, calc(1.4rem - ${String(formatUsdtMicro(summary?.total_earnings_affiliate_micro ?? 0)).length} * 0.03rem), 1.25rem)`, lineHeight: 1.2 }}
                  >
                    ${formatUsdtMicro(summary?.total_earnings_affiliate_micro ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p
                    className="text-sm font-bold"
                    style={{ fontSize: `clamp(0.95rem, calc(1.4rem - ${String(formatUsdtMicro(summary?.available_to_withdraw_micro ?? summary?.bonus_balance_micro ?? 0)).length} * 0.03rem), 1.25rem)`, lineHeight: 1.2 }}
                  >
                    ${formatUsdtMicro(summary?.available_to_withdraw_micro ?? summary?.bonus_balance_micro ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <ArrowDownToLine className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                  <p
                    className="text-sm font-bold"
                    style={{ fontSize: `clamp(0.95rem, calc(1.4rem - ${String(formatUsdtMicro(summary?.total_withdrawn_micro ?? 0)).length} * 0.03rem), 1.25rem)`, lineHeight: 1.2 }}
                  >
                    ${formatUsdtMicro(summary?.total_withdrawn_micro ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Users className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Total Referrals</p>
                  <p className="text-sm font-bold">
                    {referralCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Withdrawal Section */}
      {summary && (() => {
        const availableMicro = Number(summary.available_to_withdraw_micro ?? summary.bonus_balance_micro ?? 0);
        const availableDisplay = formatUsdtMicro(availableMicro);
        const hasAvailableEarnings = availableMicro > 0;

        return (
          <div className="space-y-3">
            {showWithdrawForm && hasAvailableEarnings ? (
              <div className="space-y-3 p-4 bg-background/50 border border-border/30 rounded-lg">
                <h4 className="text-sm font-medium">Withdraw Earnings</h4>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount in USDT"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={availableDisplay}
                    step="0.000001"
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleFillMax}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          aria-label="Fill maximum withdrawable"
                        >
                          Max
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Withdraw full available balance (after any fees)
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !withdrawAmount}
                    className="flex-1"
                  >
                    {isWithdrawing ? (
                      <>
                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Withdrawing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Withdraw
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowWithdrawForm(false);
                      setWithdrawAmount("");
                    }}
                    variant="outline"
                    disabled={isWithdrawing}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowWithdrawForm(true)}
                disabled={!hasAvailableEarnings}
                className="w-full h-12 text-sm font-semibold"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {hasAvailableEarnings ? 'Withdraw' : 'No funds available'}
              </Button>
            )}
          </div>
        );
      })()}

      {/* Main Content Tabs */}
      <Tabs defaultValue="earnings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="earnings" className="text-xs">Earnings</TabsTrigger>
          <TabsTrigger value="referrals" className="text-xs">Referrals</TabsTrigger>
          <TabsTrigger value="share" className="text-xs">Share</TabsTrigger>
        </TabsList>



        <TabsContent value="earnings" className="space-y-4">
          <AffiliateEarningsCard />

          {/* TODO: Implement proper earnings history with RPC fallbacks */}
          {/* <EarningsHistoryCard userPublicKey={userPubkey} /> */}
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <MyReferralsCard
            userPublicKey={userPubkey}
            referralCount={referralCount}
          />
        </TabsContent>

        <TabsContent value="share" className="space-y-4">
          <AffiliateLinkCard />

          {/* Sharing Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sharing Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs mt-0.5">1</Badge>
                  <div>
                    <p className="text-xs font-medium">Social Media</p>
                    <p className="text-xs text-muted-foreground">
                      Share on Twitter, Discord, Telegram, and other platforms
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs mt-0.5">2</Badge>
                  <div>
                    <p className="text-xs font-medium">Content Creation</p>
                    <p className="text-xs text-muted-foreground">
                      Create tutorials, reviews, or educational content
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs mt-0.5">3</Badge>
                  <div>
                    <p className="text-xs font-medium">Direct Outreach</p>
                    <p className="text-xs text-muted-foreground">
                      Reach out to friends and contacts personally
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs mt-0.5">4</Badge>
                  <div>
                    <p className="text-xs font-medium">Community Building</p>
                    <p className="text-xs text-muted-foreground">
                      Build a community around AI trading and DeFi
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Registration Notice */}
      {!summary && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Profile Not Found
                </p>
                <p className="text-xs text-yellow-700">
                  You need to register first to start earning affiliate commissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}