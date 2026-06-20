import { Connection, PublicKey, TransactionSignature } from "@solana/web3.js";
import { getUserAgent } from "./agent-service";
import { AgentErrorHandler } from "@/utils/agent-error-handler";
import { ensureUserUsdtAta, isAtaSetupRequired, type WalletSigner } from "@/utils/ensure-usdt-ata";

export interface WithdrawAgentRoiOptions {
  confirmationTimeout?: number;
  skipPreflight?: boolean;
  /** Notified when the one-time USDT-account setup starts/finishes (for UI copy). */
  onAtaSetup?: (phase: 'start' | 'done') => void;
}

export interface WithdrawAgentRoiResult {
  signature: TransactionSignature;
  roiAmount?: number;
  agentRetired?: boolean;
  newTotalWithdrawn?: number;
  userTotalWithdrawn?: number;
}

export interface WithdrawAgentRoiError {
  code: string;
  message: string;
  details?: unknown;
}

export async function withdrawAgentRoi(
  connection: Connection,
  activationId: number,
  signer?: WalletSigner,
  options: WithdrawAgentRoiOptions = {}
): Promise<WithdrawAgentRoiResult> {
  try {
    console.log('🚀 Initiating ROI withdrawal via backend API for activation ID:', activationId);

    const { ApiClient, API_CONFIG } = await import("@/config/service-endpoints");
    const postInit = () => ApiClient.post(`${API_CONFIG.getBaseUrl()}/withdrawals/init`, {
      type: 'agent_roi',
      activationId: Number(activationId),
    });

    let response = await postInit();
    let backendResult = await response.json().catch(() => ({}));

    // One-time USDT-account setup gate (NOT an error). The user creates their own
    // account (they pay the small refundable rent); the platform never does.
    if (response.ok && isAtaSetupRequired(backendResult)) {
      if (!signer) {
        throw new Error(backendResult.message || 'Your wallet needs to set up a USDT account before you can withdraw.');
      }
      options.onAtaSetup?.('start');
      await ensureUserUsdtAta(connection, signer);
      options.onAtaSetup?.('done');
      response = await postInit();
      backendResult = await response.json().catch(() => ({}));
      if (isAtaSetupRequired(backendResult)) {
        throw new Error('USDT account setup didn’t complete. Please try the withdrawal again.');
      }
    }

    if (!response.ok) {
      throw new Error(`Backend withdrawal failed: ${backendResult?.error || response.statusText}`);
    }

    if (response.status === 202 || (!backendResult.signature && backendResult.status === 'processing')) {
      throw new Error('Withdrawal submitted — confirmation pending. Your balance will update once it settles.');
    }

    const { signature } = backendResult;
    if (!signature) {
      throw new Error('Backend did not return a payout signature');
    }

    const result: WithdrawAgentRoiResult = {
      signature,
      roiAmount: backendResult.roiAmount,
      agentRetired: backendResult.agentRetired,
      newTotalWithdrawn: backendResult.newTotalWithdrawn,
      userTotalWithdrawn: backendResult.userTotalWithdrawn,
    };

    await new Promise(resolve => setTimeout(resolve, 1000));
    const userPublicKey = undefined as unknown as PublicKey;
    const updatedAgentData = await getUserAgent(connection, userPublicKey, activationId).catch(() => null);
    if (updatedAgentData) {
      result.agentRetired = updatedAgentData.yieldCapReached;
      result.newTotalWithdrawn = updatedAgentData.totalRoiWithdrawn;
    }

    return result;
  } catch (error) {
    const agentError = AgentErrorHandler.parseError(error, 'ROI withdrawal');
    throw new Error(agentError.message);
  }
}

export async function estimateAgentRoi(
  _connection: Connection,
  _userPublicKey: PublicKey,
  activationId: number
): Promise<{ minRoi: number; maxRoi: number; averageRoi: number; canWithdraw: boolean; reason?: string }> {
  try {
    const res = await fetch(`/api/agents/${activationId}/roi`, { method: 'GET' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { minRoi: 0, maxRoi: 0, averageRoi: 0, canWithdraw: false, reason: err.error || 'Failed to fetch ROI' };
    }
    const data = await res.json();
    const roi = Number(data?.roi ?? 0);
    return { minRoi: roi, maxRoi: roi, averageRoi: roi, canWithdraw: true };
  } catch (error) {
    return { minRoi: 0, maxRoi: 0, averageRoi: 0, canWithdraw: false, reason: 'Error estimating ROI' };
  }
}

export async function canWithdrawAgentRoi(
  connection: Connection,
  userPublicKey: PublicKey,
  activationId: number
): Promise<{ canWithdraw: boolean; reason?: string; nextWithdrawalAt?: Date; globalLimitReached?: boolean }> {
  try {
    const agentData = await getUserAgent(connection, userPublicKey, activationId);
    if (!agentData) return { canWithdraw: false, reason: 'Agent not found' };
    return { canWithdraw: agentData.canWithdraw, nextWithdrawalAt: agentData.nextWithdrawalAt };
  } catch (error) {
    return { canWithdraw: false, reason: `Error checking withdrawal status: ${error instanceof Error ? error.message : String(error)}` };
  }
}
