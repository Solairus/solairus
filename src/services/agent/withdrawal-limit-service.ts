import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { 
  getProgram,
  derivePdas,
  UserProfile,
  WithdrawalLimitStatus,
  calculateWithdrawalLimitStatus
} from "@/lib/solairus-main";

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
  try {
    const provider = new anchor.AnchorProvider(
      connection,
      // Create a dummy wallet for read-only operations
      { publicKey: userPublicKey, signTransaction: async () => { throw new Error('Read-only'); }, signAllTransactions: async () => { throw new Error('Read-only'); } },
      { commitment: 'confirmed' }
    );
    
    const program = getProgram(provider);
    const { config } = derivePdas();
    
    // Fetch config to get privileged user addresses
    const configData = await program.account["config"].fetch(config);
    
    // Check if user matches any privileged role
    const privilegedAddresses = [
      configData.admin,
      configData.dev,
      configData.marketer1,
      configData.marketer2,
      configData.trader
    ];
    
    return privilegedAddresses.some(addr => addr.equals(userPublicKey));
  } catch (error) {
    console.warn('⚠️ Error checking privileged user status:', error);
    return false; // Default to non-privileged if check fails
  }
}

/**
 * Get comprehensive withdrawal limit status for a user
 */
export async function getWithdrawalLimitStatus(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<WithdrawalLimitStatus> {
  try {
    console.log('🔍 Getting withdrawal limit status for user:', userPublicKey.toString());
    
    const provider = new anchor.AnchorProvider(
      connection,
      // Create a dummy wallet for read-only operations
      { publicKey: userPublicKey, signTransaction: async () => { throw new Error('Read-only'); }, signAllTransactions: async () => { throw new Error('Read-only'); } },
      { commitment: 'confirmed' }
    );
    
    const program = getProgram(provider);
    const { profile } = derivePdas(userPublicKey);
    
    if (!profile) {
      throw new Error("Could not derive user profile PDA");
    }
    
    // Check if user is privileged (exempt from limits)
    const isPrivileged = await isPrivilegedUser(connection, userPublicKey);
    console.log('🔐 User privileged status:', isPrivileged);
    
    // Fetch user profile to get deposit and withdrawal data
    let userProfile: UserProfile;
    try {
      userProfile = await program.account["userProfile"].fetch(profile) as UserProfile;
    } catch (error) {
      console.warn('⚠️ User profile not found, returning default status');
      // Return default status for users without profiles
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
    
    // Calculate withdrawal limit status
    const status = calculateWithdrawalLimitStatus(userProfile, isPrivileged);
    
    console.log('✅ Withdrawal limit status calculated:', {
      totalDeposits: status.totalDeposits.toString(),
      totalWithdrawn: status.totalWithdrawn.toString(),
      maxWithdrawable: status.maxWithdrawable.toString(),
      remainingWithdrawable: status.remainingWithdrawable.toString(),
      limitReached: status.limitReached,
      isPrivileged: status.isPrivileged,
      usagePercentage: status.usagePercentage
    });
    
    return status;
    
  } catch (error) {
    console.error('❌ Error getting withdrawal limit status:', error);
    throw new Error(`Failed to get withdrawal limit status: ${error instanceof Error ? error.message : String(error)}`);
  }
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