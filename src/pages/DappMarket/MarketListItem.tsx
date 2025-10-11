import type { MarketEntry } from "@/lib/market";

export default function MarketListItem({ e, formatPrice, fCompact }: { e: MarketEntry; formatPrice: (v: number) => string; fCompact: Intl.NumberFormat }) {
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
            {e.name && <span className="text-xs text-muted-foreground">{e.name}</span>}
          </div>
          <div className="text-sm font-semibold">{price == null ? "$-" : formatPrice(price)}</div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-xs text-muted-foreground">{mcap == null ? "Market cap: -" : `Market cap: ${fCompact.format(mcap)}`}</div>
          <div className={`text-xs ${changeColor}`}>{chg == null ? "24h: -" : `24h: ${chg.toFixed(2)}%`}</div>
        </div>
      </div>
    </li>
  );
}