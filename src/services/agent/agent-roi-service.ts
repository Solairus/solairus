import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction, TransactionSignature } from "@solana/web3.js";
import { getWithdrawalLimitStatus, canWithdrawAmount } from "./withdrawal-limit-service";
import { getUserAgent } from "./agent-service";
import { AgentErrorHandler } from "@/utils/agent-error-handler";
import { EXTENDED_AGENT_TIER_METADATA } from "@/config/agent-config";

// Helper function to check if ROI withdrawal is possible
function canWithdrawRoi(agentData: any): { canWithdraw: boolean; reason?: string; nextWithdrawalAt?: Date } {
  // This is a simplified version - in reality you'd check the actual contract state
  const now = Math.floor(Date.now() / 1000);
  const lastWithdrawal = agentData.lastRoiWithdrawal || 0;
  const secondsPerDay = 86400; // 24 hours fixed (backend-enforced)
  
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

    const { confirmationTimeout = 30000, skipPreflight = false } = options;
    const connection = anchorProvider.connection;
    const userPublicKey = anchorProvider.wallet.publicKey;

    // Validate agent exists and backend eligibility (no contract timing)
    const agentData = await getUserAgent(connection, userPublicKey, activationId);
    if (!agentData) {
      throw new Error(`Agent with activation ID ${activationId} not found`);
    }

    if (!agentData.canWithdraw) {
      throw new Error('Cooldown active or yield cap reached');
    }

    // Use backend API for withdrawal instead of direct contract calls
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
    
    // Optional: wait and refresh simple backend state only
    await new Promise(resolve => setTimeout(resolve, 1000));
    const updatedAgentData = await getUserAgent(connection, userPublicKey, activationId).catch(() => null);
    if (updatedAgentData && agentData) {
      const roiAmount = updatedAgentData.totalRoiWithdrawn - agentData.totalRoiWithdrawn;
      result.roiAmount = roiAmount;
      result.agentRetired = updatedAgentData.yieldCapReached;
      result.newTotalWithdrawn = updatedAgentData.totalRoiWithdrawn;
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
    // Call backend placeholder ROI route
    const res = await fetch(`/api/agents/${activationId}/roi`, { method: 'GET' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { minRoi: 0, maxRoi: 0, averageRoi: 0, canWithdraw: false, reason: err.error || 'Failed to fetch ROI' };
    }
    const data = await res.json();
    const roi = Number(data?.roi ?? 0);
    return { minRoi: roi, maxRoi: roi, averageRoi: roi, canWithdraw: true };
  } catch (error) {
    console.error('❌ Error estimating agent ROI:', error);
    return { minRoi: 0, maxRoi: 0, averageRoi: 0, canWithdraw: false, reason: 'Error estimating ROI' };
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
    const agentData = await getUserAgent(connection, userPublicKey, activationId);
    if (!agentData) {
      return { canWithdraw: false, reason: 'Agent not found' };
    }
    return { canWithdraw: agentData.canWithdraw, nextWithdrawalAt: agentData.nextWithdrawalAt };
  } catch (error) {
    console.error('❌ Error checking agent ROI withdrawal:', error);
    return { canWithdraw: false, reason: `Error checking withdrawal status: ${getErrorMessage(error)}` };
  }
}