/**
 * Live ROI Service
 * 
 * Calculates the current withdrawable ROI amount for an agent based on on-chain data
 * This provides real-time ROI calculation without rate limiting concerns
 */

import React from 'react';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { 
  getProgram,
  deriveAgentActivationPda,
  UserAgentActivation,
  AGENT_TIER_CONFIGS
} from "@/lib/solairus-removed";
import { getContractSecondsPerDay } from "./contract-timing-service";

export interface LiveRoiData {
  currentWithdrawableAmount: number; // In USDT
  totalAccumulatedRoi: number; // Total ROI accumulated since last withdrawal
  daysSinceLastWithdrawal: number; // Number of "days" (contract time) since last withdrawal
  isWithdrawable: boolean; // Whether the amount can be withdrawn now
  nextUpdateIn: number; // Seconds until next ROI accumulation
}

/**
 * Calculate the current withdrawable ROI for an agent
 * This simulates the contract's ROI calculation logic
 */
export async function getLiveRoi(
  connection: Connection | anchor.AnchorProvider,
  userPublicKey: PublicKey,
  activationId: number
): Promise<LiveRoiData | null> {
  try {
    // Create provider for read-only operations
    const provider = connection instanceof Connection 
      ? new anchor.AnchorProvider(
          connection,
          { publicKey: userPublicKey, signTransaction: async () => { throw new Error('Read-only'); }, signAllTransactions: async () => { throw new Error('Read-only'); } },
          { commitment: 'confirmed' }
        )
      : connection;

    const program = getProgram(provider);
    
    // Derive the agent activation PDA
    const activationPda = deriveAgentActivationPda(userPublicKey, new anchor.BN(activationId));
    
    // Fetch the agent activation data
    const activationData = await program.account["userAgentActivation"].fetch(activationPda) as UserAgentActivation;
    
    // Get contract timing
    const secondsPerDay = await getContractSecondsPerDay(connection);
    
    // Calculate live ROI
    const liveRoi = calculateLiveRoi(activationData, secondsPerDay);
    
    return liveRoi;
    
  } catch (error) {
    console.warn('Could not fetch live ROI:', error);
    return null;
  }
}

/**
 * Calculate live ROI based on agent activation data and contract timing
 */
function calculateLiveRoi(
  activation: UserAgentActivation,
  secondsPerDay: number
): LiveRoiData {
  const now = Math.floor(Date.now() / 1000);
  const activationTime = activation.startedAt.toNumber();
  const lastWithdrawalTime = activation.lastRoiWithdrawAt.toNumber();
  const tierConfig = AGENT_TIER_CONFIGS[activation.tier];
  
  // Determine the reference time (activation or last withdrawal)
  const referenceTime = lastWithdrawalTime > 0 ? lastWithdrawalTime : activationTime;
  
  // Calculate elapsed time since reference
  const elapsedSeconds = now - referenceTime;
  const elapsedDays = Math.floor(elapsedSeconds / secondsPerDay);
  const remainingSeconds = elapsedSeconds % secondsPerDay;
  
  // Check if agent can withdraw (timing requirements)
  const canWithdrawTiming = lastWithdrawalTime > 0 
    ? (now >= lastWithdrawalTime + secondsPerDay)
    : (now >= activationTime + secondsPerDay);
  
  // Calculate total withdrawable amount for elapsed full days
  let totalWithdrawableAmount = 0;
  
  if (elapsedDays > 0 && canWithdrawTiming) {
    // For each elapsed day, calculate ROI using tier's average yield
    const activationAmountUsdt = activation.amountUsdt.toNumber() / 1_000_000;
    const averageYieldBps = (tierConfig.minYieldBps + tierConfig.maxYieldBps) / 2;
    const dailyRoiAmount = (activationAmountUsdt * averageYieldBps) / 10000;
    
    totalWithdrawableAmount = dailyRoiAmount * elapsedDays;
  }
  
  // Calculate next update time
  const nextUpdateIn = secondsPerDay - remainingSeconds;
  
  return {
    currentWithdrawableAmount: totalWithdrawableAmount,
    totalAccumulatedRoi: totalWithdrawableAmount,
    daysSinceLastWithdrawal: elapsedDays,
    isWithdrawable: canWithdrawTiming && totalWithdrawableAmount > 0 && !activation.yieldCapReached,
    nextUpdateIn: nextUpdateIn > 0 ? nextUpdateIn : 0
  };
}

/**
 * Hook for live ROI updates with automatic refresh
 */
export function useLiveRoi(
  connection: Connection | anchor.AnchorProvider | undefined,
  userPublicKey: PublicKey | undefined,
  activationId: number | undefined,
  refreshInterval: number = 60000 // 1 minute default
) {
  const [liveRoi, setLiveRoi] = React.useState<LiveRoiData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!connection || !userPublicKey || activationId === undefined) {
      setLiveRoi(null);
      return;
    }

    const fetchLiveRoi = async () => {
      try {
        setLoading(true);
        setError(null);
        const roi = await getLiveRoi(connection, userPublicKey, activationId);
        setLiveRoi(roi);
      } catch (err) {
        console.error('Error fetching live ROI:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch live ROI');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchLiveRoi();

    // DISABLED: Auto-refresh to prevent rate limits
    // Users can manually refresh if needed
    // const intervalId = setInterval(fetchLiveRoi, refreshInterval);
    // return () => {
    //   clearInterval(intervalId);
    // };
    
    // Just return empty cleanup function
    return () => {};
  }, [connection, userPublicKey, activationId, refreshInterval]);

  return { liveRoi, loading, error };
}

