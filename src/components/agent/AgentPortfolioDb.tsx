import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';
import { fetchUserAgentActivations, type BackendAgentActivation } from '@/services/agent/agent-backend';
import { useToast } from '@/hooks/use-toast';
import { Bot, RefreshCw, Plus } from 'lucide-react';

/**
 * AgentPortfolioDb
 * Purpose: Fast portfolio list that reads activated agents from backend DB only.
 * Inputs: `walletAddress` base58 string of the connected wallet.
 * Outputs: Renders tier, amount (USDT), and activation timestamp per agent.
 * Notes: No on-chain reads; intended to replace slow RPC scans on /dapp/my-agents.
 */
export const AgentPortfolioDb: React.FC<{ walletAddress: string; onActivateAgent?: () => void }> = ({ walletAddress, onActivateAgent }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BackendAgentActivation[]>([]);

  const load = async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const data = await fetchUserAgentActivations(walletAddress);
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: 'Failed to load agents', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(false); }, [walletAddress]);

  const formatUsdt = (micro: number) => (Math.floor(micro) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <Card title="Agent Portfolio" subtitle="Your activated AI trading agents (DB)">
      <div className="space-y-3">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">{rows.length} agents</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="py-10 text-center text-xs text-muted-foreground">Loading your AI trading agents…</div>
        )}
        {error && (
          <div className="py-4 text-xs text-destructive">{error}</div>
        )}

        {/* Empty State */}
        {!loading && !error && rows.length === 0 && (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No activated agents found.</p>
            <Button onClick={onActivateAgent} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" /> Activate Agent
            </Button>
          </div>
        )}

        {/* List */}
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="glass rounded-md p-3 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {row.metadata?.tier_name ?? 'Agent'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Activated: {formatDate(row.created_at)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{formatUsdt(row.amount)} USDT</div>
                {row.signature && (
                  <div className="text-[10px] text-muted-foreground">Sig: {row.signature.slice(0, 6)}…{row.signature.slice(-6)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};