import { useEffect, useCallback, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApiClient, API_CONFIG } from "@/config/service-endpoints";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { RefreshCw, ReceiptText } from "lucide-react";
import { useTransactionActions } from "@/hooks/use-transaction-actions";
import type { TxRecord } from "@/hooks/use-transaction-actions";

// Use the shared TxRecord type across this page
type TransactionRecord = TxRecord;

/**
 * TransactionHistory Page
 * Purpose: Display a backend-only list of transactions for the connected wallet.
 * Inputs: Connected wallet address via `useWalletConnection()`.
 * Outputs: Renders a paginated list of transactions with type, status, amount, and signature.
 * Core logic: Fetches `/api/transactions?wallet=<pubkey>` from the backend (protected by auth),
 *             formats amounts from micro-units, and renders a simple, readable history.
 * Notes:
 * - Strictly backend-driven: no contract/module imports; complies with "solairus-removed" directive.
 * - Mobile app-shell: page content fits inside the Dapp container at `/dapp/transaction-history`.
 */
export default function TransactionHistoryPage() {
  const { account } = useWalletConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const { triggerWithdrawalResolution } = useTransactionActions();
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  /** Minimal transaction type for UI rendering (module-level alias). */

  const formatAmount = (micro: number, decimals: number = 6) => {
    const denom = Math.pow(10, decimals);
    return (micro / denom).toFixed(2);
  };

  // Determine current cluster for Explorer links
  const getCurrentCluster = (): 'devnet' | 'mainnet-beta' | 'testnet' => {
    const override = localStorage.getItem("solana_cluster_override")?.toLowerCase();
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase();
    const effective = override || envCluster;
    return effective.startsWith("mainnet")
      ? 'mainnet-beta'
      : effective === 'testnet'
        ? 'testnet'
        : 'devnet';
  };

  const truncate = (str: string, start: number = 8, end: number = 8) => {
    if (!str) return '';
    return str.length > start + end
      ? `${str.slice(0, start)}…${str.slice(-end)}`
      : str;
  };

  const explorerTxUrl = (sig: string) => {
    const cluster = getCurrentCluster();
    const base = `https://explorer.solana.com/tx/${sig}`;
    return cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`;
  };

  const loadHistory = useCallback(async () => {
    if (!account) return;
    try {
      setIsLoading(true);
      setError(null);
      const baseUrl = API_CONFIG.getBaseUrl();
      const url = `${baseUrl}/transactions?wallet=${encodeURIComponent(account)}&limit=50`;
      const resp = await ApiClient.get(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Failed to fetch (${resp.status})`);
      }
      const json = (await resp.json()) as TransactionRecord[];
      setItems(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("[TransactionHistory] load error", err);
      setError("Failed to load transaction history");
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (account) loadHistory();
  }, [account, loadHistory]);

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <div className="flex items-center justify-start">
        <BackButton to="/dapp" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-bold">Transaction History</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Global data reload (does not run verification) */}
          <Button onClick={loadHistory} variant="outline" size="sm" disabled={isLoading || bulkUpdating}>
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            <span className="text-xs">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Empty / Not connected */}
      {!account && (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Connect your wallet to view your transactions.</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <Button onClick={loadHistory} variant="outline" size="sm" className="mt-2">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {account && !error && (
        <div className="space-y-3">
          {items.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">No transactions found.</p>
              </CardContent>
            </Card>
          )}

          {items.map((tx) => (
            <Card key={tx.id} className="bg-muted/30 border-border/40">
              <CardContent className="p-3 text-xs">
                {/* Line 1: [transaction type | amount | status | refresh] */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{labelForType(tx.type)}</span>
                  <span className="text-foreground">{formatAmount(tx.amount, tx.decimals)} USDT</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={badgeVariant(tx.status)} className="text-[10px] px-2 py-0.5">
                      {tx.status}
                    </Badge>
                    {shouldShowRefresh(tx) && (
                      <Button
                        aria-label="Update withdrawal status"
                        variant="outline"
                        className="shrink-0 h-6 px-2 text-[10px]"
                        disabled={resolvingId === tx.id}
                        onClick={async () => {
                          setResolvingId(tx.id);
                          try {
                            await triggerWithdrawalResolution(tx);
                            await loadHistory();
                          } finally {
                            setResolvingId(null);
                          }
                        }}
                      >
                        {resolvingId === tx.id ? 'Updating…' : 'Update'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Line 2: hash (signature) | uuid (orderId) | recipient (if withdrawal) */}
                <div className="flex items-center justify-between gap-2 mt-2 flex-nowrap">
                  <span className="font-mono text-muted-foreground truncate min-w-0">
                    {tx.signature ? (
                      <a
                        href={explorerTxUrl(tx.signature)}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {truncate(tx.signature, 10, 10)}
                      </a>
                    ) : (
                      'signature: none'
                    )}
                  </span>
                  <span className="font-mono text-muted-foreground truncate min-w-0">
                    {tx.order_id ? truncate(tx.order_id, 4, 4) : 'uuid: none'}
                  </span>
                  {(tx.type === 'user_withdrawal' || tx.type === 'role_withdrawal') && tx.recipient_wallet && (
                    <span className="font-mono text-muted-foreground truncate min-w-0">
                      {truncate(tx.recipient_wallet, 4, 4)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function labelForType(type: string) {
  switch (type) {
    case "license_activation":
      return "License Activation";
    case "agent_activation":
      return "Agent Activation";
    case "user_withdrawal":
      return "User Withdrawal";
    case "role_withdrawal":
      return "Role Withdrawal";
    default:
      return type;
  }
}

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
      return "default";
    case "pending":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

// Show the small Refresh button only for withdrawals that are pending or failed,
// and for failed ones only if metadata does not indicate refunded/finalized.
function shouldShowRefresh(tx: TransactionRecord): boolean {
  const isWithdrawal = tx.type === 'user_withdrawal' || tx.type === 'role_withdrawal';
  if (!isWithdrawal) return false;
  if (!(tx.status === 'pending' || tx.status === 'failed')) return false;
  if (!tx.order_id) return false; // needs order id for resolution endpoint

  if (tx.status === 'failed') {
    type WithdrawalMetadata = { refunded?: boolean; finalized?: boolean; checked?: boolean };
    const md = tx.metadata as WithdrawalMetadata | null | undefined;
    const refunded = md?.refunded === true;
    const finalized = md?.finalized === true;
    const checked = md?.checked === true;
    if (refunded || finalized || checked) return false; // hide if already checked
  }
  return true;
}