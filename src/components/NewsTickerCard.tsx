import React from "react";

type NewsTickerCardProps = {
  items?: string[];
  speedSeconds?: number;
};

export default function NewsTickerCard({
  items = [
    "SOLAIRUS dev preview – features subject to change",
    "Vault rewards are simulated for UI testing",
    "New AI agent modules arriving soon",
    "Join the community for updates",
  ],
  speedSeconds = 30,
}: NewsTickerCardProps) {
  // Duplicate the items to create a seamless loop
  const loopItems = [...items, ...items];
  const tickerStyle: React.CSSProperties & { ["--speed"]: string } = {
    "--speed": `${speedSeconds}s`,
  };
  return (
    <div className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="h-12 flex items-center">
        <div
          className="w-full whitespace-nowrap mask-fade-x"
        >
          <div
            className="inline-flex gap-8 px-4 animate-ticker"
            style={tickerStyle}
          >
            {loopItems.map((text, idx) => (
              <span key={idx} className="text-sm text-white/85">
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}