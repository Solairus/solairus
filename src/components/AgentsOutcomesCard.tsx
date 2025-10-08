import React, { useEffect, useRef, useState } from "react";
import AgentRow from "./AgentRow";
import TerminalRow from "./TerminalRow";

type AgentTier = "NOVA" | "VEGA" | "ORION" | "PRIME";

const TIERS: Record<AgentTier, { persona: string; tagline: string; accent: string }> = {
  NOVA: { persona: "Nova", tagline: "Pattern Seeker", accent: "bg-cyan-400" },
  VEGA: { persona: "Vega", tagline: "Momentum Scout", accent: "bg-emerald-400" },
  ORION: { persona: "Orion", tagline: "Risk Balancer", accent: "bg-indigo-400" },
  PRIME: { persona: "Prime", tagline: "Alpha Hunter", accent: "bg-amber-400" },
};

const COINGECKO_IDS: Record<string, string> = {
  BNB: "binancecoin",
  BTC: "bitcoin",
  ETC: "ethereum-classic",
  SOL: "solana",
  DOGE: "dogecoin",
  PEPE: "pepe",
  TRUMP: "trumpcoin",
};

function pickTier(): AgentTier {
  const r = Math.random();
  if (r < 0.25) return "NOVA";
  if (r < 0.5) return "VEGA";
  if (r < 0.75) return "ORION";
  return "PRIME";
}

type AgentItem = {
  kind: "agent";
  id: string;
  tier: AgentTier;
  persona: string;
  tagline: string;
  accent: string;
  justInserted: boolean;
};

type TerminalItem = {
  kind: "terminal";
  id: string;
};

export default function AgentsOutcomesCard() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const ROW_CAP = Math.max(1, Number(import.meta.env.VITE_OUTCOME_ROWS ?? 7));
  const [agents, setAgents] = useState<Array<AgentItem | TerminalItem>>(() =>
    Array.from({ length: ROW_CAP }, (_, i) => {
      const tier = pickTier();
      const meta = TIERS[tier];
      return {
        kind: "agent",
        id: `${tier}-${Date.now()}-${i}`,
        tier,
        persona: meta.persona,
        tagline: meta.tagline,
        accent: meta.accent,
        justInserted: false,
      } as AgentItem;
    }),
  );

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ids = Object.values(COINGECKO_IDS).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
        );
        const json = await res.json();
        const next: Record<string, number> = {};
        Object.entries(COINGECKO_IDS).forEach(([sym, id]) => {
          const v = json?.[id]?.usd;
          if (typeof v === "number") next[sym] = v;
        });
        setPrices(next);
      } catch (e) {
        void e;
      }
    };
    fetchPrices();
    const t = setInterval(fetchPrices, 10000);
    return () => clearInterval(t);
  }, []);

  const handleCompleted = () => {
    const tier = pickTier();
    const meta = TIERS[tier];
    const addition: AgentItem = {
      kind: "agent",
      id: `${tier}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tier,
      persona: meta.persona,
      tagline: meta.tagline,
      accent: meta.accent,
      justInserted: true,
    };
    const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setAgents((prev) => {
      const placeholder: TerminalItem = { kind: "terminal", id: terminalId };
      const next = [placeholder, ...prev].slice(0, ROW_CAP);
      const el = scrollRef.current;
      if (el) {
        try {
          el.animate(
            [
              { transform: "translateY(0)" },
              { transform: "translateY(18px)" },
              { transform: "translateY(0)" },
            ],
            { duration: 480, easing: "cubic-bezier(0.33,1,0.68,1)" },
          );
        } catch (e) {
          el.scrollTo({ top: el.scrollTop + 28, behavior: "smooth" });
        }
      }

      // Schedule replacement after 3 seconds
      setTimeout(() => {
        setAgents((curr) => {
          const idx = curr.findIndex((it) => it.kind === "terminal" && it.id === terminalId);
          if (idx !== -1) {
            const copy = [...curr];
            copy[idx] = addition;
            return copy;
          }
          return [addition, ...curr].slice(0, ROW_CAP);
        });
      }, 3000);

      return next;
    });
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">
            Agent Outcomes{" "}
            <span className="px-2 py-0.5 text-[10px] text-white rounded bg-green-500 border border-white/20 uppercase tracking-widest">
              LIVE
            </span>
          </h2>
        </div>
      </div>
      <div ref={scrollRef} className="mt-3 overflow-hidden pr-1">
        <ul className="space-y-2">
          {agents.map((a) =>
            a.kind === "agent" ? (
              <AgentRow
                key={a.id}
                id={a.id}
                tier={a.tier}
                persona={a.persona}
                tagline={a.tagline}
                accent={a.accent}
                prices={prices}
                onCompleted={handleCompleted}
                justInserted={a.justInserted}
              />
            ) : (
              <TerminalRow key={a.id} id={a.id} />
            ),
          )}
        </ul>
      </div>
    </div>
  );
}