import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { getProgram, derivePdas } from "@/lib/solairus-removed";
import { useWallet } from "@/contexts/wallet-context";
import { PublicKey } from "@solana/web3.js";

interface ReferralNetworkCardProps {
  userPublicKey: PublicKey | null;
}

interface ReferralData {
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalCount: number;
  level1Referrals: string[];
  level2Referrals: string[];
  level3Referrals: string[];
}

export default function ReferralNetworkCard({ userPublicKey }: ReferralNetworkCardProps) {
  const { account } = useWalletConnection();
  const { anchorProvider } = useWallet();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadReferralData = useCallback(async () => {
    if (!userPublicKey || !anchorProvider) return;

    try {
      setIsLoading(true);
      setError(null);

      // Since referral tracking is not implemented yet, show empty state
      // TODO: Implement actual referral tracking system
      setReferralData({
        level1Count: 0,
        level2Count: 0,
        level3Count: 0,
        totalCount: 0,
        level1Referrals: [],
        level2Referrals: [],
        level3Referrals: [],
      });

      // TODO: Replace with actual ReferralTracker fetching when implemented
      /*
      try {
        const referralTrackerPda = PublicKey.findProgramAddressSync([
          Buffer.from("referral_tracker"),
          userPublicKey.toBuffer(),
        ], program.programId)[0];

        const referralTracker = await accounts(program).ReferralTracker.fetch(referralTrackerPda);
        
        setReferralData({
          level1Count: referralTracker.level1Referrals.length,
          level2Count: referralTracker.level2Referrals.length,
          level3Count: referralTracker.level3Referrals.length,
          totalCount: referralTracker.totalReferrals,
          level1Referrals: referralTracker.level1Referrals.map(pk => pk.toString()),
          level2Referrals: referralTracker.level2Referrals.map(pk => pk.toString()),
          level3Referrals: referralTracker.level3Referrals.map(pk => pk.toString()),
        });
      } catch (trackerError) {
        // ReferralTracker doesn't exist yet, use empty data
        setReferralData({
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
          totalCount: 0,
          level1Referrals: [],
          level2Referrals: [],
          level3Referrals: [],
        });
      }
      */

    } catch (err) {
      console.error("Failed to load referral data:", err);
      setError("Failed to load referral network");
    } finally {
      setIsLoading(false);
    }
  }, [userPublicKey, anchorProvider]);

  useEffect(() => {
    if (userPublicKey && anchorProvider) {
      loadReferralData();
    }
  }, [userPublicKey, anchorProvider, loadReferralData]);

  const toggleLevel = (level: number) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const openInExplorer = (address: string) => {
    window.open(`https://explorer.solana.com/address/${address}`, '_blank');
  };

  if (!account) {
    return (
      <Card className="bg-background/50 border-border/30">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Connect wallet to view referral network
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-background/50 border-border/30">
        <CardContent className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading referral network...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-background/50 border-border/30">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <Button onClick={loadReferralData} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!referralData) {
    return null;
  }

  const hasReferrals = referralData.totalCount > 0;

  return (
    <Card className="bg-background/50 border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-blue-500/10">
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <CardTitle className="text-base">Referral Network</CardTitle>
          {hasReferrals && (
            <Badge variant="secondary" className="text-xs">
              {referralData.totalCount} Total
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {hasReferrals ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">
                  {referralData.level1Count}
                </div>
                <div className="text-xs text-muted-foreground">Level 1</div>
                <div className="text-xs text-green-600 font-medium">5%</div>
              </div>
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">
                  {referralData.level2Count}
                </div>
                <div className="text-xs text-muted-foreground">Level 2</div>
                <div className="text-xs text-green-600 font-medium">3%</div>
              </div>
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">
                  {referralData.level3Count}
                </div>
                <div className="text-xs text-muted-foreground">Level 3</div>
                <div className="text-xs text-green-600 font-medium">2%</div>
              </div>
            </div>

            {/* Expandable Level Details */}
            <div className="space-y-2">
              {[1, 2, 3].map((level) => {
                const count = level === 1 ? referralData.level1Count : 
                             level === 2 ? referralData.level2Count : 
                             referralData.level3Count;
                const referrals = level === 1 ? referralData.level1Referrals :
                                 level === 2 ? referralData.level2Referrals :
                                 referralData.level3Referrals;
                const isExpanded = expandedLevels.has(level);

                if (count === 0) return null;

                return (
                  <div key={level} className="border border-border/30 rounded-lg">
                    <Button
                      onClick={() => toggleLevel(level)}
                      variant="ghost"
                      className="w-full justify-between p-3 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Level {level} Referrals
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {count}
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-1">
                        {referrals.slice(0, 10).map((address, index) => (
                          <div
                            key={address}
                            className="flex items-center justify-between p-2 bg-background/40 rounded text-xs"
                          >
                            <span className="font-mono">{formatAddress(address)}</span>
                            <Button
                              onClick={() => openInExplorer(address)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        {referrals.length > 10 && (
                          <div className="text-center py-2">
                            <span className="text-xs text-muted-foreground">
                              +{referrals.length - 10} more referrals
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              No referrals yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              Share your referral link to start building your network
            </p>
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={loadReferralData}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}