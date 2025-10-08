import React from "react";
import { Home, BarChart3, History, HelpCircle, Bot } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/**
 * BottomNav
 * Purpose: Fixed bottom navigation inside the mobile container.
 * Notes:
 * - Uses safe-area bottom padding and backdrop blur.
 * - Highlights current view (placeholder: Home active).
 */
export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const isActive = (key: string) => {
    if (key === "home") return path === "/dapp";
    return path === `/dapp/${key}`;
  };
  const leftItems = [
    { key: "home", label: "Home", icon: Home },
    { key: "market", label: "Market", icon: BarChart3 },
  ];
  const rightItems = [
    { key: "history", label: "History", icon: History },
    { key: "help", label: "Help", icon: HelpCircle },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-background/40 backdrop-blur-md border-t border-border/50 shadow-xl overflow-visible">
      <div className="safe-bottom relative px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {leftItems.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                aria-label={label}
                to={key === "home" ? "/dapp" : `/dapp/${key}`}
                className={`group relative flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-lg text-muted-foreground`}
              >
                {isActive(key) && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary rounded-full" />
                )}
                <Icon className="w-6 h-6 opacity-80" />
                <span className="text-xs">{label}</span>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {rightItems.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                aria-label={label}
                to={`/dapp/${key}`}
                className={`group relative flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-lg text-muted-foreground`}
              >
                {isActive(key) && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary rounded-full" />
                )}
                <Icon className="w-6 h-6 opacity-80" />
                <span className="text-xs">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Central floating Hire button */}
        <Link
          aria-label="Hire"
          to="/dapp/hire"
          className={`absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border ${
            isActive("hire")
              ? "bg-background border-primary text-primary"
              : "bg-primary border-border/50 text-primary-foreground"
          }`}
        >
          <Bot className="w-6 h-6" />
        </Link>
      </div>
    </nav>
  );
}