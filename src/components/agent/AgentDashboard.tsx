import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AgentData, GetUserAgentsOptions } from '@/services/agent/agent-service';
import { fetchUserAgentActivations, type BackendAgentActivation } from '@/services/agent/agent-backend';
import type { WithdrawalLimitDisplay } from '@/services/agent/withdrawal-limit-service';
import { fetchGlobalPnlSummary } from '@/services/agent/pnl-backend';
import { AgentCard } from './AgentCard';
import { WithdrawalLimitDisplay as WithdrawalLimitDisplayComponent } from './WithdrawalLimitDisplay';
import { AgentActivationModal } from './AgentActivationModal';
import { MultiAgentTimer } from './WithdrawalTimer';
import { calculateNextWithdrawalTime } from '@/services/agent/contract-timing-service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';
import { Loader2, Plus, RefreshCw } from 'lucide-react';

// Local UI tier config (DB-only view; avoids contract module dependency)
type TierUIConfig = {
  name: string;
  emoji: string;
  description: string;
  dailyRange: string;
  yieldCapPct: number;
};

const UI_TIER_CONFIGS: Record<string, TierUIConfig> = {
  NOVA: {
    name: 'NOVA',
    emoji: '🪶',
    description: 'Entry tier with stable daily yields',
    dailyRange: '1.25% - 1.75%',
    yieldCapPct: 200,
  },
  VEGA: {
    name: 'VEGA',
    emoji: '🔮',
    description: 'Balanced risk and return',
    dailyRange: '1.75% - 2.15%',
    yieldCapPct: 200,
  },
  ORION: {
    name: 'ORION',
    emoji: '⚡',
    description: 'Higher yields with moderate risk',
    dailyRange: '2.15% - 2.75%',
    yieldCapPct: 200,
  },
  PRIME: {
    name: 'PRIME',
    emoji: '🧠',
    description: 'Elite tier with top yields',
    dailyRange: '2.75% - 3.25%',
    yieldCapPct: 200,
  },
};

function getTierUIConfig(tierName: string): TierUIConfig {
  return UI_TIER_CONFIGS[tierName] ?? UI_TIER_CONFIGS.NOVA;
}

function calculateYieldCapProgressLocal(
  _tier: string | number,
  _activationAmount: number,
  _totalRoiWithdrawn: number
): number {
  // DB-only dashboard does not compute on-chain yield progress
  return 0;
}

// DB-only placeholder for the withdrawal summary banner
const DEFAULT_WITHDRAWAL_DISPLAY: WithdrawalLimitDisplay = {
  totalDeposits: '—',
  totalWithdrawn: '—',
  maxWithdrawable: '—',
  remainingWithdrawable: '—',
  usagePercentage: 0,
  limitReached: false,
  isPrivileged: false,
  warningLevel: 'none',
  statusMessage: ''
};

interface AgentDashboardProps {
  userPublicKey: PublicKey;
  connection: Connection;
  anchorProvider?: anchor.AnchorProvider; // Add optional anchor provider
  onActivateAgent?: () => void;
  showActivationModal?: boolean; // New prop to control built-in modal
}

interface AgentDashboardState {
  agents: AgentData[];
  totalCount: number;
  hasMore: boolean;
  withdrawalLimitStatus: WithdrawalLimitDisplay | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ 
  userPublicKey, 
  connection,
  anchorProvider,
  onActivateAgent,
  showActivationModal = true
}) => {
  const [state, setState] = useState<AgentDashboardState>({
    agents: [],
    totalCount: 0,
    hasMore: false,
    withdrawalLimitStatus: DEFAULT_WITHDRAWAL_DISPLAY,
    loading: true,
    error: null,
    refreshing: false,
  });

  const [sortBy, setSortBy] = useState<GetUserAgentsOptions['sortBy']>('activatedAt');
  const [sortOrder, setSortOrder] = useState<GetUserAgentsOptions['sortOrder']>('desc');
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

  // Load agents (DB-only) and omit RPC calls to keep it fast
  const loadDashboardData = useCallback(async (refresh = false) => {
    if (refresh) {
      setState(prev => ({ ...prev, refreshing: true, error: null }));
    } else {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      // 1) Fetch from backend
      const backendRows = await fetchUserAgentActivations(userPublicKey.toBase58());

      // 2) Map backend rows to AgentData without any on-chain dependencies
      const mappedAgents: AgentData[] = await Promise.all(backendRows.map(async (row: BackendAgentActivation): Promise<AgentData> => {
        const tierName = (row.metadata?.tier_name ?? 'NOVA'); // default safe tier
        const tierConfig = getTierUIConfig(tierName);
        const activationAmountUsdt = row.amount ?? 0; // already normalized to USDT by backend
        const ts = row.activated_at ?? row.created_at;
        let activatedAt = ts ? new Date(ts) : new Date(row.created_at);
        // Guard against future timestamps from backend; clamp to 'now' to preserve UX
        const now = Date.now();
        if (activatedAt.getTime() > now) {
          const createdAt = new Date(row.created_at);
          activatedAt = createdAt.getTime() > now ? new Date(now) : createdAt;
        }

        // Withdrawal totals and progress from backend, with safe fallbacks
        const totalRoiWithdrawn = row.total_earned ?? 0;
        const capBp = row.reward_cap_bp ?? 20000; // default 200%
        const capPct = capBp / 100;
        const computedProgress = activationAmountUsdt > 0
          ? Math.min(((totalRoiWithdrawn / activationAmountUsdt) * 100), capPct)
          : 0;
        const yieldCapProgress = row.yield_cap_progress_pct ?? computedProgress;
        const yieldCapReached = row.yield_cap_reached ?? (yieldCapProgress >= capPct);
        type AccountDataStub = {
          id?: anchor.BN;
          principalUsdt?: anchor.BN;
          startedAt?: anchor.BN;
        };

        const accountData: AccountDataStub = {
          id: new anchor.BN(row.id),
          principalUsdt: new anchor.BN(row.amount ?? 0),
          startedAt: new anchor.BN(Math.floor(activatedAt.getTime() / 1000)),
        };

        // Compute timing window using contract timing service (60s override supported)
        const nextTime = await calculateNextWithdrawalTime(connection, activatedAt, null);
        const canWithdraw = !nextTime && !yieldCapReached && activationAmountUsdt > 0;

        return {
          activationId: row.id,
          tier: tierName as unknown as AgentData['tier'],
          tierConfig: {
            name: tierConfig.name,
            emoji: tierConfig.emoji,
            description: tierConfig.description,
            dailyRange: tierConfig.dailyRange,
            // Use backend cap if provided; fallback to UI config
            yieldCapPct: capPct || tierConfig.yieldCapPct,
          },
          activationAmount: activationAmountUsdt,
          activatedAt,
          lastRoiWithdrawal: null,
          totalRoiWithdrawn,
          yieldCapReached,
          yieldCapProgress,
          canWithdraw,
          nextWithdrawalAt: nextTime ?? null,
          withdrawalStatus: { canWithdraw },
          // Provide safe placeholders for PDA/account data; not used in DB-only view
          pda: new PublicKey('11111111111111111111111111111111'),
          accountData: accountData as unknown as AgentData['accountData'],
        };
      }));

      // 3) Client-side sort to respect existing UI controls
      mappedAgents.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'activatedAt':
            comparison = a.activatedAt.getTime() - b.activatedAt.getTime();
            break;
          case 'tier':
            comparison = (a.tier as string).localeCompare(b.tier as string);
            break;
          case 'activationAmount':
            comparison = a.activationAmount - b.activationAmount;
            break;
          default:
            comparison = a.activatedAt.getTime() - b.activatedAt.getTime();
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      const totalCount = mappedAgents.length;
      const hasMore = false;

      // 4) Fetch backend-computed PnL summary for the banner
      let banner: WithdrawalLimitDisplay = DEFAULT_WITHDRAWAL_DISPLAY;
      try {
        banner = await fetchGlobalPnlSummary();
      } catch (e) {
        console.warn('⚠️ Failed to load PnL summary; using defaults', e);
      }

      setState(prev => ({
        ...prev,
        agents: mappedAgents,
        totalCount,
        hasMore,
        withdrawalLimitStatus: banner,
        loading: false,
        refreshing: false,
        error: null,
      }));
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      }));
    }
  }, [userPublicKey, sortBy, sortOrder]);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle agent ROI withdrawal
  const handleAgentWithdrawal = async (activationId: number): Promise<void> => {
    try {
      console.log('🚀 Starting ROI withdrawal for agent:', activationId);
      
      if (!anchorProvider) {
        throw new Error('Anchor provider not available. Please ensure your wallet is properly connected.');
      }
      
      // Import the withdrawal service dynamically to avoid circular dependencies
      const { withdrawAgentRoi } = await import('@/services/agent/agent-roi-service');
      
      // Execute ROI withdrawal
      const result = await withdrawAgentRoi(anchorProvider, activationId);
      
      console.log('✅ ROI withdrawal successful:', result);
      
      // Refresh the dashboard to show updated data
      await loadDashboardData(true);
    } catch (error) {
      console.error('❌ Error withdrawing agent ROI:', error);
      throw error; // Re-throw so AgentCard can handle the error display
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadDashboardData(true);
  };

  // Handle sort change
  const handleSortChange = (newSortBy: GetUserAgentsOptions['sortBy']) => {
    if (newSortBy === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Handle agent activation
  const handleActivateAgent = () => {
    if (showActivationModal) {
      setIsActivationModalOpen(true);
    } else if (onActivateAgent) {
      onActivateAgent();
    }
  };

  // Handle activation success
  const handleActivationSuccess = () => {
    setIsActivationModalOpen(false);
    // Refresh the dashboard to show the new agent
    loadDashboardData(true);
  };

  // Render loading state
  if (state.loading) {
    return (
      <Card title="Agent Portfolio" subtitle="Loading your AI trading agents...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <Card title="Agent Portfolio" subtitle="Error loading your agents">
        <div className="text-center py-8">
          <p className="text-destructive mb-4">{state.error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // Render empty state
  if (state.agents.length === 0) {
    return (
      <div className="space-y-4">
        {/* Withdrawal Limit Status */}
        {state.withdrawalLimitStatus && (
          <WithdrawalLimitDisplayComponent status={state.withdrawalLimitStatus} />
        )}
        {/* Empty State */}
        <Card title="Agent Portfolio" subtitle="Start building your AI trading portfolio">
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Agents Yet</h3>
              <p className="text-muted-foreground mb-6">
                Activate your first AI trading agent to start earning daily ROI
              </p>
            </div>
            
            <Button onClick={handleActivateAgent} className="mb-4">
              <Plus className="h-4 w-4 mr-2" />
              Activate First Agent
            </Button>
            
            <div className="text-xs text-muted-foreground">
              <p>Choose from 4 agent tiers with different yield ranges:</p>
              <p>🪶 NOVA • 🔮 VEGA • ⚡ ORION • 🧠 PRIME</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Render agent portfolio
  return (
    <div className="space-y-4">
      {/* Withdrawal Limit Status */}
      {/* Show PnL banner only if user has at least one activated agent */}
      {state.totalCount > 0 && state.withdrawalLimitStatus && (
        <WithdrawalLimitDisplayComponent status={state.withdrawalLimitStatus} />
      )}
      {/* Multi-Agent Timer Overview */}
      {state.agents.length > 0 && (
        <MultiAgentTimer agents={state.agents} connection={connection} />
      )}
      
      {/* Portfolio Header */}
      <Card 
        title="Agent Portfolio" 
        subtitle={`${state.totalCount} agent${state.totalCount !== 1 ? 's' : ''} activated`}
      >
        <div className="flex items-center justify-between mb-4">
          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <div className="flex gap-1">
              <Button
                variant={sortBy === 'activatedAt' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortChange('activatedAt')}
                className="text-xs"
              >
                Date {sortBy === 'activatedAt' && (sortOrder === 'desc' ? '↓' : '↑')}
              </Button>
              <Button
                variant={sortBy === 'tier' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortChange('tier')}
                className="text-xs"
              >
                Tier {sortBy === 'tier' && (sortOrder === 'desc' ? '↓' : '↑')}
              </Button>
              <Button
                variant={sortBy === 'activationAmount' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortChange('activationAmount')}
                className="text-xs"
              >
                Amount {sortBy === 'activationAmount' && (sortOrder === 'desc' ? '↓' : '↑')}
              </Button>
            </div>
          </div>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={state.refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${state.refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Agent Grid - Mobile-app-like single column layout */}
        <div className="space-y-3">
          {state.agents.map((agent) => (
            <AgentCard
              key={`${agent.activationId}-${agent.pda.toString()}`}
              agent={agent}
              connection={connection}
              onWithdraw={handleAgentWithdrawal}
            />
          ))}
        </div>

        {/* Load More / Pagination Info */}
        {state.hasMore && (
          <div className="text-center mt-6">
            <p className="text-xs text-muted-foreground">
              Showing {state.agents.length} of {state.totalCount} agents
            </p>
            <Button variant="outline" size="sm" className="mt-2">
              Load More
            </Button>
          </div>
        )}

        {/* Add Agent Button */}
        <div className="text-center mt-6 pt-4 border-t border-border/50">
          <Button onClick={handleActivateAgent} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Activate Another Agent
          </Button>
        </div>
      </Card>

      {/* Agent Activation Modal */}
      {showActivationModal && (
        <AgentActivationModal
          isOpen={isActivationModalOpen}
          onClose={() => setIsActivationModalOpen(false)}
          userPublicKey={userPublicKey}
          connection={connection}
          onSuccess={handleActivationSuccess}
        />
      )}
    </div>
  );
};