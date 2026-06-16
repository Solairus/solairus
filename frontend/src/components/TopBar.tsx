import React from "react";
import { Settings, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import LicenseStatusWidget from "@/components/license/LicenseStatusWidget";
import { useAdminRole } from "@/hooks/useAdminRole";

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
  const { hasAccess, role } = useAdminRole();

  return (
    <header className="sticky top-0 z-20 bg-background/40 backdrop-blur-md border-b border-border/50">
      <div className="safe-top px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.png" alt="SOLAIRUS logo" className="h-[60px] w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {/* License Status Indicator */}
          <LicenseStatusWidget 
            variant="compact"
            className="px-2 py-1 rounded-md bg-background/50 border border-border/50"
          />
          
          {/* Admin Access Button - Only show for authorized users */}
          {hasAccess && (
            <Link
              to="/dapp/special"
              aria-label={`Admin Panel (${role})`}
              className="p-2 rounded-lg hover:bg-foreground/10 border border-border/50 text-orange-400 hover:text-orange-300 transition-colors"
              title={`Admin Panel - ${role?.toUpperCase()}`}
            >
              <Shield className="w-5 h-5" />
            </Link>
          )}
          
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