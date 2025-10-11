import React from "react";
import VaultBalanceCard from "@/components/VaultBalanceCard";
import WalletActionsCard from "@/components/WalletActionsCard";
import NewsTickerCard from "@/components/NewsTickerCard";
import AgentsOutcomesCard from "@/components/AgentsOutcomesCard";

export default function DappHome() {
  return (
    <div className="space-y-4">
      <VaultBalanceCard />
      <WalletActionsCard />
      <NewsTickerCard />
      <AgentsOutcomesCard />
    </div>
  );
}