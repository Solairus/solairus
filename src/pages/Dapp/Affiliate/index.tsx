import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useWallet } from "@/contexts/wallet-context";
import { getProgram, derivePdas, UserProfile, Config, MyReferrals } from "@/lib/solairus-main";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import AffiliateEarningsCard from "@/components/AffiliateEarningsCard";
import ReferralNetworkCard from "@/components/ReferralNetworkCard";
import AffiliateLinkCard from "@/components/AffiliateLinkCard";
import MyReferralsCard from "@/components/MyReferralsCard";
// import EarningsHistoryCard from "@/components/EarningsHistoryCard";
import { DollarSign, Users, Share2, TrendingUp, RefreshCw, ArrowDownToLine } from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import BackButton from '@/components/ui/BackButton';

export default function AffiliatePage() {
  // Helper function to format USDT amounts safely
  const formatUsdt = (amount: anchor.BN) => {
    // Use string division to avoid precision issues with large numbers
    const amountStr = amount.toString();
    const wholePart = amountStr.slice(0, -6) || '0';
    const decimalPart = amountStr.slice(-6).padStart(6, '0');
    return `${wholePart}.${decimalPart.slice(0, 2)}`;
  };

  const { account } = useWalletConnection();
  const { anchorProvider } = useWallet();
  
  // Get actual referral count from MyReferrals account
  const [referralCount, setReferralCount] = useState<number>(0);
  
  const loadReferralCount = useCallback(async () => {
    if (!account || !anchorProvider) return;

    try {
      const program = getProgram(anchorProvider);
      const userPubkey = new PublicKey(account);
      const { referrals } = derivePdas(userPubkey);

      if (referrals) {
        try {
          const referralData = await program.account["myReferrals"].fetch(referrals);
          setReferralCount(referralData.totalCount || 0);
        } catch (referralError) {
          // Referral account doesn't exist yet (no referrals)
          setReferralCount(0);
        }
      }
    } catch (err) {
      console.warn("Failed to load referral count:", err);
      setReferralCount(0);
    }
  }, [account, anchorProvider]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const loadUserData = useCallback(async () => {
    if (!account || !anchorProvider) return;

    try {
      setIsLoading(true);
      setError(null);

      const program = getProgram(anchorProvider);
      const userPubkey = new PublicKey(account);
      const { config: configPda, profile } = derivePdas(userPubkey);

      // Load config
      try {
        const configData = await program.account["config"].fetch(configPda) as Config;
        setConfig(configData);
      } catch (configError) {
        console.warn("Config not available:", configError);
        // Continue without config - use fallback values
      }

      // Load user profile
      try {
        const profileData = await program.account["userProfile"].fetch(profile) as UserProfile;
        setUserProfile(profileData);
      } catch (profileError) {
        console.warn("User profile not found:", profileError);
        setUserProfile(null);
      }

    } catch (err) {
      console.error("Failed to load user data:", err);
      setError("Failed to load affiliate data");
    } finally {
      setIsLoading(false);
    }
  }, [account, anchorProvider]);

  useEffect(() => {
    if (account && anchorProvider) {
      loadUserData();
      loadReferralCount();
    }
  }, [account, anchorProvider, loadUserData, loadReferralCount]);

  const handleRefresh = () => {
    loadUserData();
    loadReferralCount();
    toast.success("Data refreshed");
  };

  const handleWithdraw = async () => {
    if (!account || !anchorProvider || !userProfile) {
      toast.error("Wallet not connected");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const availableAmount = parseFloat(formatUsdt(userProfile.totalAffiliateEarnings.sub(userProfile.totalAffiliateWithdrawn)));
    if (amount > availableAmount) {
      toast.error(`Insufficient funds. Available: ${availableAmount} USDT`);
      return;
    }

    try {
      setIsWithdrawing(true);
      
      const program = getProgram(anchorProvider);
      const userPubkey = new PublicKey(account);
      const usdtMint = config?.usdtMint || new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      
      // Convert to smallest unit (6 decimals)
      const amountBN = new anchor.BN(Math.floor(amount * 1_000_000));
      
      // Import the withdrawal function
      const { withdrawAffiliateEarnings } = await import("@/lib/solairus-main");
      const signature = await withdrawAffiliateEarnings(
        program,
        userPubkey,
        amountBN,
        usdtMint
      );

      toast.success(`Successfully withdrew ${amount} USDT`);
      console.log("Withdrawal transaction:", signature);
      
      // Reset form
      setWithdrawAmount("");
      setShowWithdrawForm(false);
      
      // Trigger refresh of user profile
      loadUserData();
      
    } catch (error) {
      console.error("Withdrawal failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Withdrawal failed";
      toast.error(errorMessage);
    } finally {
      setIsWithdrawing(false);
    }
  };

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
  const usdtMint = config?.usdtMint || new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDT

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
              onClick={loadUserData}
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
                  <p className="text-sm font-bold">
                    ${userProfile ? formatUsdt(userProfile.totalAffiliateEarnings) : '0.00'}
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
                  <p className="text-sm font-bold">
                    ${userProfile ?
                      formatUsdt(userProfile.totalAffiliateEarnings.sub(userProfile.totalAffiliateWithdrawn)) :
                      '0.00'
                    }
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
                  <p className="text-sm font-bold">
                    ${userProfile ? formatUsdt(userProfile.totalAffiliateWithdrawn) : '0.00'}
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
      {userProfile && (() => {
        const earnings = {
          totalEarnings: userProfile.totalAffiliateEarnings,
          totalWithdrawn: userProfile.totalAffiliateWithdrawn,
          availableToWithdraw: userProfile.totalAffiliateEarnings.sub(userProfile.totalAffiliateWithdrawn)
        };
        const availableDisplay = formatUsdt(earnings.availableToWithdraw);
        const hasAvailableEarnings = earnings.availableToWithdraw.gt(new anchor.BN(0));

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
                    step="0.01"
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
                  />
                  <Button
                    onClick={() => setWithdrawAmount(availableDisplay)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Max
                  </Button>
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
          <AffiliateEarningsCard
            userProfile={userProfile}
          />

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
      {!userProfile && (
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