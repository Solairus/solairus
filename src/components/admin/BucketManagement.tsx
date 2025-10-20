import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, AlertCircle } from 'lucide-react';
import { BucketCard } from './BucketCard';
import { useBucketBalances, BucketType } from '@/hooks/useBucketBalances';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useWallet } from '@/contexts/wallet-context';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function BucketManagement() {
  const { publicKey } = useWallet();
  const { context: adminContext, hasAccess } = useAdminRole();
  const { balances, loading, error, refresh } = useBucketBalances();

  if (!hasAccess) {
    return (
      <Alert className="bg-red-900/20 border-red-800">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-red-400">
          Access denied. Admin privileges required.
        </AlertDescription>
      </Alert>
    );
  }

  const getAccessibleBuckets = (): BucketType[] => {
    return adminContext.accessibleBuckets as BucketType[];
  };

  const canWithdrawFromBucket = (bucketType: BucketType): boolean => {
    const accessibleBuckets = getAccessibleBuckets();
    return accessibleBuckets.includes(bucketType);
  };

  const getAllBuckets = (): BucketType[] => {
    return ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'];
  };

  const bucketsToShow = adminContext.canViewAllBuckets ? getAllBuckets() : getAccessibleBuckets();

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Bucket Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            <span className="ml-2 text-gray-400">Loading bucket balances...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Bucket Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-900/20 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-400">
              Failed to load bucket balances: {error}
            </AlertDescription>
          </Alert>
          <Button
            onClick={refresh}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!balances) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Bucket Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 py-8">
            No bucket data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="h-6 w-6" />
              Bucket Management
            </CardTitle>
            <Button
              onClick={refresh}
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <p className="text-gray-400 text-sm">
            Manage system bucket balances and withdrawals. 
            {adminContext.canViewAllBuckets 
              ? ' You can view all buckets and withdraw from accessible ones.'
              : ' You can only access your authorized buckets.'
            }
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bucketsToShow.map((bucketType) => (
          <BucketCard
            key={bucketType}
            bucketType={bucketType}
            balance={balances[bucketType]}
            canWithdraw={canWithdrawFromBucket(bucketType)}
            onWithdrawSuccess={refresh}
          />
        ))}
      </div>

      {bucketsToShow.length === 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="py-8">
            <div className="text-center text-gray-400">
              No accessible buckets found for your role.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}