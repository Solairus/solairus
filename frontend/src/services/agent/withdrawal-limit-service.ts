import { Connection, PublicKey } from "@solana/web3.js";

export interface WithdrawalLimitStatus {
  totalDeposits: number;
  totalWithdrawn: number;
  maxWithdrawable: number;
  remainingWithdrawable: number;
  limitReached: boolean;
  isPrivileged: boolean;
  usagePercentage: number;
}

export async function isPrivilegedUser(
  _connection: Connection,
  _userPublicKey: PublicKey
): Promise<boolean> {
  return false;
}

export async function getWithdrawalLimitStatus(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<WithdrawalLimitStatus> {
  const isPrivileged = await isPrivilegedUser(connection, userPublicKey);
  return {
    totalDeposits: 0,
    totalWithdrawn: 0,
    maxWithdrawable: 0,
    remainingWithdrawable: 0,
    limitReached: false,
    isPrivileged,
    usagePercentage: 0,
  };
}

export async function canWithdrawAmount(
  connection: Connection,
  userPublicKey: PublicKey,
  withdrawalAmount: number
): Promise<{ canWithdraw: boolean; reason?: string; maxAllowedAmount?: number }> {
  try {
    const status = await getWithdrawalLimitStatus(connection, userPublicKey);
    if (status.isPrivileged) return { canWithdraw: true };
    const withdrawalMicro = withdrawalAmount * 1_000_000;
    if (withdrawalMicro > status.remainingWithdrawable) {
      const maxAllowedAmount = status.remainingWithdrawable / 1_000_000;
      return {
        canWithdraw: false,
        reason: `Withdrawal would exceed limit. Maximum allowed: ${maxAllowedAmount.toFixed(2)} USDT`,
        maxAllowedAmount,
      };
    }
    return { canWithdraw: true };
  } catch (error) {
    return {
      canWithdraw: false,
      reason: `Error checking withdrawal limit: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface WithdrawalLimitDisplay {
  totalDeposits: string;
  totalWithdrawn: string;
  maxWithdrawable: string;
  remainingWithdrawable: string;
  unclaimedAgentResults?: string;
  usagePercentage: number;
  limitReached: boolean;
  isPrivileged: boolean;
  warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  statusMessage: string;
}

export async function getWithdrawalLimitDisplay(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<WithdrawalLimitDisplay> {
  const status = await getWithdrawalLimitStatus(connection, userPublicKey);
  const fmt = (n: number) => (n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let warningLevel: WithdrawalLimitDisplay['warningLevel'] = 'none';
  let statusMessage = '';
  if (status.isPrivileged) {
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
    statusMessage = 'Withdrawal limit healthy';
  }

  return {
    totalDeposits: fmt(status.totalDeposits),
    totalWithdrawn: fmt(status.totalWithdrawn),
    maxWithdrawable: status.isPrivileged ? 'Unlimited' : fmt(status.maxWithdrawable),
    remainingWithdrawable: status.isPrivileged ? 'Unlimited' : fmt(status.remainingWithdrawable),
    usagePercentage: status.usagePercentage,
    limitReached: status.limitReached,
    isPrivileged: status.isPrivileged,
    warningLevel,
    statusMessage,
  };
}
