import { ApiClient, API_CONFIG } from "@/config/service-endpoints";
import { toast } from "sonner";

export type TxRecord = {
  id: number;
  type: "license_activation" | "agent_activation" | "user_withdrawal" | "role_withdrawal";
  status: "pending" | "confirmed" | "failed" | string;
  signature: string | null;
  order_id: string | null;
  order_ref: string | null;
  initiator_wallet: string;
  recipient_wallet: string | null;
  amount: number;
  mint_address: string;
  decimals: number;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * useTransactionActions
 * Purpose: Provide modular, pluggable actions for transaction dispute/verification flows.
 * Inputs: none
 * Outputs: action functions for verify, refund (withdrawal), and reapply license activation
 * Notes:
 * - Keeps UI pages simple by centralizing side-effect logic
 * - Uses existing backend endpoints; no new public APIs are exposed
 */
export function useTransactionActions() {
  const baseUrl = API_CONFIG.getBaseUrl();

  const refreshTransactions = async (wallet: string) => {
    const url = `${baseUrl}/transactions?wallet=${encodeURIComponent(wallet)}`;
    const resp = await ApiClient.get(url);
    return (await resp.json()) as TxRecord[];
  };

  const verifySignature = async (record: TxRecord) => {
    if (!record.signature) {
      toast.info("No signature recorded to verify");
      return null;
    }
    const url = `${baseUrl}/transactions/verify`;
    const resp = await ApiClient.post(url, { signature: record.signature });
    const json = await resp.json();
    toast.success("Verification attempted");
    return json;
  };

  const triggerWithdrawalResolution = async (record: TxRecord) => {
    if (!record.order_id) {
      toast.error("Missing order ID for withdrawal resolution");
      return null;
    }
    const url = `${baseUrl}/transactions/${record.order_id}`;
    const resp = await ApiClient.get(url);
    const json = await resp.json();
    if (json?.refunded) {
      toast.success("Withdrawal refunded (expired and unsigned)");
    } else if (json?.finalized) {
      toast.success("Withdrawal finalized");
    } else {
      toast.info("Withdrawal status checked");
    }
    return json;
  };

  const reapplyLicenseActivation = async (record: TxRecord, initiatorWallet: string) => {
    const url = `${baseUrl}/transactions/reapply-license`;
    const payload: Record<string, unknown> = { initiatorWallet };
    if (record.order_id) payload.orderId = record.order_id;
    if (record.signature) payload.signature = record.signature;
    const resp = await ApiClient.post(url, payload);
    const json = await resp.json();
    if (json?.record) {
      toast.success("Activation reapplied");
    } else {
      toast.info("Activation check complete");
    }
    return json;
  };

  return {
    refreshTransactions,
    verifySignature,
    triggerWithdrawalResolution,
    reapplyLicenseActivation,
  };
}