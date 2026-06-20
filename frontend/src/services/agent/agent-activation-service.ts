import { PublicKey } from '@solana/web3.js';
import { API_CONFIG, AGENT_ENDPOINTS, ApiClient } from '@/config/service-endpoints';
import { AgentErrorHandler } from '@/utils/agent-error-handler';

export interface AgentActivationParams {
  userPublicKey: PublicKey;
  amount: number;
  tier: string;
  paymentMethod: 'usdt' | 'credit';
}

export interface AgentActivationResult {
  success: boolean;
  txSignature?: string;
  activationId?: number;
  error?: string;
  userFriendlyMessage?: string;
}

export async function activateAgent(
  _connection: unknown,
  params: AgentActivationParams
): Promise<AgentActivationResult> {
  try {
    const amountMicro = Math.floor(params.amount * 1_000_000);
    const url = `${API_CONFIG.getBaseUrl()}${AGENT_ENDPOINTS.activateAgent}`;
    const resp = await ApiClient.post(url, {
      amountMicro,
      paymentMethod: params.paymentMethod,
      tierName: params.tier,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || 'Agent activation failed');
    }
    const payload = await resp.json();
    const activationId = payload?.agent?.id as number | undefined;
    return {
      success: true,
      activationId,
      userFriendlyMessage: `Successfully activated agent!`,
    };
  } catch (error: unknown) {
    const agentError = AgentErrorHandler.parseError(error as Error, 'Agent activation');
    return { success: false, error: agentError.message, userFriendlyMessage: agentError.message };
  }
}

export function getMinimumActivationAmount(tier: string): number {
  switch (tier.toUpperCase()) {
    case 'NOVA': return 10;
    case 'VEGA': return 25;
    case 'ORION': return 50;
    case 'PRIME': return 100;
    default: return 10;
  }
}

export function validateActivationParams(params: AgentActivationParams): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (params.amount <= 0) errors.push('Activation amount must be greater than 0');
  const minAmount = getMinimumActivationAmount(params.tier);
  if (params.amount < minAmount) errors.push(`Minimum activation amount for ${params.tier} tier is $${minAmount}`);
  const validTiers = ['NOVA', 'VEGA', 'ORION', 'PRIME'];
  if (!validTiers.includes(params.tier.toUpperCase())) errors.push('Invalid agent tier selected');
  if (!['usdt', 'credit'].includes(params.paymentMethod)) errors.push('Invalid payment method selected');
  return { isValid: errors.length === 0, errors };
}
