import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction, TransactionSignature } from "@solana/web3.js";
import { getWithdrawalLimitStatus, canWithdrawAmount } from "./withdrawal-limit-service";
import { getUserAgent } from "./agent-service";
import { AgentErrorHandler } from "@/utils/agent-error-handler";
import { getContractSecondsPerDay } from "./contract-timing-service";
import { EXTENDED_AGENT_TIER_METADATA } from "@/config/agent-config";

// Helper function to check if ROI withdrawal is possible
function canWithdrawRoi(agentData: any): { canWithdraw: boolean; reason?: string; nextWithdrawalAt?: Date } {
  // This is a simplified version - in reality you'd check the actual contract state
  const now = Math.floor(Date.now() / 1000);
  const lastWithdrawal = agentData.lastRoiWithdrawal || 0;
  const secondsPerDay = 86400; // 24 hours in production
  
  if (now - lastWithdrawal < secondsPerDay) {
    const nextWithdrawalAt = new Date((lastWithdrawal + secondsPerDay) * 1000);
    return {
      canWithdraw: false,
      reason: 'Must wait 24 hours between withdrawals',
      nextWithdrawalAt
    };
  }
  
  if (agentData.yieldCapReached) {
    return {
      canWithdraw: false,
      reason: 'Yield cap reached'
    };
  }
  
  return { canWithdraw: true };
}

function getErrorMessage(error: any): string {
  return error instanceof Error ? error.message : String(error);
}

export interface WithdrawAgentRoiOptions {
  confirmationTimeout?: number; // Timeout in milliseconds for transaction confirmation
  skipPreflight?: boolean; // Skip preflight checks
}

export interface WithdrawAgentRoiResult {
  signature: TransactionSignature;
  roiAmount?: number; // Actual ROI amount withdrawn (in USDT)
  agentRetired?: boolean; // Whether the agent reached yield cap
  newTotalWithdrawn?: number; // Agent's new total withdrawn amount
  userTotalWithdrawn?: number; // User's new total withdrawn amount
}

export interface WithdrawAgentRoiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Withdraw ROI from a specific agent
 */
export async function withdrawAgentRoi(
  anchorProvider: anchor.AnchorProvider,
  activationId: number,
  options: WithdrawAgentRoiOptions = {}
): Promise<WithdrawAgentRoiResult> {
  try {
    console.log('🚀 Starting agent ROI withdrawal for activation ID:', activationId);
    
    const {
      confirmationTimeout = 30000,
      skipPreflight = false
    } = options;
    
    const connection = anchorProvider.connection;
    const userPublicKey = anchorProvider.wallet.publicKey;
    
    // Step 1: Validate agent exists and get current state
    const agentData = await getUserAgent(connection, userPublicKey, activationId);
    if (!agentData) {
      throw new Error(`Agent with activation ID ${activationId} not found`);
    }
    
    console.log('✅ Agent found:', {
      tier: agentData.tierConfig.name,
      amount: agentData.activationAmount,
      yieldCapReached: agentData.yieldCapReached
    });
    
    // Step 2: Check if withdrawal is allowed (timing and yield cap) using contract timing
    const secondsPerDay = await getContractSecondsPerDay(connection);
    console.log(`🕒 Using contract timing: ${secondsPerDay} seconds per day`);
    
    const withdrawalCheck = canWithdrawRoi(agentData.accountData, Math.floor(Date.now() / 1000), secondsPerDay);
    if (!withdrawalCheck.canWithdraw) {
      throw new Error(withdrawalCheck.reason || 'Cannot withdraw ROI at this time');
    }
    
    console.log('✅ Agent withdrawal timing check passed');
    
    // Step 3: Check global withdrawal limits
    const withdrawalLimitStatus = await getWithdrawalLimitStatus(connection, userPublicKey);
    if (withdrawalLimitStatus.limitReached && !withdrawalLimitStatus.isPrivileged) {
      throw new Error('Global withdrawal limit reached (200x deposits)');
    }
    
    console.log('✅ Global withdrawal limit check passed');
    
    // Step 4: Use backend API for withdrawal instead of direct contract calls
    console.log('🚀 Initiating ROI withdrawal via backend API...');
    
    // Call backend withdrawal endpoint
    const response = await fetch('/api/withdrawals/agent-roi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activationId,
        walletAddress: userPublicKey.toString()
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend withdrawal failed: ${errorData.error || response.statusText}`);
    }
    
    const backendResult = await response.json();
    console.log('✅ Backend withdrawal successful:', backendResult);
    
    // Step 8: Prepare result from backend response
    const result: WithdrawAgentRoiResult = { 
      signature: backendResult.signature || 'backend-withdrawal',
      roiAmount: backendResult.roiAmount,
      agentRetired: backendResult.agentRetired,
      newTotalWithdrawn: backendResult.newTotalWithdrawn,
      userTotalWithdrawn: backendResult.userTotalWithdrawn
    };
    
    try {
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedAgentData = await getUserAgent(connection, userPublicKey, activationId);
      if (updatedAgentData && agentData) {
        const roiAmount = updatedAgentData.totalRoiWithdrawn - agentData.totalRoiWithdrawn;
        result.roiAmount = roiAmount;
        result.agentRetired = updatedAgentData.yieldCapReached;
        result.newTotalWithdrawn = updatedAgentData.totalRoiWithdrawn;
        
        console.log('✅ ROI withdrawal successful:', {
          roiAmount: roiAmount.toFixed(6),
          agentRetired: result.agentRetired,
          newTotalWithdrawn: result.newTotalWithdrawn
        });
      }
      
      // Get updated user withdrawal status
      const updatedWithdrawalStatus = await getWithdrawalLimitStatus(connection, userPublicKey);
      result.userTotalWithdrawn = updatedWithdrawalStatus.totalWithdrawn.toNumber() / 1_000_000;
      
    } catch (error) {
      console.warn('⚠️ Could not fetch updated agent state:', error);
      // Transaction still succeeded, just couldn't get updated state
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Agent ROI withdrawal failed:', error);
    
    // Use the agent error handler to parse and format the error
    const agentData = await getUserAgent(anchorProvider.connection, anchorProvider.wallet.publicKey, activationId).catch(() => null);
    const agentError = AgentErrorHandler.parseError(error, 'ROI withdrawal', agentData || undefined);
    
    // Throw the user-friendly error message
    throw new Error(agentError.message);
  }
}

/**
 * Estimate the ROI amount that would be withdrawn (for display purposes)
 * Note: This is an approximation since actual ROI is randomly generated on-chain
 */
export async function estimateAgentRoi(
  connection: Connection,
  userPublicKey: PublicKey,
  activationId: number
): Promise<{
  minRoi: number;
  maxRoi: number;
  averageRoi: number;
  canWithdraw: boolean;
  reason?: string;
}> {
  try {
    const agentData = await getUserAgent(connection, userPublicKey, activationId);
    if (!agentData) {
      throw new Error(`Agent with activation ID ${activationId} not found`);
    }
    
    // Check if withdrawal is possible
    const withdrawalCheck = canWithdrawRoi(agentData.accountData);
    if (!withdrawalCheck.canWithdraw) {
      return {
        minRoi: 0,
        maxRoi: 0,
        averageRoi: 0,
        canWithdraw: false,
        reason: withdrawalCheck.reason
      };
    }
    
    // Calculate ROI range based on tier configuration
    const tierConfig = agentData.tierConfig;
    const activationAmount = agentData.activationAmount;
    
    // Get the actual tier config with yield basis points from backend-driven config
    const fullTierConfig = EXTENDED_AGENT_TIER_METADATA.find(t => t.name === agentData.tier);
    if (!fullTierConfig) {
      throw new Error(`Tier configuration not found for: ${agentData.tier}`);
    }
    
    const minRoi = (activationAmount * fullTierConfig.minYieldBps) / 10000;
    const maxRoi = (activationAmount * fullTierConfig.maxYieldBps) / 10000;
    const averageRoi = (minRoi + maxRoi) / 2;
    
    return {
      minRoi,
      maxRoi,
      averageRoi,
      canWithdraw: true
    };
    
  } catch (error) {
    console.error('❌ Error estimating agent ROI:', error);
    throw error;
  }
}

/**
 * Check if agent ROI withdrawal is currently possible
 */
export async function canWithdrawAgentRoi(
  connection: Connection,
  userPublicKey: PublicKey,
  activationId: number
): Promise<{
  canWithdraw: boolean;
  reason?: string;
  nextWithdrawalAt?: Date;
  globalLimitReached?: boolean;
}> {
  try {
    // Check agent-specific conditions
    const agentData = await getUserAgent(connection, userPublicKey, activationId);
    if (!agentData) {
      return {
        canWithdraw: false,
        reason: 'Agent not found'
      };
    }
    
    const agentCheck = canWithdrawRoi(agentData.accountData);
    if (!agentCheck.canWithdraw) {
      return {
        canWithdraw: false,
        reason: agentCheck.reason,
        nextWithdrawalAt: agentCheck.nextWithdrawalAt
      };
    }
    
    // Check global withdrawal limits
    const withdrawalLimitStatus = await getWithdrawalLimitStatus(connection, userPublicKey);
    if (withdrawalLimitStatus.limitReached && !withdrawalLimitStatus.isPrivileged) {
      return {
        canWithdraw: false,
        reason: 'Global withdrawal limit reached',
        globalLimitReached: true
      };
    }
    
    return { canWithdraw: true };
    
  } catch (error) {
    console.error('❌ Error checking agent ROI withdrawal:', error);
    return {
      canWithdraw: false,
      reason: `Error checking withdrawal status: ${getErrorMessage(error)}`
    };
  }
}