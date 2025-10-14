import { useCallback } from "react";
import { useWallet } from "@/contexts/wallet-context";

type Props = {
  className?: string;
};

const ConnectWalletButton = ({ className }: Props) => {
  const { isConnected, isConnecting, openConnectModal } = useWallet();

  const onClick = useCallback(async () => {
    if (isConnected || isConnecting) return;
    try {
      openConnectModal();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "";
      // Ignore common non-actionable cases: user closed modal or no wallet chosen.
      if (/QRCodeModalError|Closed|Abort|User canceled/i.test(msg)) {
        return;
      }
      // Otherwise, swallow to keep UI responsive; user can retry.
    }
  }, [isConnected, isConnecting, openConnectModal]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isConnecting}
      className={
        className ??
        "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
      }
    >
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
};

export default ConnectWalletButton;