import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction, TransactionSignature } from "@solana/web3.js";
import { 
  getProgram,
  derivePdas,
  deriveAgentActivationPda,
  canWithdrawRoi,
  getErrorMessage,
  AGENT_TIER_CONFIGS
} from "@/lib/solairus-main";
import { getWithdrawalLimitStatus, canWithdrawAmount } from "./withdrawal-limit-service";
import { getUserAgent } from "./agent-service";
import { AgentErrorHandler } from "@/utils/agent-error-handler";
import { getContractSecondsPerDay } from "./contract-timing-service";

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
    
    // Step 4: Set up program with provided anchor provider
    const program = getProgram(anchorProvider);
    
    // Step 5: Derive necessary PDAs and accounts
    const { config, vault, profile } = derivePdas(userPublicKey);
    if (!profile) {
      throw new Error("Could not derive user profile PDA");
    }
    
    // Derive the specific agent activation PDA
    const activationPda = deriveAgentActivationPda(userPublicKey, new anchor.BN(activationId));
    
    // Get config data for USDT mint and vault setup
    const configData = await program.account["config"].fetch(config);
    const usdtMint = configData.usdtMint;
    
    // Derive token accounts
    const userUsdt = anchor.utils.token.associatedAddress({
      mint: usdtMint,
      owner: userPublicKey,
    });
    
    const vaultUsdt = anchor.utils.token.associatedAddress({
      mint: usdtMint,
      owner: vault,
    });
    
    console.log('✅ All accounts and PDAs derived');
    
    // Step 6: Build and send transaction
    console.log('🚀 Sending withdraw_agent_roi transaction...');
    
    const txSignature = await program.methods
      .withdrawAgentRoi(new anchor.BN(activationId))
      .accounts({
        config,
        vault,
        profile,
        activation: activationPda,
        user: userPublicKey,
        usdtMint,
        userUsdt,
        vaultUsdt,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log('✅ Transaction sent:', txSignature);
    
    // Step 7: Wait for confirmation with timeout
    const startTime = Date.now();
    let confirmed = false;
    
    while (!confirmed && (Date.now() - startTime) < confirmationTimeout) {
      try {
        const status = await connection.getSignatureStatus(txSignature);
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn('⚠️ Error checking transaction status:', error);
      }
    }
    
    if (!confirmed) {
      console.warn('⚠️ Transaction confirmation timeout, but transaction may still succeed');
    }
    
    // Step 8: Get updated agent state to determine actual withdrawal amount
    const result: WithdrawAgentRoiResult = { signature: txSignature };
    
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
    
    // Get the actual tier config with yield basis points
    const fullTierConfig = AGENT_TIER_CONFIGS[agentData.tier];
    
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