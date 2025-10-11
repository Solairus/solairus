import React, { useEffect, useMemo, useRef, useState } from "react";

const FRAMES = ["|", "/", "-", "\\"];
const LINES = [
  "Initializing environment",
  "Provisioning runtime",
  "Installing dependencies",
  "Starting services",
  "Finalizing setup",
];

export default function TerminalRow({ id }: { id: string }) {
  const [tick, setTick] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const frame = useMemo(() => FRAMES[tick % FRAMES.length], [tick]);
  const dots = useMemo(() => Array((tick % 3) + 1).fill(".").join(""), [tick]);

  useEffect(() => {
    const spinner = setInterval(() => {
      setTick((x) => x + 1);
      setProgress((p) => Math.min(100, p + Math.random() * 6));
    }, 120);
    const lines = setInterval(() => {
      setLineIdx((i) => (i + 1) % LINES.length);
    }, 600);
    return () => {
      clearInterval(spinner);
      clearInterval(lines);
    };
  }, []);

  return (
    <li className="flex items-center gap-2">
      <div className="flex-1">
        <div className="mt-0 flex items-center gap-1 whitespace-nowrap text-[10px] md:text-xs">
          <span className="font-mono text-white/70">{id.slice(-6)}</span>
          <span className="text-white/50">|</span>
          <span className="font-mono text-white/80">Deploying AI agent</span>
          <span className="text-white/50">-</span>
          <span className="font-mono text-white/70">{frame}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] md:text-xs text-white/80">
          <span className="inline-block mr-3 opacity-80">
            {LINES[lineIdx]}
            <span className="ml-1 text-white/50">{dots}</span>
          </span>
        </div>
        <div className="mt-1 h-1 w-full bg-white/10 rounded">
          <div
            className={`h-1 rounded transition-all bg-cyan-500`}
            style={{ width: `${Math.min(100, Math.round(progress))}%` }}
          />
        </div>
      </div>
    </li>
  );
}