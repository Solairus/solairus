import React, { useState } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { AgentDashboard } from './AgentDashboard';
import { TierSelection } from './TierSelection';
import { AgentTier } from '@/types/backend';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';

interface AgentDashboardDemoProps {
  userPublicKey: PublicKey;
  connection: Connection;
}

/**
 * Demo component showing how to integrate the new Agent Dashboard components
 * This demonstrates the complete flow from tier selection to agent management
 */
export const AgentDashboardDemo: React.FC<AgentDashboardDemoProps> = ({
  userPublicKey,
  connection
}) => {
  const [showTierSelection, setShowTierSelection] = useState(false);
  const [selectedTier, setSelectedTier] = useState<AgentTier>();

  const handleActivateAgent = () => {
    setShowTierSelection(true);
  };

  const handleTierSelect = (tier: AgentTier) => {
    setSelectedTier(tier);
  };

  const handleConfirmActivation = () => {
    // TODO: Implement actual agent activation when Task 8 is complete
    console.log('🚧 Agent activation not yet implemented for tier:', selectedTier);

    // For demo purposes, just close the tier selection
    setShowTierSelection(false);
    setSelectedTier(undefined);
  };

  const handleCancelActivation = () => {
    setShowTierSelection(false);
    setSelectedTier(undefined);
  };

  if (showTierSelection) {
    return (
      <div className="space-y-6">
        <Card title="Activate New Agent" subtitle="Choose your agent tier and investment amount">
          <TierSelection
            selectedTierName={selectedTier}
            onTierSelect={(tierName) => handleTierSelect(tierName as AgentTier)}
          />

          {selectedTier !== undefined && (
            <div className="flex gap-3 mt-6 pt-4 border-t border-border/50">
              <Button
                onClick={handleConfirmActivation}
                className="flex-1"
              >
                Continue with {selectedTier !== undefined ? Object.values(AgentTier)[selectedTier] : 'Selected'} Tier
              </Button>
              <Button
                onClick={handleCancelActivation}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <AgentDashboard
      userPublicKey={userPublicKey}
      connection={connection}
      onActivateAgent={handleActivateAgent}
    />
  );
};

// Usage example:
/*
import { AgentDashboardDemo } from '@/components/agent/AgentDashboardDemo';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function MyPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  if (!publicKey) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <AgentDashboardDemo 
      userPublicKey={publicKey}
      connection={connection}
    />
  );
}
*/