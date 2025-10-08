import React, { useEffect, useMemo, useState } from "react";
import { fetchMarketBase, type MarketEntry } from "@/lib/market";

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

      {loading && (
        <div className="text-sm text-muted-foreground">Loading market data…</div>
      )}
      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && (
        <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {entries.map((e) => {
            const price = e.priceUsd ?? null;
            const mcap = e.marketCapUsd ?? null;
            const chg = e.change24hPercent ?? null;
            const changeColor = chg == null ? "text-muted-foreground" : chg >= 0 ? "text-emerald-500" : "text-red-500";
            return (
              <li key={e.id} className="flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  {e.iconUrl ? (
                    <img src={e.iconUrl} alt={e.symbol || e.name || ""} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{e.symbol || e.name}</span>
                      {e.name && (
                        <span className="text-xs text-muted-foreground">{e.name}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold">
                      {price == null ? "$-" : formatter.formatPrice(price)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground">
                      {mcap == null ? "Market cap: -" : `Market cap: ${formatter.fCompact.format(mcap)}`}
                    </div>
                    <div className={`text-xs ${changeColor}`}>
                      {chg == null ? "24h: -" : `24h: ${chg.toFixed(2)}%`}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}