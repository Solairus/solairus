export type MarketEntry = {
  id: string;
  name: string;
  symbol: string;
  priceUsd: number | null;
  change24hPercent: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  listedAt?: number | null;
  iconUrl?: string | null;
  tokenAddress?: string | null;
};

// Narrow types for external APIs to avoid using `any`
type DexScreenerPair = {
  pairAddress?: string;
  baseToken?: { address?: string; id?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string; id?: string; symbol?: string; name?: string };
  chainId?: string;
  priceUsd?: number | string | null;
  priceChange?: { h24?: number | string | null };
  priceChange24h?: number | string | null;
  volume?: { h24?: number | string | null };
  volume24h?: number | string | null;
  fdv?: number | string | null;
  listedAt?: number | null;
  info?: { imageUrl?: string | null };
  logoURI?: string | null;
};

type GeckoTerminalPool = {
  id?: string;
  attributes?: {
    base_token_symbol?: string;
    base_token_address?: string;
    name?: string;
    price_usd?: number | string | null;
    price?: number | string | null;
    price_change_24h_percent?: number | string | null;
    fdv_usd?: number | string | null;
    market_cap_usd?: number | string | null;
    volume_usd_24h?: number | string | null;
    base_token_logo_url?: string | null;
    logo_url?: string | null;
    image_url?: string | null;
  };
};

type DexTokenProfile = {
  chainId?: string;
  tokenAddress?: string;
  icon?: string | null;
  name?: string;
  symbol?: string;
};

async function fetchDexTokenProfiles(): Promise<Map<string, string>> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
    if (!res.ok) throw new Error(`dex-profiles ${res.status}`);
    const data = (await res.json()) as DexTokenProfile[];
    const map = new Map<string, string>();
    for (const p of data) {
      const chain = (p.chainId || "").toLowerCase();
      const addr = (p.tokenAddress || "").toLowerCase();
      const icon = p.icon || "";
      if (chain && addr && icon) {
        map.set(`${chain}:${addr}`, icon);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchDexTokenProfilesList(): Promise<DexTokenProfile[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
    if (!res.ok) throw new Error(`dex-profiles ${res.status}`);
    const data = (await res.json()) as DexTokenProfile[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Default tokens to display, enforced against USDT quotes where available
const DEFAULT_SYMBOLS = ["SOL", "BTC", "USDT", "BNB", "ETH", "DOGE"] as const;

// Top 20 widely-known tokens (symbols). Used when sourcing markets from GeckoTerminal.
const TOP_SYMBOLS_20 = [
  "SOL",
  "BTC",
  "ETH",
  "USDT",
  "USDC",
  "BNB",
  "DOGE",
  "XRP",
  "ADA",
  "TRX",
  "LINK",
  "MATIC",
  "TON",
  "DOT",
  "LTC",
  "SHIB",
  "AVAX",
  "BCH",
  "OP",
  "ARB",
] as const;

// Some tokens have undergone ticker migrations; provide aliases to ensure quotes resolve.
// Keys and values should be uppercase.
const SYMBOL_ALIASES: Record<string, string[]> = {
  MATIC: ["POL"],
};

// Slug mappings for tokens where CMC primarily serves data under a new slug.
const SYMBOL_SLUGS: Record<string, string[]> = {
  MATIC: ["polygon-ecosystem-token"],
};

type GeckoTokenInfo = {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
    image_url?: string | null;
  };
};

async function fetchGeckoTokenIcons(network: string = "solana"): Promise<Map<string, string>> {
  try {
    const url = `https://api.geckoterminal.com/api/v2/tokens/info_recently_updated?network=${encodeURIComponent(network)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`gecko-token-icons ${res.status}`);
    const json = await res.json();
    const data = (json?.data ?? []) as GeckoTokenInfo[];
    const map = new Map<string, string>();
    for (const t of data) {
      const addr = (t?.attributes?.address || "").toLowerCase();
      const img = t?.attributes?.image_url || "";
      if (addr && img) map.set(addr, img);
    }
    return map;
  } catch {
    return new Map();
  }
}

type CmcInfoItem = {
  logo?: string | null;
};

async function fetchCmcIconsBySymbols(symbols: string[]): Promise<Map<string, string>> {
  if (!symbols.length) return new Map();
  try {
    const qs = encodeURIComponent(symbols.join(","));
    const url = `/cmc/v1/cryptocurrency/info?symbol=${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cmc-info ${res.status}`);
    const json = await res.json();
    const data = (json?.data ?? {}) as Record<string, CmcInfoItem>;
    const map = new Map<string, string>();
    for (const [sym, info] of Object.entries(data)) {
      const logo = info?.logo || "";
      if (logo) map.set(sym.toUpperCase(), logo);
    }
    // Fallback: fetch by slug for symbols missing logos
    const missing = symbols.map((s) => s.toUpperCase()).filter((s) => !map.has(s));
    const slugs = missing.flatMap((s) => SYMBOL_SLUGS[s] ?? []);
    if (slugs.length) {
      try {
        const slu = encodeURIComponent(Array.from(new Set(slugs)).join(","));
        const u2 = `/cmc/v1/cryptocurrency/info?slug=${slu}`;
        const r2 = await fetch(u2);
        if (r2.ok) {
          const j2 = await r2.json();
          const d2 = (j2?.data ?? {}) as Record<string, CmcInfoItem>;
          const symToSlug = new Map<string, string>();
          for (const s of missing) symToSlug.set(s, (SYMBOL_SLUGS[s] ?? [])[0] ?? "");
          for (const [slug, info] of Object.entries(d2)) {
            for (const [sym, targetSlug] of symToSlug.entries()) {
              if (slug === targetSlug) {
                const logo = info?.logo || "";
                if (logo) map.set(sym, logo);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

// CoinMarketCap quotes types
type CmcQuoteUSD = {
  price?: number | null;
  percent_change_24h?: number | null;
  market_cap?: number | null;
  volume_24h?: number | null;
  last_updated?: string | null;
};
type CmcQuoteItem = {
  id?: number;
  name?: string;
  symbol?: string;
  date_added?: string | null;
  last_updated?: string | null;
  quote?: { USD?: CmcQuoteUSD };
};

type CmcMapItem = {
  id?: number;
  name?: string;
  symbol?: string;
  slug?: string;
};

async function fetchCmcIdsBySymbols(symbols: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!symbols.length) return map;
  try {
    const qs = encodeURIComponent(symbols.join(","));
    const url = `/cmc/v1/cryptocurrency/map?symbol=${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cmc-map ${res.status}`);
    const json = await res.json();
    const data = (json?.data ?? []) as CmcMapItem[];
    for (const item of data) {
      const sym = String(item?.symbol || "").toUpperCase();
      const id = item?.id;
      if (sym && typeof id === "number") map.set(sym, id);
    }
  } catch {
    // ignore failures; return partial
  }
  return map;
}

async function fetchCmcQuoteById(id: number): Promise<CmcQuoteItem | null> {
  try {
    const url = `/cmc/v1/cryptocurrency/quotes/latest?id=${id}&convert=USD`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cmc-quote-id ${res.status}`);
    const json = await res.json();
    const data = (json?.data ?? {}) as Record<string, CmcQuoteItem>;
    const first = Object.values(data)[0] as CmcQuoteItem | undefined;
    return first ?? null;
  } catch {
    return null;
  }
}

async function fetchCmcQuotesBySymbols(symbols: string[]): Promise<Map<string, CmcQuoteItem>> {
  const map = new Map<string, CmcQuoteItem>();
  if (!symbols.length) return map;
  try {
    const upcaseSymbols = symbols.map((s) => s.toUpperCase());
    const requestSet = new Set<string>(upcaseSymbols);
    for (const sym of upcaseSymbols) {
      const aliases = SYMBOL_ALIASES[sym] ?? [];
      for (const a of aliases) requestSet.add(a.toUpperCase());
    }
    const qs = encodeURIComponent(Array.from(requestSet).join(","));
    const url = `/cmc/v1/cryptocurrency/quotes/latest?symbol=${qs}&convert=USD`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cmc-quotes ${res.status}`);
    const json = await res.json();
    const data = (json?.data ?? {}) as Record<string, CmcQuoteItem>;
    // Populate map using requested base symbols, falling back to aliases when needed.
    for (const sym of upcaseSymbols) {
      let item = data[sym];
      if (!item) {
        const aliases = SYMBOL_ALIASES[sym] ?? [];
        for (const a of aliases) {
          const candidate = data[a.toUpperCase()];
          if (candidate) {
            item = candidate;
            break;
          }
        }
      }
      if (item) map.set(sym, item);
    }
  } catch {
    // ignore failures; return partial/empty map
  }

  // Try slug-based quotes for any remaining missing symbols
  const stillMissing = symbols.map((s) => s.toUpperCase()).filter((s) => !map.has(s));
  if (stillMissing.length) {
    const slugList = Array.from(new Set(stillMissing.flatMap((s) => SYMBOL_SLUGS[s] ?? [])));
    if (slugList.length) {
      try {
        const qsSlug = encodeURIComponent(slugList.join(","));
        const urlSlug = `/cmc/v1/cryptocurrency/quotes/latest?slug=${qsSlug}&convert=USD`;
        const resSlug = await fetch(urlSlug);
        if (resSlug.ok) {
          const jsonSlug = await resSlug.json();
          const dataSlug = (jsonSlug?.data ?? {}) as Record<string, CmcQuoteItem>;
          const symToSlug = new Map<string, string>();
          for (const s of stillMissing) {
            const slugs = SYMBOL_SLUGS[s] ?? [];
            if (slugs.length) symToSlug.set(s, slugs[0]);
          }
          for (const [slug, item] of Object.entries(dataSlug)) {
            for (const [sym, targetSlug] of symToSlug.entries()) {
              if (slug === targetSlug && item) map.set(sym, item);
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Robust fallback: for any symbol still missing, resolve ID via map and fetch by ID
  const missing = symbols
    .map((s) => s.toUpperCase())
    .filter((s) => !map.has(s));
  if (missing.length) {
    try {
      // try both base symbols and their aliases
      const aliasExpanded = Array.from(
        new Set(
          missing.flatMap((s) => [s, ...(SYMBOL_ALIASES[s] ?? [])].map((x) => x.toUpperCase()))
        )
      );
      const idMap = await fetchCmcIdsBySymbols(aliasExpanded);
      for (const s of missing) {
        // prefer ID of base symbol; otherwise try alias IDs
        const baseId = idMap.get(s);
        const aliasIds = (SYMBOL_ALIASES[s] ?? []).map((a) => idMap.get(a.toUpperCase())).filter((v): v is number => typeof v === "number");
        const id = baseId ?? aliasIds[0];
        if (typeof id === "number") {
          const byId = await fetchCmcQuoteById(id);
          if (byId) map.set(s, byId);
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

// CoinGecko fallback: build a symbol -> { price, market_cap, image } map for top markets
type GeckoMarketItem = {
  symbol?: string;
  current_price?: number;
  market_cap?: number;
  image?: string;
};

async function fetchGeckoMarketsBySymbols(symbols: string[]): Promise<Map<string, GeckoMarketItem>> {
  const map = new Map<string, GeckoMarketItem>();
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`coingecko-markets ${res.status}`);
    const arr = (await res.json()) as GeckoMarketItem[];
    for (const item of arr) {
      const sym = String(item?.symbol || "").toUpperCase();
      if (!sym) continue;
      map.set(sym, {
        symbol: sym,
        current_price: typeof item?.current_price === "number" ? item.current_price : null,
        market_cap: typeof item?.market_cap === "number" ? item.market_cap : null,
        image: item?.image || undefined,
      });
    }
  } catch {
    // ignore
  }
  // Filter to requested set
  const resMap = new Map<string, GeckoMarketItem>();
  for (const s of symbols.map((x) => x.toUpperCase())) {
    const it = map.get(s);
    if (it) resMap.set(s, it);
  }
  return resMap;
}


async function fetchDexScreener(): Promise<MarketEntry[]> {
  // Icons map keyed by `${chain}:${address}` from token-profiles
  const iconMap = await fetchDexTokenProfiles();

  // Helper to fetch best Solana pair via search for a given symbol, enforcing USDT first, USDC fallback
  async function searchBestPairForSymbol(symbol: string): Promise<DexScreenerPair | null> {
    const queries = [`${symbol}/USDT`, `${symbol}/USDC`, symbol];
    for (const q of queries) {
      try {
        const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const pairs = (json?.pairs ?? []) as DexScreenerPair[];
        const solPairs = pairs.filter((p) => (p?.chainId || "").toLowerCase() === "solana");
        if (!solPairs.length) continue;
        const scored = solPairs.map((p) => {
          const vol = typeof p?.volume?.h24 === "number" ? p.volume.h24 : p?.volume?.h24 ? Number(p.volume.h24) : (typeof p?.volume24h === "number" ? p.volume24h : p?.volume24h ? Number(p.volume24h) : 0);
          const fdv = typeof p?.fdv === "number" ? p.fdv : p?.fdv ? Number(p.fdv) : 0;
          const qt = String(p?.quoteToken?.symbol || "");
          const isUSDT = /USDT/i.test(qt);
          const isUSDC = /USDC|USD/i.test(qt);
          const score = vol * 1 + fdv * 1e-6 + (isUSDT ? 1e9 : 0) + (isUSDC ? 1e8 : 0);
          return { p, score };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.p || null;
      } catch {
        continue;
      }
    }
    return null;
  }

  const entries: MarketEntry[] = [];
  await Promise.all(
    DEFAULT_SYMBOLS.map(async (symbol) => {
      const best = await searchBestPairForSymbol(symbol);
      if (!best) return;
      const base = best?.baseToken ?? {};
      const priceUsd = typeof best?.priceUsd === "string" ? parseFloat(best.priceUsd) : best?.priceUsd ?? null;
      const change24 = best?.priceChange?.h24 ?? best?.priceChange24h ?? null;
      const volume24 = best?.volume?.h24 ?? best?.volume24h ?? null;
      const fdv = best?.fdv ?? null;
      const listedAt = best?.listedAt ?? null;
      const iconUrlDirect = (best?.info?.imageUrl || best?.logoURI) ?? null;
      const chain = (best?.chainId || "").toLowerCase();
      const addrLower = (base?.address || base?.id || "").toLowerCase();
      const iconFromProfiles = (chain && addrLower) ? iconMap.get(`${chain}:${addrLower}`) ?? null : null;
      const iconUrl = iconUrlDirect ?? iconFromProfiles ?? null;
      entries.push({
        id: best?.pairAddress || `${base?.address || base?.id || symbol}-${best?.chainId || "sol"}`,
        name: base?.name || symbol,
        symbol: base?.symbol || symbol,
        priceUsd: typeof priceUsd === "number" ? priceUsd : priceUsd ? Number(priceUsd) : null,
        change24hPercent: typeof change24 === "number" ? change24 : change24 ? Number(change24) : null,
        marketCapUsd: typeof fdv === "number" ? fdv : fdv ? Number(fdv) : null,
        volume24hUsd: typeof volume24 === "number" ? volume24 : volume24 ? Number(volume24) : null,
        listedAt: typeof listedAt === "number" ? listedAt : null,
        iconUrl,
        tokenAddress: base?.address || base?.id || null,
      });
    })
  );

  // Deduplicate by token address or symbol, prefer higher market cap then volume
  const byKey = new Map<string, MarketEntry>();
  for (const e of entries) {
    const key = (e.tokenAddress ? String(e.tokenAddress).toLowerCase() : (e.symbol || e.name || "").toLowerCase());
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, e);
    } else {
      const existingScore = (existing.marketCapUsd ?? 0) * 1 + (existing.volume24hUsd ?? 0) * 1e-3;
      const newScore = (e.marketCapUsd ?? 0) * 1 + (e.volume24hUsd ?? 0) * 1e-3;
      if (newScore > existingScore) byKey.set(key, e);
    }
  }
  return Array.from(byKey.values());
}

async function fetchGeckoTerminal(): Promise<MarketEntry[]> {
  // Gather multiple pages of pools to increase coverage for known symbols
  const pools: GeckoTerminalPool[] = [];
  for (let page = 1; page <= 4; page++) {
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/pools?page=${page}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const batch = (data?.data ?? []) as GeckoTerminalPool[];
      if (Array.isArray(batch) && batch.length) pools.push(...batch);
    } catch {
      // continue on error
    }
  }
  if (!pools.length) {
    // Fallback to first page
    const res = await fetch("https://api.geckoterminal.com/api/v2/networks/solana/pools", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`geckoterminal ${res.status}`);
    const data = await res.json();
    const batch = (data?.data ?? []) as GeckoTerminalPool[];
    if (Array.isArray(batch) && batch.length) pools.push(...batch);
  }
  const entries: MarketEntry[] = pools.map((p: GeckoTerminalPool) => {
    const attr = p?.attributes ?? {};
    const baseSymbol = attr?.base_token_symbol || attr?.name || "";
    const priceUsd = attr?.price_usd ?? attr?.price ?? null;
    const change24 = attr?.price_change_24h_percent ?? null;
    const marketCap = attr?.fdv_usd ?? attr?.market_cap_usd ?? null;
    const volume24 = attr?.volume_usd_24h ?? null;
    const iconUrl = attr?.base_token_logo_url || attr?.logo_url || attr?.image_url || null;
    const tokenAddr = attr?.base_token_address || null;
    return {
      id: p?.id || baseSymbol,
      // Enforce base token naming only (no pool/pair names)
      name: baseSymbol,
      symbol: baseSymbol,
      priceUsd: typeof priceUsd === "number" ? priceUsd : priceUsd ? Number(priceUsd) : null,
      change24hPercent: typeof change24 === "number" ? change24 : change24 ? Number(change24) : null,
      marketCapUsd: typeof marketCap === "number" ? marketCap : marketCap ? Number(marketCap) : null,
      volume24hUsd: typeof volume24 === "number" ? volume24 : volume24 ? Number(volume24) : null,
      listedAt: null,
      iconUrl,
      tokenAddress: tokenAddr,
    };
  });
  // Build symbol -> address map from GeckoTerminal recently updated tokens to fill missing addresses
  try {
    const infoMap = await fetchGeckoTokenIcons("solana");
    const symbolToAddr = new Map<string, string>();
    // fetchGeckoTokenIcons returns address->image map today; we need to re-fetch full info for symbols
    // To keep Gecko-only, we query the same endpoint again and read symbol/address
    const url = `https://api.geckoterminal.com/api/v2/tokens/info_recently_updated?network=solana`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (r.ok) {
      const j = await r.json();
      const arr = (j?.data ?? []) as GeckoTokenInfo[];
      for (const t of arr) {
        const sym = (t?.attributes?.symbol || "").toUpperCase();
        const addr = (t?.attributes?.address || "").trim();
        if (sym && addr) symbolToAddr.set(sym, addr);
      }
    }
    // Attach addresses for entries missing tokenAddress using symbol mapping
    for (const e of entries) {
      if (!e.tokenAddress && e.symbol) {
        const addr = symbolToAddr.get(e.symbol.toUpperCase());
        if (addr) e.tokenAddress = addr;
      }
    }
  } catch {
    // ignore mapping failures
  }
  // Enrich using GeckoTerminal token info per address and fallback to pools endpoint for missing fields
  const uniqueAddrs = Array.from(
    new Map(
      entries
        .filter((e) => !!e.tokenAddress)
        .map((e) => [String(e.tokenAddress).toLowerCase(), String(e.tokenAddress)])
    ).values()
  );
  if (uniqueAddrs.length) {
    await Promise.all(
      uniqueAddrs.map(async (addrOriginal) => {
        try {
          const u = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${addrOriginal}`;
          const r = await fetch(u, { headers: { accept: "application/json" } });
          let img: string | null = null;
          let pu: number | string | null = null;
          let ch: number | string | null = null;
          let mc: number | string | null = null;
          if (r.ok) {
            const j = await r.json();
            const attrs = j?.data?.attributes ?? {};
            img = attrs?.image_url || null;
            pu = attrs?.price_usd ?? null;
            ch = attrs?.price_change_24h_percent ?? null;
            mc = (attrs?.fdv_usd ?? attrs?.market_cap_usd) ?? null;
          }
          // Fallback: pools endpoint for the token
          let fallbackAttrs: GeckoTerminalPool["attributes"] | null = null;
          if (pu == null || mc == null || img == null) {
            try {
              const up = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${addrOriginal}/pools`;
              const rp = await fetch(up, { headers: { accept: "application/json" } });
              if (rp.ok) {
                const jp = await rp.json();
                const pools2 = (jp?.data ?? []) as GeckoTerminalPool[];
                fallbackAttrs = pools2[0]?.attributes ?? null;
              }
            } catch (e) {
              if (typeof console !== "undefined") {
                console.warn("gecko pools fallback fetch failed", addrOriginal, e);
              }
            }
          }
          for (const e of entries) {
            if ((e.tokenAddress || "").toLowerCase() === addrOriginal.toLowerCase()) {
              const imgFinal = img ?? fallbackAttrs?.base_token_logo_url ?? fallbackAttrs?.logo_url ?? fallbackAttrs?.image_url ?? null;
              const puFinal = pu ?? fallbackAttrs?.price_usd ?? fallbackAttrs?.price ?? null;
              const chFinal = ch ?? fallbackAttrs?.price_change_24h_percent ?? null;
              const mcFinal = mc ?? fallbackAttrs?.fdv_usd ?? fallbackAttrs?.market_cap_usd ?? null;
              if (!e.iconUrl && imgFinal) e.iconUrl = imgFinal;
              if (puFinal != null) e.priceUsd = typeof puFinal === "number" ? puFinal : puFinal ? Number(puFinal) : e.priceUsd;
              if (chFinal != null) e.change24hPercent = typeof chFinal === "number" ? chFinal : chFinal ? Number(chFinal) : e.change24hPercent;
              if (mcFinal != null) e.marketCapUsd = typeof mcFinal === "number" ? mcFinal : mcFinal ? Number(mcFinal) : e.marketCapUsd;
            }
          }
        } catch (err) {
          if (typeof console !== "undefined") console.warn("gecko token enrichment failed", addrOriginal, err);
        }
      })
    );
  }
  // Deduplicate by token address (or symbol) to avoid multiple pools per token
  const byKey = new Map<string, MarketEntry>();
  for (const e of entries) {
    const key = (e.tokenAddress ? String(e.tokenAddress).toLowerCase() : (e.symbol || e.name || "").toLowerCase());
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, e);
    } else {
      const existingScore = (existing.marketCapUsd ?? 0) * 1 + (existing.volume24hUsd ?? 0) * 1e-3;
      const newScore = (e.marketCapUsd ?? 0) * 1 + (e.volume24hUsd ?? 0) * 1e-3;
      if (newScore > existingScore) byKey.set(key, e);
    }
  }
  const list = Array.from(byKey.values());

  // Filter to the top 20 known symbols, case-insensitive
  const setTop = new Set(TOP_SYMBOLS_20.map((s) => s.toUpperCase()));
  const topKnown = list.filter((e) => setTop.has((e.symbol || e.name || "").toUpperCase()));

  // If we are short of 20, backfill with highest volume entries that aren't already included
  if (topKnown.length < TOP_SYMBOLS_20.length) {
    const have = new Set(topKnown.map((e) => (e.symbol || e.name || "").toUpperCase()));
    const backfill = list
      .filter((e) => !have.has((e.symbol || e.name || "").toUpperCase()))
      .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
      .slice(0, TOP_SYMBOLS_20.length - topKnown.length);
    topKnown.push(...backfill);
  }

  // CoinGecko image mapping by symbol (top 250 by market cap)
  try {
    const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
    const cgRes = await fetch(cgUrl);
    if (cgRes.ok) {
      const cgJson = await cgRes.json();
      const cgArr = Array.isArray(cgJson) ? cgJson : [];
      const imgBySymbol = new Map<string, string>();
      for (const item of cgArr) {
        const sym = String(item?.symbol || "").toUpperCase();
        const img = item?.image || "";
        if (sym && img) imgBySymbol.set(sym, img);
      }
      for (const e of topKnown) {
        const img = imgBySymbol.get((e.symbol || e.name || "").toUpperCase());
        if (img) e.iconUrl = img;
      }
    }
  } catch {
    // ignore CoinGecko image failures
  }

  // Order by volume desc to present most active first
  return topKnown.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
}

export type MarketCategory = "trending" | "gainers" | "losers" | "newest";

export async function fetchMarketBase(): Promise<MarketEntry[]> {
  // Use CoinMarketCap quotes for top symbols and logos from CMC
  const symbols = TOP_SYMBOLS_20 as unknown as string[];
  const quotes = await fetchCmcQuotesBySymbols(symbols);
  const logos = await fetchCmcIconsBySymbols(symbols);
  const geckoMarkets = await fetchGeckoMarketsBySymbols(symbols);
  const entries: MarketEntry[] = [];
  for (const sym of symbols) {
    const q = quotes.get(sym);
    const usd = q?.quote?.USD;
    const listedAtStr = q?.date_added ?? q?.last_updated ?? usd?.last_updated ?? null;
    const listedAt = listedAtStr ? Date.parse(listedAtStr) : null;
    const price = typeof usd?.price === "number" ? usd.price : usd?.price ? Number(usd.price) : null;
    const change24 = typeof usd?.percent_change_24h === "number" ? usd.percent_change_24h : usd?.percent_change_24h ? Number(usd.percent_change_24h) : null;
    const mcap = typeof usd?.market_cap === "number" ? usd.market_cap : usd?.market_cap ? Number(usd.market_cap) : null;
    const vol24 = typeof usd?.volume_24h === "number" ? usd.volume_24h : usd?.volume_24h ? Number(usd.volume_24h) : null;
    const gecko = geckoMarkets.get(sym.toUpperCase());
    entries.push({
      id: sym,
      name: q?.name || sym,
      symbol: sym,
      priceUsd: price ?? (typeof gecko?.current_price === "number" ? gecko.current_price : null),
      change24hPercent: change24,
      marketCapUsd: mcap ?? (typeof gecko?.market_cap === "number" ? gecko.market_cap : null),
      volume24hUsd: vol24,
      listedAt: typeof listedAt === "number" && !Number.isNaN(listedAt) ? listedAt : null,
      iconUrl: logos.get(sym) ?? gecko?.image ?? null,
      tokenAddress: null,
    });
  }
  // Sort by market cap then volume
  return entries.sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0) || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
}

export function deriveCategory(entries: MarketEntry[], category: MarketCategory): MarketEntry[] {
  const list = [...entries];
  switch (category) {
    case "trending":
      return list.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
    case "gainers":
      return list.sort((a, b) => (b.change24hPercent ?? -Infinity) - (a.change24hPercent ?? -Infinity));
    case "losers":
      return list.sort((a, b) => (a.change24hPercent ?? Infinity) - (b.change24hPercent ?? Infinity));
    case "newest":
      return list.sort((a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0));
    default:
      return list;
  }
}