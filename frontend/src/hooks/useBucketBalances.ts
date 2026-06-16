import { useState, useEffect, useCallback } from 'react';
import { ApiClient, BUCKET_ENDPOINTS } from '@/config/service-endpoints';

export type BucketType = 'admin' | 'dev' | 'marketer1' | 'marketer2' | 'trader' | 'reserve';

export interface BucketBalances {
  admin: number;
  dev: number;
  marketer1: number;
  marketer2: number;
  trader: number;
  reserve: number;
}

export interface UseBucketBalancesReturn {
  balances: BucketBalances | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBucketBalances(): UseBucketBalancesReturn {
  const [balances, setBalances] = useState<BucketBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const url = BUCKET_ENDPOINTS.buildUrl(BUCKET_ENDPOINTS.getAdminBuckets);
      const response = await ApiClient.get(url);
      const bucketData = await response.json();

      const bucketBalances: BucketBalances = {
        admin: Number(bucketData.admin || 0),
        dev: Number(bucketData.dev || 0),
        marketer1: Number(bucketData.marketer1 || 0),
        marketer2: Number(bucketData.marketer2 || 0),
        trader: Number(bucketData.trader || 0),
        reserve: Number(bucketData.reserve || 0),
      };

      setBalances(bucketBalances);
    } catch (err) {
      console.error('Error fetching bucket balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bucket balances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // DISABLED: Auto-refresh to prevent rate limits
  // Users can manually refresh if needed
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     if (!loading) {
  //       fetchBalances();
  //     }
  //   }, 30000);
  //   return () => clearInterval(interval);
  // }, [fetchBalances, loading]);

  return {
    balances,
    loading,
    error,
    refresh: fetchBalances,
  };
}