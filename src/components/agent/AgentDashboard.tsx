import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AgentData, getUserAgents, GetUserAgentsOptions, GetUserAgentsResult } from '@/services/agent/agent-service';
import { WithdrawalLimitDisplay, getWithdrawalLimitDisplay } from '@/services/agent/withdrawal-limit-service';
import { getCurrentRpcConnection, shouldSwitchRpc, switchRpcEndpoint } from '@/utils/rpc-connection-manager';
import { AgentCard } from './AgentCard';
import { WithdrawalLimitDisplay as WithdrawalLimitDisplayComponent } from './WithdrawalLimitDisplay';
import { AgentActivationModal } from './AgentActivationModal';
import { MultiAgentTimer } from './WithdrawalTimer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';
import { Loader2, Plus, RefreshCw } from 'lucide-react';

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
    withdrawalLimitStatus: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const [sortBy, setSortBy] = useState<GetUserAgentsOptions['sortBy']>('activatedAt');
  const [sortOrder, setSortOrder] = useState<GetUserAgentsOptions['sortOrder']>('desc');
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

  // Load agents and withdrawal limit status
  const loadDashboardData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setState(prev => ({ ...prev, refreshing: true, error: null }));
      } else {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      // Get current RPC connection (no retries, just use what's available)
      let currentConnection = getCurrentRpcConnection();

      try {
        // Load agents and withdrawal limit status in parallel
        const [agentsResult, withdrawalStatus] = await Promise.all([
          getUserAgents(currentConnection, userPublicKey, {
            limit: 50,
            offset: 0,
            sortBy,
            sortOrder,
          }),
          getWithdrawalLimitDisplay(currentConnection, userPublicKey),
        ]);

        setState(prev => ({
          ...prev,
          agents: agentsResult.agents,
          totalCount: agentsResult.totalCount,
          hasMore: agentsResult.hasMore,
          withdrawalLimitStatus: withdrawalStatus,
          loading: false,
          refreshing: false,
          error: null,
        }));
      } catch (rpcError) {
        // If RPC error, switch endpoint and show user-friendly message
        if (shouldSwitchRpc(rpcError)) {
          console.log('🔄 RPC error detected, switching endpoint for next request');
          switchRpcEndpoint(); // Switch for next time, don't retry now
          
          setState(prev => ({
            ...prev,
            loading: false,
            refreshing: false,
            error: 'RPC endpoint issue detected. Please try again - we\'ve switched to a different server.',
          }));
        } else {
          throw rpcError; // Let other errors bubble up
        }
      }
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
      {state.withdrawalLimitStatus && (
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