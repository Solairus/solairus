import React, { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import FAB from "@/components/FAB";
import { Card } from "@/components/Card";
import OnboardingSlider from "@/components/OnboardingSlider";
import { toast } from "@/components/ui/sonner";

/**
 * Dapp
 * Purpose: Mobile app-like shell for the Solairus dApp under "/dapp".
 * Notes:
 * - Strict 390px portrait container centered on all viewports.
 * - Header sticky, bottom navigation fixed inside the container.
 * - Content scrolls beneath header; FAB sits above bottom navigation.
 * - Wallet adapter & Anchor client will be wired in future tasks.
 */
export default function Dapp() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const now = Date.now();
    try {
      const hideUntilStr = window.localStorage.getItem("solairus_onboarding_hide_until");
      const hideUntil = hideUntilStr ? parseInt(hideUntilStr, 10) : 0;
      setShowOnboarding(!(hideUntil && now < hideUntil));
    } catch {
      // Storage may be unavailable; default to showing onboarding.
      setShowOnboarding(true);
    }
  }, []);

  const closeOnboarding = () => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    try {
      const until = Date.now() + ONE_HOUR_MS;
      window.localStorage.setItem("solairus_onboarding_hide_until", String(until));
    } catch (err) {
      void err;
    }
    toast("Splash hidden for 1 hour");
    setShowOnboarding(false);
  };
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="relative max-w-[390px] w-full h-screen bg-background text-foreground overflow-hidden flex flex-col border border-border/50 shadow-2xl">
        {/* Header */}
        <TopBar title="SOLAIRUS" />

        {/* Scrollable main content */}
        <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 space-y-4">
          <Card title="Vault Balance" subtitle="USDT Rewards">
            <div className="text-3xl font-bold">$0.00</div>
            <div className="text-sm text-muted-foreground mt-2">Daily ROI: 1–5% (simulated)</div>
          </Card>

          <Card title="AI Agent" subtitle="Status">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mode</span>
              <span className="text-sm">Passive</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm">24/7</span>
            </div>
          </Card>

          <Card title="Actions" subtitle="Quick">
            <div className="grid grid-cols-2 gap-3">
              <button className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-secondary transition border border-primary/40">Deposit</button>
              <button className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-secondary transition border border-primary/40">Claim</button>
            </div>
          </Card>
        </div>

        {/* Floating action */}
        <FAB label="Fuse" />

        {/* Bottom nav */}
        <BottomNav />

        {/* Onboarding overlay */}
        {showOnboarding && <OnboardingSlider onClose={closeOnboarding} />}
      </div>
    </div>
  );
}