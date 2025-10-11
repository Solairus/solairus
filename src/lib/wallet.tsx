import { ReactNode, useMemo, useState, useEffect } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

type WalletConnectionProviderProps = {
  children: ReactNode;
};

export const WalletConnectionProvider = ({ children }: WalletConnectionProviderProps) => {
  const clusterOverride = (() => {
    try {
      return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase();
    } catch {
      return "";
    }
  })();
  const clusterStr = (clusterOverride || (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet")).toLowerCase();
  const network =
    clusterStr === "mainnet" || clusterStr === "mainnet-beta"
      ? WalletAdapterNetwork.Mainnet
      : clusterStr === "testnet"
      ? WalletAdapterNetwork.Testnet
      : WalletAdapterNetwork.Devnet;

  const endpoint = clusterApiUrl(
    network === WalletAdapterNetwork.Mainnet
      ? "mainnet-beta"
      : network === WalletAdapterNetwork.Devnet
      ? "devnet"
      : "testnet"
  );

  // WalletConnect adapter with fallback across comma-separated project IDs.
  const getProjectIds = (): string[] => {
    const raw = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => !localStorage.getItem(`wc_pid_expired_${id}`));
  };

  const wcNetwork: WalletAdapterNetwork.Mainnet | WalletAdapterNetwork.Devnet =
    network === WalletAdapterNetwork.Mainnet
      ? WalletAdapterNetwork.Mainnet
      : WalletAdapterNetwork.Devnet; // map testnet to devnet for adapter support

  const createWcAdapter = (projectId: string) =>
    new WalletConnectWalletAdapter({
      network: wcNetwork,
      options: {
        projectId,
        metadata: {
          name: "Solairus",
          description: "Solana dApp",
          url: window.location.origin,
          icons: [window.location.origin + "/logo.png"],
        },
      },
    });

  const [wcProjectId, setWcProjectId] = useState<string | null>(() => {
    const ids = getProjectIds();
    if (!ids.length) return null;
    const saved = Number(localStorage.getItem("wc_pid_idx") ?? "0") || 0;
    const idx = Math.min(Math.max(saved, 0), ids.length - 1);
    return ids[idx];
  });

  const [wcAdapter, setWcAdapter] = useState<WalletConnectWalletAdapter | null>(() =>
    wcProjectId ? createWcAdapter(wcProjectId) : null
  );

  const rotateProjectId = (expireCurrent: boolean) => {
    const current = wcProjectId;
    const ids = getProjectIds();
    if (expireCurrent && current) {
      try {
        localStorage.setItem(`wc_pid_expired_${current}`, "1");
      } catch (e) {
        // ignore storage errors (private mode or disabled)
        void e;
      }
    }
    const refreshed = getProjectIds();
    const next = refreshed[0] ?? null;
    setWcProjectId(next);
    if (next) {
      try {
        const allRaw = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const indexInAll = allRaw.findIndex((id) => id === next);
        if (indexInAll >= 0) localStorage.setItem("wc_pid_idx", String(indexInAll));
      } catch (e) {
        // ignore storage errors (private mode or disabled)
        void e;
      }
      setWcAdapter(createWcAdapter(next));
    } else {
      setWcAdapter(null);
    }
  };

  useEffect(() => {
    if (!wcAdapter) return;
    const onError = (err: unknown) => {
      const msg = (() => {
        if (typeof err === "string") return err;
        if (typeof err === "object" && err !== null) {
          const maybe = (err as { message?: unknown }).message;
          if (typeof maybe === "string") return maybe;
        }
        return "";
      })();
      // Fallback for rate limit or project issues
      if (/rate|limit|429|project|invalid|unauthorized/i.test(msg)) {
        rotateProjectId(true);
      }
    };
    wcAdapter.on("error", onError);
    return () => {
      wcAdapter.off("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcAdapter]);

  const wallets = useMemo(() => {
    const base = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
    return wcAdapter ? [...base, wcAdapter] : base;
  }, [wcAdapter]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};