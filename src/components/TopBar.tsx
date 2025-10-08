import React from "react";
import { Settings } from "lucide-react";

/**
 * TopBar
 * Purpose: Sticky app header for the mobile container.
 * Inputs:
 * - title: string title to display.
 * Notes:
 * - Applies safe-area top padding and backdrop blur.
 */
export default function TopBar({
  title: _title = "App",
}: {
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-20 bg-background/40 backdrop-blur-md border-b border-border/50">
      <div className="safe-top px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.png" alt="SOLAIRUS logo" className="h-[60px] w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Settings"
            className="p-2 rounded-lg hover:bg-foreground/10 border border-border/50"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}