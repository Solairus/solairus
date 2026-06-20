import { useWallet } from '@/contexts/wallet-context';
import { AgentDashboard } from '@/components/agent/AgentDashboard';
import WalletGate from '@/components/WalletGate';
import { Card } from '@/components/Card';
import { Bot } from 'lucide-react';
import { DebugModeIndicator } from '@/utils/debug-mode-indicator';
import BackButton from '@/components/ui/BackButton';

/**
 * My Agents (Portfolio)
 * Purpose: Show the user's active AI trading agents and allow navigation to hire.
 * Inputs: Wallet context provides `publicKey` and `provider`.
 * Outputs: Renders `AgentDashboard` or a prompt to connect wallet.
 * Notes: Mobile container aligned with other /dapp pages.
 */
export default function DappHistory() {
  const { publicKey, provider } = useWallet();

  return (
    <WalletGate>
      {/* Mobile-app-like fixed width container - consistent with other /dapp pages */}
      <div className="max-w-sm mx-auto space-y-4">
        {/* Back Button */}
        <div className="flex items-center justify-start">
          <BackButton to="/dapp" />
        </div>
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">Agent Portfolio</h1>
            <p className="text-xs text-muted-foreground">
              View and manage your active AI trading agents
            </p>
          </div>
          
          {/* Debug Mode Indicator */}
          {provider && (
            <DebugModeIndicator connection={provider} className="mt-2" />
          )}
        </div>

        {/* Agent Portfolio (render AgentDashboard; now DB-only data source) */}
        {publicKey && provider ? (
          <AgentDashboard
            userPublicKey={publicKey}
            connection={provider}
            showActivationModal={false}
            onActivateAgent={() => { window.location.href = '/dapp/hire'; }}
          />
        ) : (
          <Card title="Agent Portfolio" subtitle="Connect your wallet to view your agents">
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                Please connect your wallet to view your AI trading agents.
              </p>
            </div>
          </Card>
        )}

      </div>
    </WalletGate>
  );
}