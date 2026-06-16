import React, { useEffect, useState } from "react";

// Minimal type for the non-standard beforeinstallprompt event in browsers
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissedUntil = Number(localStorage.getItem("solairus_install_dismiss_until") || 0);
    const canShowByTime = Date.now() > dismissedUntil;
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 480px)").matches;

    const onBeforeInstallPrompt = (e: InstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (canShowByTime && isMobile) setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        setShow(false);
      } else {
        // If declined, snooze for 24 hours
        localStorage.setItem("solairus_install_dismiss_until", String(Date.now() + 24 * 60 * 60 * 1000));
        setShow(false);
      }
    } catch {
      setShow(false);
    }
  };
  const dismiss = () => {
    localStorage.setItem("solairus_install_dismiss_until", String(Date.now() + 24 * 60 * 60 * 1000));
    setShow(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="safe-top px-4 py-2">
        <div className="mx-auto max-w-[390px] rounded-lg border border-border/50 bg-background/80 backdrop-blur-md shadow-xl">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold">Install SOLAIRUS</span>
              <span className="ml-2 text-muted-foreground">Add to Home for full-screen</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={install} className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm">
                Install
              </button>
              <button onClick={dismiss} className="px-3 py-1 rounded-md border border-border/50 text-sm">
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}