import React, { useEffect, useMemo, useState } from "react";
import { fetchMarketBase, type MarketEntry } from "@/lib/market";
import MarketList from "./MarketList";

export default function DappMarket() {
  const [entries, setEntries] = useState<MarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMarketBase();
        if (!cancelled) setEntries(data);
      } catch (e) {
        if (!cancelled) setError("Failed to load market data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatter = useMemo(() => {
    const fCompact = new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    });
    const formatPrice = (v: number) => {
      const underOne = v < 1;
      const fmt = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: underOne ? 2 : 2,
        maximumFractionDigits: underOne ? 6 : 2,
      });
      return fmt.format(v);
    };
    return { formatPrice, fCompact };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Market</h2>
        <span className="text-xs text-muted-foreground">Top 20 · CoinMarketCap</span>
      </div>

      <MarketList
        entries={entries}
        loading={loading}
        error={error}
        formatPrice={formatter.formatPrice}
        fCompact={formatter.fCompact}
      />
    </div>
  );
}