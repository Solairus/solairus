import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, RefreshCw, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { AffiliateBackendService } from "@/services/affiliate/affiliate-backend";

interface MyReferralsCardProps {
  userPublicKey: PublicKey;
  referralCount: number;
}

interface ReferralInfo {
  address: string;
  shortAddress: string;
  joinedDate?: Date;
}

export default function MyReferralsCard({ userPublicKey, referralCount }: MyReferralsCardProps) {
  const { account } = useWalletConnection();
  const [referrals, setReferrals] = useState<ReferralInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    if (!account) return;

    try {
      setIsLoading(true);
      setError(null);

      const pubkeys = await AffiliateBackendService.getReferrals();
      const referralInfos: ReferralInfo[] = pubkeys.map((addr) => ({
        address: addr,
        shortAddress: `${addr.slice(0, 4)}...${addr.slice(-4)}`,
      }));

      setReferrals(referralInfos);
      console.log(`✅ Loaded ${referralInfos.length} referrals`);
    } catch (err) {
      console.error('Failed to load referrals:', err);
      setError('Failed to load referral list');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  // Auto-load referrals on initial mount or when wallet/account becomes available
  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      toast.success("Address copied to clipboard");
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      toast.error("Failed to copy address");
    }
  };

  const getEffectiveCluster = (): 'mainnet-beta' | 'devnet' | 'testnet' => {
    // Detect from UI override first, then environment variable
    const override = (() => {
      try { return (localStorage.getItem('solana_cluster_override') ?? '').toLowerCase(); } catch { return ''; }
    })();
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet').toLowerCase();
    const effective = override || envCluster;
    if (effective.startsWith('mainnet')) return 'mainnet-beta';
    if (effective === 'testnet') return 'testnet';
    return 'devnet';
  };

  const openInExplorer = (address: string) => {
    const cluster = getEffectiveCluster();
    const base = `https://explorer.solana.com/address/${address}`;
    const url = cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`;
    window.open(url, '_blank');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <CardTitle className="text-sm">My Referrals</CardTitle>
          </div>
          <Button
            onClick={loadReferrals}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-xs">Load</span>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error State */}
        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button onClick={loadReferrals} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-6">
            <RefreshCw className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2 animate-spin" />
            <p className="text-xs text-muted-foreground">Loading referrals...</p>
          </div>
        )}

        {/* Referral List */}
        {!isLoading && !error && referrals.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Referral List</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {referrals.map((referral, index) => (
                <div key={referral.address} className="flex items-center justify-between p-3 bg-background/40 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-purple-600">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium font-mono">
                        {formatAddress(referral.address)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Referral #{index + 1}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleCopyAddress(referral.address)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      {copiedAddress === referral.address ? (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      onClick={() => openInExplorer(referral.address)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && referrals.length === 0 && referralCount === 0 && (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No referrals yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Share your referral link to start earning
            </p>
          </div>
        )}

        {/* Loaded but empty */}
        {!isLoading && !error && referrals.length === 0 && referralCount > 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              Click "Load" to view your {referralCount} referrals
            </p>
          </div>
        )}

        {/* Referral Benefits */}
        {referralCount > 0 && (
          <>
            <Separator />
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
              <h5 className="text-xs font-medium text-purple-600 mb-2">💡 Referral Benefits</h5>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>5%</strong> commission on license activations</li>
                <li>• <strong>3%</strong> on their referrals (Level 2)</li>
                <li>• <strong>2%</strong> on Level 3 referrals</li>
                <li>• Passive income from their agent activities</li>
              </ul>
            </div>
          </>
        )}

        {/* Quick Actions */}
        {referralCount > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => window.open('/dapp/affiliate', '_self')}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
            >
              Share Link
            </Button>
            <Button
              onClick={loadReferrals}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh List'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}