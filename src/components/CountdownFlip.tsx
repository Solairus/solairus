import { useEffect, useRef, useState } from "react";

type TimeParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getRemaining(targetMs: number): TimeParts {
  const delta = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(delta / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

interface FlipDigitProps {
  value: number;
  prev: number;
  label: string;
}

const FlipDigit = ({ value, prev, label }: FlipDigitProps) => {
  const [animating, setAnimating] = useState(false);
  const lastValue = useRef(prev);

  useEffect(() => {
    if (lastValue.current !== value) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 500);
      lastValue.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative w-24 md:w-28 h-28 md:h-32 rounded-xl bg-gradient-to-b from-black/30 to-black/70 shadow-xl overflow-hidden"
        style={{ perspective: "1000px" }}
      >
        {/* subtle center seam */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/10" />

        {/* static halves showing current value */}
        <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden border-b border-white/10 bg-black/40 flex items-end justify-center">
          <span className="text-white font-mono text-4xl md:text-5xl font-extrabold tracking-tighter leading-none">{pad2(value)}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-black/60 flex items-start justify-center">
          <span className="text-white font-mono text-4xl md:text-5xl font-extrabold tracking-tighter leading-none">{pad2(value)}</span>
        </div>

        {/* flip animation layers */}
        {animating && (
          <>
            <div className="top-flip absolute inset-x-0 top-0 h-1/2 overflow-hidden border-b border-white/10 bg-black/40 flex items-end justify-center origin-bottom">
              <span className="text-white font-mono text-4xl md:text-5xl font-extrabold tracking-tighter leading-none">{pad2(prev)}</span>
            </div>
            <div className="bottom-flip absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-black/60 flex items-start justify-center origin-top">
              <span className="text-white font-mono text-4xl md:text-5xl font-extrabold tracking-tighter leading-none">{pad2(value)}</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-2 text-[10px] md:text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
    </div>
  );
};

export default function CountdownFlip({ targetDate }: { targetDate: string | Date }) {
  const targetMs = typeof targetDate === "string" ? Date.parse(targetDate) : targetDate.getTime();
  const [time, setTime] = useState<TimeParts>(() => getRemaining(targetMs));
  const [prev, setPrev] = useState<TimeParts>(time);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrev(time);
      setTime(getRemaining(targetMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs, time]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="grid grid-cols-4 gap-4 md:gap-6">
        <FlipDigit value={time.days} prev={prev.days} label="Days" />
        <FlipDigit value={time.hours} prev={prev.hours} label="Hours" />
        <FlipDigit value={time.minutes} prev={prev.minutes} label="Minutes" />
        <FlipDigit value={time.seconds} prev={prev.seconds} label="Seconds" />
      </div>
    </div>
  );
}