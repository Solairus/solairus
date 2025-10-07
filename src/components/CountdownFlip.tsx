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
  label: string;
}

const FlipDigit = ({ value, label }: FlipDigitProps) => {
  return (
    <div className="flex flex-col items-center">
      <div className="w-24 md:w-28 h-28 md:h-32 rounded-xl bg-black/70 shadow-xl flex items-center justify-center">
        <span className="text-white font-mono text-6xl md:text-7xl font-extrabold tracking-tighter leading-none">
          {pad2(value)}
        </span>
      </div>
      <div className="mt-2 text-[10px] md:text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
    </div>
  );
};

export default function CountdownFlip({ targetDate }: { targetDate: string | Date }) {
  const targetMs = typeof targetDate === "string" ? Date.parse(targetDate) : targetDate.getTime();
  const [time, setTime] = useState<TimeParts>(() => getRemaining(targetMs));
  

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getRemaining(targetMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="grid grid-cols-4 gap-4 md:gap-6">
        <FlipDigit value={time.days} label="Days" />
        <FlipDigit value={time.hours} label="Hours" />
        <FlipDigit value={time.minutes} label="Minutes" />
        <FlipDigit value={time.seconds} label="Seconds" />
      </div>
    </div>
  );
}