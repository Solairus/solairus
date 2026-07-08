import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AgentHireCard
 * Purpose: Native-mobile, horizontal "listing" card for a hireable agent tier.
 * Layout mirrors the reference: image is FLUSH to the card edge (full height,
 * no padding/margin around it); only the content column is padded.
 * UI only — all existing tier info is preserved and reorganized:
 *   risk → corner badge · name+emoji → title · persona → subtitle ·
 *   monthly target → metric row · min–max liquidity → price row · action → Hire Now.
 * Logic stays in the page; this component just renders + calls onHire().
 */

export type AgentAccent = 'cyan' | 'emerald' | 'indigo' | 'amber';

// Static class strings per accent so Tailwind's JIT keeps them (no interpolation).
const ACCENTS: Record<AgentAccent, { text: string; badge: string; btn: string }> = {
  cyan: { text: 'text-cyan-400', badge: 'bg-cyan-500 text-white', btn: 'bg-cyan-500 hover:bg-cyan-600' },
  emerald: { text: 'text-emerald-400', badge: 'bg-emerald-500 text-white', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  indigo: { text: 'text-indigo-400', badge: 'bg-indigo-500 text-white', btn: 'bg-indigo-500 hover:bg-indigo-600' },
  amber: { text: 'text-amber-400', badge: 'bg-amber-500 text-black', btn: 'bg-amber-500 hover:bg-amber-600' },
};

// Compact USD: 50 → $50, 1000 → $1K, 5000 → $5K. Floors so a range never overstates its max.
const compactUsd = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fmtUsd = (n: number) => `$${compactUsd.format(Math.floor(n))}`;

export interface AgentHireCardProps {
  name: string;
  emoji: string;
  image: string;
  tagline: string;
  riskLabel: string;
  accent: AgentAccent;
  /** e.g. "8.25% – 8.5%" target monthly return; null while tiers load. */
  dailyRange: string | null;
  /** Min/max liquidity in USDT; null while tiers load. */
  minUsd: number | null;
  maxUsd: number | null;
  onHire: () => void;
}

export default function AgentHireCard({
  name,
  emoji,
  image,
  tagline,
  riskLabel,
  accent,
  dailyRange,
  minUsd,
  maxUsd,
  onHire,
}: AgentHireCardProps) {
  const a = ACCENTS[accent];
  const priceText =
    minUsd != null && maxUsd != null ? `${fmtUsd(minUsd)} – ${fmtUsd(maxUsd)}` : '—';

  return (
    <article className="glass rounded-2xl overflow-hidden flex items-stretch shadow-sm">
      {/* Thumbnail — flush to the card edge, full height, no padding */}
      <div className="relative w-28 flex-shrink-0 self-stretch">
        <img
          src={image}
          alt={`${name} avatar`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <span
          className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shadow ${a.badge}`}
        >
          {riskLabel}
        </span>
      </div>

      {/* Content — the only padded region */}
      <div className="flex-1 min-w-0 flex flex-col justify-center p-3">
        <div className="flex items-center gap-1.5">
          <h3 className={`text-base font-bold truncate ${a.text}`}>{name}</h3>
          <span className="text-base leading-none">{emoji}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{tagline}</p>

        {/* Metric row (target monthly return) */}
        <div className="flex items-center gap-1 mt-1 text-xs">
          <TrendingUp className={`h-3.5 w-3.5 flex-shrink-0 ${a.text}`} />
          <span className={`font-semibold ${a.text}`}>{dailyRange ?? '—'}</span>
          <span className="text-muted-foreground">monthly target</span>
        </div>

        {/* Price + action row */}
        <div className="flex items-end justify-between gap-2 mt-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground whitespace-nowrap">{priceText}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">liquidity range</p>
          </div>
          <Button
            size="sm"
            onClick={onHire}
            className={`flex-shrink-0 rounded-full px-4 h-8 text-xs font-semibold text-white shadow-sm ${a.btn}`}
          >
            Hire Now
          </Button>
        </div>
      </div>
    </article>
  );
}
