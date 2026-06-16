import React from "react";
import { Zap } from "lucide-react";

/**
 * FAB
 * Purpose: Floating Action Button for quick actions.
 * Inputs:
 * - label: string displayed beneath icon for accessibility.
 */
export default function FAB({ label = "Action" }: { label?: string }) {
  return (
    <button
      aria-label={label}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent to-primary text-primary-foreground rounded-full w-16 h-16 flex items-center justify-center shadow-lg border border-primary/40 active:scale-95 transition"
    >
      <Zap className="w-7 h-7" />
    </button>
  );
}