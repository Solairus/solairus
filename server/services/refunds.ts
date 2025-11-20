import { Connection, PublicKey } from '@solana/web3.js';

export interface RefundCheckParams {
  connection: Connection;
  signature?: string;
  mintAddress: string;
  vaultAuthority: string;
  recipientAta: string;
  amountMicro: number;
}

export interface RefundDecision {
  shouldRefund: boolean;
  reason?: string;
}

/**
 * Shared verifier to decide if a failed withdrawal should be refunded.
 * - Prefer on-chain verification: signature finality or token account deltas
 */
export async function decideRefund(params: RefundCheckParams): Promise<RefundDecision> {
  const { connection, signature, vaultAuthority, recipientAta, amountMicro } = params;
  try {
    if (signature) {
      const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const value = status.value[0];
      if (value && (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized')) {
        return { shouldRefund: false, reason: 'on-chain confirmed' };
      }
      if (value?.err) {
        return { shouldRefund: true, reason: 'on-chain error' };
      }
    }

    // Fallback: check token account balances (best-effort)
    const recipientInfo = await connection.getAccountInfo(new PublicKey(recipientAta));
    const vaultInfo = await connection.getAccountInfo(new PublicKey(vaultAuthority));
    if (!recipientInfo || !vaultInfo) {
      return { shouldRefund: true, reason: 'account info unavailable' };
    }
    // In absence of parsed accounts, default to refund to avoid stuck balances
    return { shouldRefund: true, reason: 'unable to verify transfer' };
  } catch (error) {
    return { shouldRefund: true, reason: `verifier error: ${error instanceof Error ? error.message : String(error)}` };
  }
}