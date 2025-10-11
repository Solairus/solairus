import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";

type WalletGateProps = {
  children: ReactNode;
};

const WalletGate = ({ children }: WalletGateProps) => {
  const { isConnected, openModal } = useWalletConnection();
  const guardEnabled = (
    (import.meta.env.VITE_ENABLE_WALLET_GUARD ?? "true")
      .toString()
      .toLowerCase()
      .trim() === "true"
  );

  // If guard is disabled via env, allow previewing dApp pages without gating
  if (!guardEnabled) {
    return <>{children}</>;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold">Connect Wallet to access dApp</h2>
          <p className="text-sm text-muted-foreground">Please connect your wallet to continue.</p>
          <div className="flex justify-center">
            <Button onClick={openModal} className="px-4 py-2">Connect Wallet</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default WalletGate;