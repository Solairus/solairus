import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { getProgram, derivePdas, Config } from "@/lib/solairus-removed";
import * as anchor from '@coral-xyz/anchor';

export type BucketType = 'admin' | 'dev' | 'marketer1' | 'marketer2' | 'trader' | 'systemreserve';

export interface BucketBalances {
  admin: anchor.BN;
  dev: anchor.BN;
  marketer1: anchor.BN;
  marketer2: anchor.BN;
  trader: anchor.BN;
  systemreserve: anchor.BN;
}

export interface UseBucketBalancesReturn {
  balances: BucketBalances | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBucketBalances(): UseBucketBalancesReturn {
  const { anchorProvider } = useWallet();
  const [balances, setBalances] = useState<BucketBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!anchorProvider) {
      setError('Wallet not connected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const program = getProgram(anchorProvider);
      const { config } = derivePdas();
      
      const configData = await program.account["config"].fetch(config) as Config;
      
      const bucketBalances: BucketBalances = {
        admin: configData.bucketAdminUsdt,
        dev: configData.bucketDevUsdt,
        marketer1: configData.bucketMarketer1Usdt,
        marketer2: configData.bucketMarketer2Usdt,
        trader: configData.bucketTraderUsdt,
        systemreserve: configData.bucketSystemreserveUsdt,
      };

      setBalances(bucketBalances);
    } catch (err) {
      console.error('Error fetching bucket balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bucket balances');
    } finally {
      setLoading(false);
    }
  }, [anchorProvider]);

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