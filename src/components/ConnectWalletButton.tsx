import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Props = {
  className?: string;
};

const ConnectWalletButton = ({ className }: Props) => {
  const { connected, connecting, wallets, select, connect } = useWallet();

  const onClick = useCallback(async () => {
    if (connected || connecting) return;
    const byName = (name: string) => wallets.find((w) => w.adapter.name === name);

    const wc = byName("WalletConnect");
    const phantom = byName("Phantom");
    const solflare = byName("Solflare");

    const target = wc ?? phantom ?? solflare ?? null;
    if (!target) return;

    try {
      // Select preferred wallet, then connect.
      select(target.adapter.name);
      // Yield a microtask to allow selection state to settle before connect.
      await Promise.resolve();
      await connect();
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? "";
      const msg = (e as { message?: string })?.message ?? "";
      // Ignore common non-actionable cases: user closed modal or no wallet chosen.
      if (
        name === "WalletNotSelectedError" ||
        /QRCodeModalError|Closed|Abort|User canceled/i.test(msg)
      ) {
        return;
      }
      // Otherwise, swallow to keep UI responsive; user can retry.
    }
  }, [connected, connecting, wallets, select, connect]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={connecting}
      className={
        className ??
        "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
      }
    >
      {connecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
};

export default ConnectWalletButton;