import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Wallet, Bot, Gift, Shield } from "lucide-react";

/**
 * OnboardingSlider
 * Purpose: Full-screen onboarding splash slider for the mobile app container.
 * Notes:
 * - Touch-first with Embla carousel.
 * - Safe-area aware header and footer.
 * - 4 slides explaining the dApp experience.
 */
export default function OnboardingSlider({ onClose }: { onClose: () => void }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, align: "center", dragFree: false });
  const [index, setIndex] = useState(0);
  const slides = [
    {
      icon: Wallet,
      title: "Connect Your Wallet",
      desc: "Use Phantom or Solflare. Non-custodial and secure by design.",
    },
    {
      icon: Bot,
      title: "Hire Your AI Agent",
      desc: "Autonomous trading tuned for steady daily USDT rewards.",
    },
    {
      icon: Gift,
      title: "Earn Daily Rewards",
      desc: "Target 1–5% per day with transparent caps and controls.",
    },
    {
      icon: Shield,
      title: "Stay in Control",
      desc: "You approve actions. We simulate visuals. Devnet for testing.",
    },
  ];

  const onSelect = useCallback(() => {
    if (!embla) return;
    setIndex(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    embla.on("select", onSelect);
    onSelect();
  }, [embla, onSelect]);

  const next = () => {
    if (!embla) return;
    if (index < slides.length - 1) {
      embla.scrollNext();
    } else {
      onClose();
    }
  };

  const skip = () => onClose();

  return (
    <div className="absolute inset-0 z-30 bg-black/90 text-white flex flex-col">
      {/* Header */}
      <div className="safe-top px-4 py-3 flex items-center justify-between border-b border-white/10">
        <h2 className="text-base font-semibold">Welcome</h2>
        <button
          onClick={skip}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15"
        >
          Skip
        </button>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-hidden">
        <div className="embla h-full" ref={emblaRef}>
          <div className="embla__container flex h-full">
            {slides.map((s, i) => (
              <div key={i} className="embla__slide flex-[0_0_100%] px-6 py-10 flex flex-col items-center justify-center gap-4">
                <s.icon className="w-16 h-16 text-primary" />
                <h3 className="text-2xl font-bold text-center">{s.title}</h3>
                <p className="text-center text-muted-foreground max-w-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with dots and next */}
      <div className="safe-bottom px-4 pb-4 pt-3 border-t border-white/10">
        <div className="flex items-center justify-center gap-2 mb-3">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${index === i ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg border border-white/10 active:scale-95 transition"
        >
          {index < slides.length - 1 ? "Next" : "Get Started"}
        </button>
      </div>
    </div>
  );
}