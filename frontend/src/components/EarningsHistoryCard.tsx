import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Calendar, ExternalLink, RefreshCw } from "lucide-react";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useWallet } from "@/contexts/wallet-context";
import { PublicKey } from "@solana/web3.js";
import { 
  getEarningsHistory, 
  getEarningsSummary,
  EarningsHistoryItem,
  formatUsdtAmount 
} from "@/services/affiliate/earnings-history-service";

interface EarningsHistoryCardProps {
  userPublicKey: PublicKey;
}

export default function EarningsHistoryCard({ userPublicKey }: EarningsHistoryCardProps) {
  const { account } = useWalletConnection();
  const { anchorProvider } = useWallet();
  const [historyItems, setHistoryItems] = useState<EarningsHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalWithdrawals: 0,
    lastWithdrawal: null as Date | null,
    averageWithdrawal: 0
  });

  const loadEarningsHistory = useCallback(async () => {
    if (!anchorProvider?.connection) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch earnings history and summary
      const [history, summaryData] = await Promise.all([
        getEarningsHistory(anchorProvider.connection, userPublicKey, 10),
        getEarningsSummary(anchorProvider.connection, userPublicKey)
      ]);

      setHistoryItems(history.items);
      setSummary(summaryData);

    } catch (err) {
      console.error('Failed to load earnings history:', err);
      setError('Failed to load withdrawal history');
    } finally {
      setIsLoading(false);
    }
  }, [anchorProvider, userPublicKey]);

  useEffect(() => {
    // Only load on explicit user request to avoid aggressive RPC calls
    // User can click refresh button to load data
  }, []);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openTransaction = (signature: string) => {
    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <CardTitle className="text-sm">Withdrawal History</CardTitle>
          </div>
          <Button
            onClick={loadEarningsHistory}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-xs">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats - Only show if there are actual withdrawals */}
        {!isLoading && !error && summary.totalWithdrawals > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background/60 rounded-lg p-2 text-center">
                <div className="text-sm font-semibold">{summary.totalWithdrawals}</div>
                <div className="text-xs text-muted-foreground">Withdrawals</div>
              </div>
              <div className="bg-background/60 rounded-lg p-2 text-center">
                <div className="text-sm font-semibold">${summary.averageWithdrawal.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div className="bg-background/60 rounded-lg p-2 text-center">
                <div className="text-sm font-semibold">
                  {summary.lastWithdrawal ? formatDate(summary.lastWithdrawal).split(',')[0] : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Last</div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button onClick={loadEarningsHistory} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-6">
            <RefreshCw className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2 animate-spin" />
            <p className="text-xs text-muted-foreground">Loading withdrawal history...</p>
          </div>
        )}

        {/* History Items */}
        {!isLoading && !error && historyItems.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Recent Withdrawals</h4>
            {historyItems.map((item, index) => (
              <div key={`${item.signature}-${index}`} className="flex items-center justify-between p-3 bg-background/40 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full bg-green-500/10">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">${formatUsdtAmount(item.amount)}</span>
                      <Badge variant="outline" className="text-xs">
                        Withdrawal
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.timestamp)}
                    </div>
                  </div>
                </div>
                {item.signature.startsWith('profile-') ? (
                  <div className="h-8 w-8 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">•••</span>
                  </div>
                ) : (
                  <Button
                    onClick={() => openTransaction(item.signature)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && historyItems.length === 0 && (
          <div className="text-center py-6">
            <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No withdrawal history available
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Withdrawal transactions will appear here
            </p>
            <Button 
              onClick={loadEarningsHistory}
              variant="outline" 
              size="sm"
              className="mt-3"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Check Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}