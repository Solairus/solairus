import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '@/config/service-endpoints';

export type BucketType = 'admin' | 'dev' | 'marketer_1' | 'marketer_2' | 'trader' | 'reserve';

export interface BucketBalances {
  admin: number;
  dev: number;
  marketer_1: number;
  marketer_2: number;
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

      const response = await ApiClient.get('/admin/buckets');
      const bucketData = await response.json();

      const bucketBalances: BucketBalances = {
        admin: bucketData.admin || 0,
        dev: bucketData.dev || 0,
        marketer_1: bucketData.marketer_1 || 0,
        marketer_2: bucketData.marketer_2 || 0,
        trader: bucketData.trader || 0,
        reserve: bucketData.reserve || 0,
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