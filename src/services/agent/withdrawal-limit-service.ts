import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

// Local fallback types and helpers to remove solairus-removed dependency.
// These stubs ensure the UI can render without on-chain integrations.
export interface WithdrawalLimitStatus {
  totalDeposits: anchor.BN;
  totalWithdrawn: anchor.BN;
  maxWithdrawable: anchor.BN;
  remainingWithdrawable: anchor.BN;
  limitReached: boolean;
  isPrivileged: boolean;
  usagePercentage: number; // 0-100
}

// Privileged user roles that are exempt from withdrawal limits
const PRIVILEGED_ROLES = {
  ADMIN: 'admin',
  DEV: 'dev', 
  MARKETER1: 'marketer1',
  MARKETER2: 'marketer2',
  TRADER: 'trader'
} as const;

/**
 * Check if a user has a privileged role (exempt from withdrawal limits)
 */
export async function isPrivilegedUser(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<boolean> {
  // Stubbed: without on-chain config, default to non-privileged.
  // If backend provides roles later, wire it in here.
  return false;
}

/**
 * Get comprehensive withdrawal limit status for a user
 */
export async function getWithdrawalLimitStatus(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<WithdrawalLimitStatus> {
  // Stubbed: without on-chain profile, return safe defaults.
  const isPrivileged = await isPrivilegedUser(connection, userPublicKey);
  return {
    totalDeposits: new anchor.BN(0),
    totalWithdrawn: new anchor.BN(0),
    maxWithdrawable: new anchor.BN(0),
    remainingWithdrawable: new anchor.BN(0),
    limitReached: false,
    isPrivileged,
    usagePercentage: 0
  };
}

/**
 * Check if a withdrawal amount would exceed the user's limit
 */
export async function canWithdrawAmount(
  connection: Connection,
  userPublicKey: PublicKey,
  withdrawalAmount: number // In USDT
): Promise<{
  canWithdraw: boolean;
  reason?: string;
  maxAllowedAmount?: number;
}> {
  try {
    const status = await getWithdrawalLimitStatus(connection, userPublicKey);
    
    // Privileged users can withdraw any amount
    if (status.isPrivileged) {
      return { canWithdraw: true };
    }
    
    // Convert withdrawal amount to smallest unit (same as BN)
    const withdrawalAmountBN = new anchor.BN(withdrawalAmount * 1_000_000);
    
    // Check if withdrawal would exceed remaining limit
    if (withdrawalAmountBN.gt(status.remainingWithdrawable)) {
      const maxAllowedAmount = status.remainingWithdrawable.toNumber() / 1_000_000;
      return {
        canWithdraw: false,
        reason: `Withdrawal would exceed limit. Maximum allowed: ${maxAllowedAmount.toFixed(2)} USDT`,
        maxAllowedAmount
      };
    }
    
    return { canWithdraw: true };
    
  } catch (error) {
    console.error('❌ Error checking withdrawal amount:', error);
    return {
      canWithdraw: false,
      reason: `Error checking withdrawal limit: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get formatted withdrawal limit display data
 */
export interface WithdrawalLimitDisplay {
  totalDeposits: string; // Formatted USDT amount
  totalWithdrawn: string; // Formatted USDT amount
  maxWithdrawable: string; // Formatted USDT amount
  remainingWithdrawable: string; // Formatted USDT amount
  usagePercentage: number; // 0-100
  limitReached: boolean;
  isPrivileged: boolean;
  warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  statusMessage: string;
}

export async function getWithdrawalLimitDisplay(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<WithdrawalLimitDisplay> {
  try {
    const status = await getWithdrawalLimitStatus(connection, userPublicKey);
    
    // Format amounts for display
    const formatAmount = (bn: anchor.BN): string => {
      const amount = bn.toNumber() / 1_000_000;
      return amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    };
    
    const totalDeposits = formatAmount(status.totalDeposits);
    const totalWithdrawn = formatAmount(status.totalWithdrawn);
    const maxWithdrawable = status.isPrivileged ? 'Unlimited' : formatAmount(status.maxWithdrawable);
    const remainingWithdrawable = status.isPrivileged ? 'Unlimited' : formatAmount(status.remainingWithdrawable);
    
    // Determine warning level based on usage percentage
    let warningLevel: WithdrawalLimitDisplay['warningLevel'] = 'none';
    let statusMessage = '';
    
    if (status.isPrivileged) {
      warningLevel = 'none';
      statusMessage = 'Unlimited withdrawals (privileged account)';
    } else if (status.limitReached) {
      warningLevel = 'critical';
      statusMessage = 'Withdrawal limit reached';
    } else if (status.usagePercentage >= 90) {
      warningLevel = 'critical';
      statusMessage = 'Approaching withdrawal limit';
    } else if (status.usagePercentage >= 75) {
      warningLevel = 'high';
      statusMessage = 'High withdrawal usage';
    } else if (status.usagePercentage >= 50) {
      warningLevel = 'medium';
      statusMessage = 'Moderate withdrawal usage';
    } else if (status.usagePercentage >= 25) {
      warningLevel = 'low';
      statusMessage = 'Low withdrawal usage';
    } else {
      warningLevel = 'none';
      statusMessage = 'Withdrawal limit healthy';
    }
    
    return {
      totalDeposits,
      totalWithdrawn,
      maxWithdrawable,
      remainingWithdrawable,
      usagePercentage: status.usagePercentage,
      limitReached: status.limitReached,
      isPrivileged: status.isPrivileged,
      warningLevel,
      statusMessage
    };
    
  } catch (error) {
    console.error('❌ Error getting withdrawal limit display:', error);
    throw error;
  }
}