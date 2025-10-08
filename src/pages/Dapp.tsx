import React, { useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
// import FAB from "@/components/FAB"; // removed per request
import OnboardingSlider from "@/components/OnboardingSlider";
import { Outlet } from "react-router-dom";

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
  const [fullView, setFullView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Enable full-view mode on mobile and keep height synced to the dynamic viewport
  useEffect(() => {
    const isMobile = () => window.innerWidth <= 480;
    const applyVH = () => {
      if (!containerRef.current) return;
      const vh = window.innerHeight; // excludes browser UI in mobile when address bar is collapsed
      containerRef.current.style.setProperty("--app-vh", `${vh}px`);
    };
    // Auto-enable full view on mobile
    setFullView(isMobile());
    applyVH();
    const onResize = () => {
      applyVH();
      // Disable full view automatically if switching to desktop sizes
      setFullView(isMobile());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const closeOnboarding = () => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    try {
      const until = Date.now() + ONE_HOUR_MS;
      window.localStorage.setItem("solairus_onboarding_hide_until", String(until));
    } catch (err) {
      void err;
    }
    setShowOnboarding(false);
  };
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div
        ref={containerRef}
        className={`relative max-w-[390px] w-full ${fullView ? "h-[var(--app-vh)]" : "h-screen"} bg-background text-foreground overflow-hidden flex flex-col border border-border/50 shadow-2xl`}
      >
        {/* Header */}
        <TopBar title="SOLAIRUS" fullView={fullView} onToggleFullView={() => setFullView((v) => !v)} />

        {/* Scrollable main content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 pt-4">
          <Outlet />
        </div>

        {/* Floating action */}
        {/* FAB removed */}

        {/* Bottom nav */}
        <BottomNav />

        {/* Onboarding overlay */}
        {showOnboarding && <OnboardingSlider onClose={closeOnboarding} />}
      </div>
    </div>
  );
}