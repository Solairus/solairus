import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useWallet } from "@/contexts/wallet-context";
import { getProgram, derivePdas, UserProfile, Config } from "@/lib/solairus-main";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import AffiliateEarningsCard from "@/components/AffiliateEarningsCard";
import ReferralNetworkCard from "@/components/ReferralNetworkCard";
import AffiliateLinkCard from "@/components/AffiliateLinkCard";
import { DollarSign, Users, Share2, TrendingUp, RefreshCw } from "lucide-react";
import * as anchor from "@coral-xyz/anchor";

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, [account, anchorProvider, loadUserData]);

  const handleRefresh = () => {
    loadUserData();
    toast.success("Data refreshed");
  };

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <Share2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-sm text-muted-foreground">
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
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your referrals and track your earnings
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-lg font-bold">
                  ${userProfile ? formatUsdt(userProfile.totalAffiliateEarnings) : '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-lg font-bold">
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
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-lg font-bold">22</p> {/* Mock data for now */}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <Share2 className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="text-lg font-bold">5% + 3% + 2%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="share">Share</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AffiliateEarningsCard
              userProfile={userProfile}
              usdtMint={usdtMint}
              onEarningsUpdate={loadUserData}
            />
            <ReferralNetworkCard userPublicKey={userPubkey} />
          </div>
          <AffiliateLinkCard />
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AffiliateEarningsCard
              userProfile={userProfile}
              usdtMint={usdtMint}
              onEarningsUpdate={loadUserData}
            />

            {/* Earnings History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Earnings History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Earnings history will be displayed here
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Track your commission earnings over time
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <ReferralNetworkCard userPublicKey={userPubkey} />

          {/* Network Growth Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Growing Your Network</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-background/60 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Share Your Link</h4>
                  <p className="text-xs text-muted-foreground">
                    Share your referral link on social media and with friends
                  </p>
                </div>
                <div className="p-4 bg-background/60 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Educate Others</h4>
                  <p className="text-xs text-muted-foreground">
                    Help others understand the benefits of AI trading
                  </p>
                </div>
                <div className="p-4 bg-background/60 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Stay Active</h4>
                  <p className="text-xs text-muted-foreground">
                    Engage with your network and provide ongoing support
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="share" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AffiliateLinkCard />

            {/* Sharing Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sharing Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs mt-0.5">1</Badge>
                    <div>
                      <p className="text-sm font-medium">Social Media</p>
                      <p className="text-xs text-muted-foreground">
                        Share on Twitter, Discord, Telegram, and other platforms
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs mt-0.5">2</Badge>
                    <div>
                      <p className="text-sm font-medium">Content Creation</p>
                      <p className="text-xs text-muted-foreground">
                        Create tutorials, reviews, or educational content
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs mt-0.5">3</Badge>
                    <div>
                      <p className="text-sm font-medium">Direct Outreach</p>
                      <p className="text-xs text-muted-foreground">
                        Reach out to friends and contacts personally
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs mt-0.5">4</Badge>
                    <div>
                      <p className="text-sm font-medium">Community Building</p>
                      <p className="text-xs text-muted-foreground">
                        Build a community around AI trading and DeFi
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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