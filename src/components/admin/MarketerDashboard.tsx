import React from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useBucketBalances } from '@/hooks/useBucketBalances';
import { BucketCard } from './BucketCard';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Wallet, 
  Shield, 
  TrendingUp,
  Info
} from 'lucide-react';

/**
 * Marketer-specific dashboard component with restricted access
 * Shows only marketer's own bucket balance and withdrawal functionality
 */
export const MarketerDashboard: React.FC = () => {
  try {
    const { publicKey } = useWallet();
  // Simple marketer detection
  const isMarketer1 = publicKey?.toString() === import.meta.env.VITE_MARKETER1_ADDRESS;
  const isMarketer2 = publicKey?.toString() === import.meta.env.VITE_MARKETER2_ADDRESS;
  const isMarketer = isMarketer1 || isMarketer2;
  const role = isMarketer1 ? 'marketer1' : isMarketer2 ? 'marketer2' : null;

  console.log('MarketerDashboard: Checking marketer authorization:', {
    connectedAddress: publicKey?.toString(),
    marketer1Address: import.meta.env.VITE_MARKETER1_ADDRESS,
    marketer2Address: import.meta.env.VITE_MARKETER2_ADDRESS,
    isMarketer1,
    isMarketer2,
    isMarketer,
    role
  });

  const { balances, loading, error, refresh } = useBucketBalances();

  // Ensure this component is only rendered for marketers
  if (!publicKey || !isMarketer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6 bg-gray-800 border-gray-700 border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 text-red-400">
            <Shield className="h-5 w-5" />
            <span className="font-medium">Access Denied</span>
          </div>
          <p className="text-gray-300 mt-2">
            This interface is restricted to marketer accounts only.
          </p>
        </Card>
      </div>
    );
  }

  const marketerBucketType = role as 'marketer1' | 'marketer2'; // 'marketer1' or 'marketer2'
  const marketerBalance = balances?.[marketerBucketType];

  const getMarketerDisplayName = () => {
    return role === 'marketer1' ? 'Marketer 1' : 'Marketer 2';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-8 w-8 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">{getMarketerDisplayName()} Dashboard</h1>
            <p className="text-gray-400">Loading your earnings...</p>
          </div>
        </div>
        
        <div className="animate-pulse">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <div className="h-32 bg-gray-700 rounded"></div>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-8 w-8 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">{getMarketerDisplayName()} Dashboard</h1>
            <p className="text-gray-400">Manage your earnings</p>
          </div>
        </div>
        
        <Card className="p-6 bg-gray-800 border-gray-700 border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 text-red-400 mb-3">
            <Info className="h-5 w-5" />
            <span className="font-medium">Error Loading Data</span>
          </div>
          <p className="text-gray-300 mb-4">
            Failed to load bucket balance information.
          </p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-8 w-8 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">{getMarketerDisplayName()} Dashboard</h1>
          <p className="text-gray-400">Manage your marketing earnings</p>
        </div>
      </div>

      {/* Role Information Card */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Account Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Role:</span>
            <Badge variant="secondary" className="capitalize bg-green-500/10 text-green-400 border-green-500/20">
              {getMarketerDisplayName()}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Access Level:</span>
            <Badge variant="outline" className="text-yellow-400 border-yellow-500/20">
              Earnings Only
            </Badge>
          </div>
        </div>
      </Card>

      {/* Earnings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-green-400" />
          <h2 className="text-xl font-semibold text-white">Your Earnings</h2>
        </div>
        
        <div className="grid grid-cols-1 max-w-md">
          <BucketCard
            bucketType={marketerBucketType}
            balance={marketerBalance}
            canWithdraw={true}
            onWithdrawSuccess={refresh}
          />
        </div>
      </div>

      {/* Information Card */}
      <Card className="p-6 bg-gray-800 border-gray-700 border-l-4 border-l-blue-500">
        <div className="flex items-center gap-3 mb-3">
          <Info className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-medium text-white">Marketer Interface</h3>
        </div>
        <div className="space-y-3 text-gray-300">
          <p>
            Welcome to your marketer dashboard. This interface provides access to your earnings only.
          </p>
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <h4 className="font-medium text-white mb-2">Available Features:</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                View your current earnings balance
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                Withdraw funds from your earnings bucket
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                Real-time balance updates
              </li>
            </ul>
          </div>
          <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20">
            <p className="text-yellow-400 text-sm">
              <strong>Note:</strong> As a marketer, you only have access to your own earnings bucket. 
              Other administrative functions are not available in this interface.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
  } catch (error) {
    console.error('Error in MarketerDashboard:', error);
    return (
      <div className="text-center py-8">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 max-w-md mx-auto">
          <h3 className="text-red-400 font-semibold mb-2">Dashboard Error</h3>
          <p className="text-gray-300 text-sm mb-3">
            There was an error loading the marketer dashboard. Please try refreshing the page.
          </p>
          <p className="text-gray-500 text-xs">
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }
};