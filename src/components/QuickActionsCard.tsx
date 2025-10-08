import React from "react";
import { Card } from "@/components/Card";

type QuickActionsCardProps = {
  onDeposit?: () => void;
  onClaim?: () => void;
};

export default function QuickActionsCard({ onDeposit, onClaim }: QuickActionsCardProps) {
  return (
    <Card title="Actions" subtitle="Quick">
      <div className="grid grid-cols-2 gap-3">
        <button
          className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-secondary transition border border-primary/40"
          onClick={onDeposit}
        >
          Deposit
        </button>
        <button
          className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-secondary transition border border-primary/40"
          onClick={onClaim}
        >
          Claim
        </button>
      </div>
    </Card>
  );
}