import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useWallet } from "@/contexts/wallet-context";

export interface UseBalanceResult {
  balanceMicro: number | null; // USDT base units (6 decimals)
  balanceDisplay: string; // e.g., "12.34 USDT"
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * useBalance
 * Purpose: Read USDT balance for the connected wallet exactly once on mount.
 * Inputs:
 * - Wallet context: `publicKey` (owner), `anchorProvider` (connection)
 * - USDT mint from environment: `VITE_USDT_MINT` (mainnet), `VITE_USDT_MINT_DEVNET` (devnet)
 * Output:
 * - `balanceMicro`: number in micro USDT (base units)
 * - `balanceDisplay`: string formatted to 2 decimals with suffix
 * - `refresh`: manual trigger to re-read (no polling)
 * Core Logic:
 * - Determine effective cluster (localStorage override -> env fallback)
 * - Select mint by cluster and derive ATA for `publicKey`
 * - If ATA exists, use `getTokenAccountBalance`; else return 0
 */
export function useBalance(): UseBalanceResult {
  const { publicKey, provider, isConnected } = useWallet();

  const [balanceMicro, setBalanceMicro] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const formatUsdtDisplay = useCallback((micro: number | null): string => {
    if (micro === null) return "N/A";
    try {
      const raw = String(micro);
      const digits = raw.replace(/[^0-9]/g, "");
      const padded = digits.padStart(7, "0");
      const whole = padded.slice(0, -6) || "0";
      const fractional2dp = padded.slice(-6, -4);
      return `${Number(whole).toLocaleString("en-US")}.${fractional2dp} USDT`;
    } catch {
      return "0.00 USDT";
    }
  }, []);

  const balanceDisplay = useMemo(() => formatUsdtDisplay(balanceMicro), [balanceMicro, formatUsdtDisplay]);

  const resolveUsdtMint = useCallback((): PublicKey => {
    // Determine cluster using local override first, then env fallback
    let override = "";
    try {
      override = (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase();
    } catch {
      // ignore localStorage access errors in non-browser/test environments
    }
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase();
    const effective = override || envCluster;
    const normalized = effective.startsWith("mainnet") ? "mainnet-beta" : "devnet";

    const mintStr = normalized === "mainnet-beta"
      ? (import.meta.env.VITE_USDT_MINT as string)
      : (import.meta.env.VITE_USDT_MINT_DEVNET as string);

    if (!mintStr) {
      throw new Error("USDT mint not configured in environment (.env)");
    }
    return new PublicKey(mintStr);
  }, []);

  const refresh = useCallback(async () => {
    if (!isConnected || !publicKey || !provider) return;

    try {
      setIsLoading(true);
      setError(null);

      const mint = resolveUsdtMint();
      const ata = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const connection = provider;

      // Check ATA existence; if missing, treat as zero balance without creating
      const info = await connection.getAccountInfo(ata);
      if (!info) {
        setBalanceMicro(0);
        return;
      }

      const bal = await connection.getTokenAccountBalance(ata);
      const amountStr = bal?.value?.amount ?? "0"; // base units (string)
      const amount = Number(amountStr);
      setBalanceMicro(Number.isFinite(amount) ? amount : 0);
    } catch (err) {
      console.error("Failed to read USDT balance:", err);
      setError(err instanceof Error ? err.message : "Failed to read USDT balance");
      setBalanceMicro(null);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, publicKey, provider, resolveUsdtMint]);

  // Fetch exactly once on mount of the page/component using this hook
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refresh();
    })();
    return () => { mounted = false; };
    // Intentionally exclude dependencies to avoid re-runs; call refresh manually if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { balanceMicro, balanceDisplay, isLoading, error, refresh };
}