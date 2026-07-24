import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  TrendingUp,
  ArrowUpFromLine,
  ArrowDownToLine,
  Users,
  Bot,
  Landmark,
  PenLine,
} from 'lucide-react';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { useToast } from '@/hooks/use-toast';

// All amounts arrive as micro-USDT strings (6 decimals); the client divides by 1e6.
interface AdminStats {
  deposited: { deposit: string; agent: string; license: string; total: string };
  adminCredits: { gross: string; debit: string; net: string };
  manual: { agentActivations: string; deposits: string };
  userCashout: string;
  bucketCashout: string;
  affiliateEarnings: string;
  agentYield: { total: string; real: string; manual: string };
  treasury: string | null;
}

const usd = (micro: string | null | undefined): string => {
  if (micro == null) return '—';
  const v = Number(micro) / 1_000_000;
  if (!isFinite(v)) return '—';
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function SystemKpiBoard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const baseUrl = API_CONFIG.getBaseUrl();
      const res = await ApiClient.get(`${baseUrl}/admin/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (error) {
      console.error('Error loading system stats:', error);
      toast({ title: 'Error', description: 'Failed to load system KPIs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiles = [
    {
      key: 'deposited',
      label: 'Total Deposited (Blockchain)',
      value: usd(stats?.deposited.total),
      sub: stats ? `Real on-chain · Deposits ${usd(stats.deposited.deposit)} · Agents ${usd(stats.deposited.agent)}` : '',
      icon: TrendingUp,
      accent: 'text-green-400 bg-green-500/10',
    },
    {
      key: 'adminCredits',
      label: 'Admin Manual Deposits',
      value: usd(stats?.adminCredits.net),
      sub: 'Credited to user balances — NOT on-chain',
      icon: PenLine,
      accent: 'text-rose-400 bg-rose-500/10',
    },
    {
      key: 'manualAgents',
      label: 'Manual Agent Activations',
      value: usd(stats?.manual.agentActivations),
      sub: 'Admin-activated from credits — NOT on-chain',
      icon: PenLine,
      accent: 'text-rose-400 bg-rose-500/10',
    },
    {
      key: 'yield',
      label: 'Total Agent Yield',
      value: usd(stats?.agentYield.total),
      sub: stats ? `Real ${usd(stats.agentYield.real)} · Manual ${usd(stats.agentYield.manual)}` : '',
      icon: Bot,
      accent: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      key: 'affiliate',
      label: 'Total Earnings (Affiliate)',
      value: usd(stats?.affiliateEarnings),
      sub: "Users' referral commissions",
      icon: Users,
      accent: 'text-indigo-400 bg-indigo-500/10',
    },
    {
      key: 'userCashout',
      label: 'Total Cashout (Users)',
      value: usd(stats?.userCashout),
      sub: 'User withdrawals paid out',
      icon: ArrowUpFromLine,
      accent: 'text-amber-400 bg-amber-500/10',
    },
    {
      key: 'bucketCashout',
      label: 'Total Bucket Cashout',
      value: usd(stats?.bucketCashout),
      sub: 'Role/bucket withdrawals',
      icon: ArrowDownToLine,
      accent: 'text-orange-400 bg-orange-500/10',
    },
    {
      key: 'treasury',
      label: 'Treasury Balance',
      value: usd(stats?.treasury),
      sub: stats?.treasury == null ? 'Live · unavailable' : 'Live on-chain USDT',
      icon: Landmark,
      accent: 'text-blue-400 bg-blue-500/10',
    },
  ];

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            System KPIs
          </CardTitle>
          <Button
            onClick={load}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-gray-400 text-sm">Platform-wide financial audit board (read-only).</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.key} className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-full ${t.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm text-gray-400">{t.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{loading ? '…' : t.value}</p>
                {t.sub && <p className="text-xs text-gray-500 mt-1">{t.sub}</p>}
              </div>
            );
          })}
        </div>
        {stats && Number(stats.deposited.license) > 0 && (
          <p className="text-xs text-gray-500 mt-4">
            License fees collected (separate from deposits): {usd(stats.deposited.license)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
