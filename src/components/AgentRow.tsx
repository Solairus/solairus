import React, { useEffect, useMemo, useRef, useState } from "react";
import { ThumbsUp, ThumbsDown, Handshake } from "lucide-react";

type AgentTier = "NOVA" | "VEGA" | "ORION" | "PRIME";

const BASE_STEPS = [
  "Analyzing Market",
  "Data Snapshot",
  "Identifying Opportunity",
  "Validating Opportunity",
  "Skipping (not viable)",
  "Entering Market",
  "Viability",
  "Expected Outcome",
  "Exiting Market",
  "Profit analysis",
  "Mission completed",
  "Profit/Loss",
] as const;

const DISPLAY_STATE: Record<(typeof BASE_STEPS)[number], string> = {
  "Analyzing Market": "analyzing",
  "Data Snapshot": "snapshot",
  "Identifying Opportunity": "opportunity",
  "Validating Opportunity": "validating",
  "Skipping (not viable)": "skipping",
  "Entering Market": "entering",
  "Viability": "viability",
  "Expected Outcome": "outcome",
  "Exiting Market": "closing",
  "Profit analysis": "analysis",
  "Mission completed": "completed",
  "Profit/Loss": "p/l",
};

const STATE_COLORS: Record<(typeof BASE_STEPS)[number] | "Profit/Loss+" | "Profit/Loss-", string> = {
  "Analyzing Market": "bg-cyan-500",
  "Data Snapshot": "bg-blue-500",
  "Identifying Opportunity": "bg-violet-500",
  "Validating Opportunity": "bg-indigo-500",
  "Skipping (not viable)": "bg-gray-500",
  "Entering Market": "bg-amber-500",
  "Viability": "bg-emerald-500",
  "Expected Outcome": "bg-teal-500",
  "Exiting Market": "bg-pink-500",
  "Profit analysis": "bg-fuchsia-500",
  "Mission completed": "bg-yellow-500",
  "Profit/Loss": "bg-purple-500",
  "Profit/Loss+": "bg-green-500",
  "Profit/Loss-": "bg-red-500",
};

const SYMBOLS = ["BNB", "BTC", "ETC", "SOL", "DOGE", "PEPE", "TRUMP"] as const;
type SymbolTicker = typeof SYMBOLS[number];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatUSD(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatUSDK(n: number) {
  const k = n / 1000;
  const decimals = n % 1000 === 0 ? 0 : 1;
  return `$${k.toFixed(decimals)}K`;
}

export default function AgentRow({
  id,
  tier,
  persona,
  tagline,
  accent,
  prices,
  onCompleted,
  justInserted,
}: {
  id: string;
  tier: AgentTier;
  persona: string;
  tagline: string;
  accent: string;
  prices: Record<string, number>;
  onCompleted: () => void;
  justInserted?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<(typeof BASE_STEPS)[number]>(BASE_STEPS[0]);
  const [detail, setDetail] = useState<string>("");
  const [symbol, setSymbol] = useState<SymbolTicker | undefined>(undefined);
  const [dir, setDir] = useState<"Buying" | "Selling" | undefined>(undefined);
  const [volUSD, setVolUSD] = useState<number | undefined>(undefined);
  const [marketPair, setMarketPair] = useState<string | undefined>(undefined);
  const [plPct, setPlPct] = useState<number | undefined>(undefined);
  const [plOutcome, setPlOutcome] = useState<"win" | "neutral" | "loss" | undefined>(undefined);
  const [closingPrice, setClosingPrice] = useState<number | undefined>(undefined);
  const [summaryVolUSD, setSummaryVolUSD] = useState<number | undefined>(undefined);
  const [didSkipLastCycle, setDidSkipLastCycle] = useState<boolean>(false);
  const [nextStepAt, setNextStepAt] = useState<number>(Date.now() + rand(250, 900));
  const [completedNotified, setCompletedNotified] = useState<boolean>(false);

  const progressColor = useMemo(() => {
    if (state === "Mission completed") {
      if (plOutcome === "win") return "bg-green-500";
      if (plOutcome === "neutral") return "bg-gray-500";
      if (plOutcome === "loss") return "bg-orange-500";
    }
    const key = state === "Profit/Loss" && detail.startsWith("+") ? "Profit/Loss+" : state === "Profit/Loss" && detail.startsWith("-") ? "Profit/Loss-" : state;
    return STATE_COLORS[key];
  }, [state, detail, plOutcome]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now < nextStepAt) return;

      // Reset from skipping back to analyzing, clear market context
      if (state === "Skipping (not viable)") {
        setStepIndex(0);
        setState(BASE_STEPS[0]);
        setDetail("");
        setSymbol(undefined);
        setDir(undefined);
        setVolUSD(undefined);
        setMarketPair(undefined);
        setPlPct(undefined);
        setPlOutcome(undefined);
        setClosingPrice(undefined);
        setSummaryVolUSD(undefined);
        setNextStepAt(now + rand(250, 900));
        setDidSkipLastCycle(true);
        return;
      }

      // Freeze completed rows
      if (state === "Mission completed") {
        if (!completedNotified) {
          setCompletedNotified(true);
          try {
            onCompleted();
          } catch (e) {
            void e;
          }
        }
        return;
      }

      const baseSkipChance = 0.25;
      let nextIdx = stepIndex + 1;
      let nextState: (typeof BASE_STEPS)[number];
      if (stepIndex === 3) {
        const willSkip = !didSkipLastCycle && Math.random() < baseSkipChance;
        if (willSkip) {
          nextIdx = 4; // Skipping
          nextState = BASE_STEPS[4];
        } else {
          nextIdx = 5; // Entering Market (bypass the Skipping step)
          nextState = BASE_STEPS[5];
        }
      } else {
        nextState = BASE_STEPS[nextIdx] ?? "Mission completed";
      }

      // Pick market on Data Snapshot
      if (nextState === "Data Snapshot") {
        if (!symbol) {
          const s = SYMBOLS[rand(0, SYMBOLS.length - 1)];
          setSymbol(s);
          setMarketPair(`${s}/USDT`);
        } else if (!marketPair) {
          setMarketPair(`${symbol}/USDT`);
        }
      }

      if (nextState === "Entering Market") {
        const d = Math.random() < 0.5 ? "Buying" : "Selling";
        setDir(d);
        if (!symbol) {
          const s = SYMBOLS[rand(0, SYMBOLS.length - 1)];
          setSymbol(s);
          setMarketPair(`${s}/USDT`);
        }
        const v = rand(1000, 25000);
        setVolUSD(v);
        setDetail(`${d} ${symbol ?? ""}/USDT · Vol ${formatUSDK(v)}`);
        setDidSkipLastCycle(false);
      } else if (nextState === "Viability") {
        setDetail(`${rand(75, 90)}%`);
      } else if (nextState === "Expected Outcome") {
        setDetail(`${rand(2, 15)}%`);
      } else if (nextState === "Profit/Loss") {
        const signPlus = Math.random() < 0.6;
        const pct = rand(1, 15);
        setDetail(`${signPlus ? "+" : "-"}${pct}%`);
      } else if (nextState === "Skipping (not viable)") {
        setDetail("opportunity filtered");
      } else if (nextState === "Mission completed") {
        const r = Math.random();
        if (r < 0.6) {
          setPlOutcome("win");
          setPlPct(rand(1, 15));
        } else if (r < 0.8) {
          setPlOutcome("neutral");
          setPlPct(0);
        } else {
          setPlOutcome("loss");
          setPlPct(-rand(1, 12));
        }
        const summaryVol = volUSD ?? rand(1000, 50000);
        setSummaryVolUSD(summaryVol);
        if (symbol) {
          const p = prices[symbol];
          if (typeof p === "number") setClosingPrice(p);
        }
      }

      setStepIndex(nextIdx);
      setState(nextState);
      setNextStepAt(now + rand(250, 900));
    }, 100);
    return () => clearInterval(interval);
  }, [state, stepIndex, nextStepAt, symbol, marketPair, volUSD, prices, didSkipLastCycle, detail, completedNotified, onCompleted]);

  const pctLabel = useMemo(() => {
    const pct = plPct ?? 0;
    const abs = Math.abs(pct);
    const sign = pct < 0 ? "-" : pct > 0 ? "+" : "";
    return `${sign}${abs}%`;
  }, [plPct]);

  const pnlLabel = useMemo(() => {
    if (typeof summaryVolUSD !== "number" || typeof plPct !== "number") return "$0.00K";
    const pnlUSD = (summaryVolUSD * plPct) / 100;
    const abs = Math.abs(pnlUSD);
    const sign = pnlUSD > 0 ? "+" : pnlUSD < 0 ? "-" : "";
    return `${sign}$${(abs / 1000).toFixed(2)}K`;
  }, [summaryVolUSD, plPct]);

  const pnlColor = useMemo(() => {
    if (plOutcome === "win") return "text-green-400";
    if (plOutcome === "loss") return "text-orange-400";
    return "text-gray-400";
  }, [plOutcome]);

  return (
    <li className={`flex items-center gap-3 ${justInserted ? "feed-insert" : ""}`}>
      <div className={`w-2 h-2 rounded-full ${accent}`} />
      <div className="flex-1">
        <div className="flex items-center gap-1 whitespace-nowrap text-[10px] md:text-xs">
          <span className="text-xs font-semibold opacity-90">{`${tier}-${id.slice(-4).toUpperCase()}`}:</span>
          <span className="text-xs tracking-wider text-white/80">{DISPLAY_STATE[state] ?? state}</span>
          <span className="text-xs text-white/60">|</span>
          <span className="text-[11px] text-white/70">{marketPair ?? "Awaiting Market"}</span>
          {typeof closingPrice === "number" && (
            <>
              <span className="text-xs text-white/50">-</span>
              <span className="text-[10px] text-white/60">CP: ${closingPrice}</span>
            </>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] md:text-xs">
          {state === "Mission completed" ? (
            <>
              <span className="font-semibold text-white/90">V: {formatUSDK(summaryVolUSD ?? 0)}</span>
              <span className="text-white/50">-</span>
              <span className="font-semibold text-white/90">P: {pctLabel}</span>
              <span className="text-white/50">-</span>
              <span className={`font-semibold ${pnlColor}`}>PNL: {pnlLabel}</span>
              <span className="text-white/50">-</span>
              <span
                className={`text-xs font-semibold ${
                  plOutcome === "win" ? "text-green-400" : plOutcome === "neutral" ? "text-gray-400" : "text-orange-400"
                }`}
              >
                {plOutcome === "win" ? "PROFIT" : plOutcome === "neutral" ? "NEUTRAL" : "LOSS"}
              </span>
              {plOutcome && (
                <span className="text-white/50">-</span>
              )}
              {plOutcome === "win" && <ThumbsUp className="w-3 h-3 text-green-400" />}
              {plOutcome === "neutral" && <Handshake className="w-3 h-3 text-gray-400" />}
              {plOutcome === "loss" && <ThumbsDown className="w-3 h-3 text-orange-400" />}
              
            </>
          ) : (
            detail && <span className="text-xs font-semibold text-white/90 transition-opacity duration-300">{detail}</span>
          )}
        </div>
        <div className="mt-1 h-1 w-full bg-white/10 rounded">
          <div
            className={`h-1 rounded transition-all ${progressColor}`}
            style={{ width: state === "Mission completed" ? "100%" : `${Math.min(100, Math.round((stepIndex / (BASE_STEPS.length - 1)) * 100))}%` }}
          />
        </div>
      </div>
    </li>
  );
}