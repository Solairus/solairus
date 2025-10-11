import React from "react";
import type { MarketEntry } from "@/lib/market";
import MarketListItem from "./MarketListItem";

export default function MarketList({ entries, loading, error, formatPrice, fCompact }: {
  entries: MarketEntry[];
  loading: boolean;
  error: string | null;
  formatPrice: (v: number) => string;
  fCompact: Intl.NumberFormat;
}) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading market data…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  return (
    <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
      {entries.map((e) => (
        <MarketListItem key={e.id} e={e} formatPrice={formatPrice} fCompact={fCompact} />
      ))}
    </ul>
  );
}