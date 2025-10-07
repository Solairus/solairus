import React from "react";
import { Home, Vault, Gift, User } from "lucide-react";

/**
 * BottomNav
 * Purpose: Fixed bottom navigation inside the mobile container.
 * Notes:
 * - Uses safe-area bottom padding and backdrop blur.
 * - Highlights current view (placeholder: Home active).
 */
export default function BottomNav() {
  const items = [
    { key: "home", label: "Home", icon: Home, active: true },
    { key: "vault", label: "Vault", icon: Vault, active: false },
    { key: "rewards", label: "Rewards", icon: Gift, active: false },
    { key: "profile", label: "Profile", icon: User, active: false },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-background/40 backdrop-blur-md border-t border-border/50 shadow-xl">
      <div className="safe-bottom px-4 py-3 flex justify-between items-center">
        {items.map(({ key, label, icon: Icon, active }) => (
          <button
            key={key}
            aria-label={label}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-lg ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className={`w-6 h-6 ${active ? "text-primary" : "opacity-70"}`} />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}