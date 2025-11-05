import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Dapp from "./pages/Dapp";
import DappHome from "./pages/Dapp/Home";
import DappMarket from "./pages/Dapp/Market";
import MyAgents from "./pages/Dapp/Agents/History";
import DappTransactionHistory from "./pages/Dapp/TransactionHistory";
import DappHelp from "./pages/Dapp/Help";
import DappHire from "./pages/Dapp/Agents/Hire";
import DappReferral from "./pages/Dapp/Referral";
import DappAffiliate from "./pages/Dapp/Affiliate";
import DappLicenseActivation from "./pages/Dapp/LicenseActivation";
import DappSummary from "./pages/Dapp/Summary";
import ComingSoon from "./pages/Dapp/ComingSoon";

import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";
import InstallPrompt from "@/components/InstallPrompt";
import WalletGate from "@/components/WalletGate";
import LicenseGuard from "@/components/license/LicenseGuard";

import { WalletContextProvider } from "@/contexts/wallet-context";
import { LicenseContextProvider } from "@/contexts/license-context";
import { createLicenseService } from "@/services/license/license-service";
import { useWallet } from "@/contexts/wallet-context";
import { ReactNode, useMemo } from "react";
import { AuthContextProvider } from '@/contexts/auth-context'
import { SettingsContextProvider } from '@/contexts/settings-context'

// Initialize configuration validation for agent system
import "@/utils/config-validator";

// Wrapper component to provide LicenseGuard
function LicenseGuardWrapper({ children }: { children: ReactNode }) {
  return (
    <LicenseGuard>
      {children}
    </LicenseGuard>
  );
}

// Wrapper component for LicenseActivation page
function LicenseActivationWrapper() {
  const licenseGuardEnabled = (
    (import.meta.env.VITE_ENABLE_LICENSE_GUARD ?? "true")
      .toString()
      .toLowerCase()
      .trim() === "true"
  );

  // If license guard is disabled, redirect to main dApp
  if (!licenseGuardEnabled) {
    return <Navigate to="/dapp" replace />;
  }

  return <DappLicenseActivation />;
}
// Removed RpcDebug and env-debug to prevent unnecessary RPC calls

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthContextProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dapp/ref/:code" element={<DappReferral />} />
                <Route
                  path="/dapp"
                  element={
                    <WalletContextProvider>
                      <LicenseContextProvider>
                        <SettingsContextProvider>
                          <WalletGate>
                            <LicenseGuardWrapper>
                              <Dapp />
                            </LicenseGuardWrapper>
                          </WalletGate>
                        </SettingsContextProvider>
                      </LicenseContextProvider>
                    </WalletContextProvider>
                  }
                >
                  <Route index element={<DappHome />} />
                  <Route path="market" element={<DappMarket />} />
                  <Route path="my-agents" element={<MyAgents />} />
                  <Route path="transaction-history" element={<DappTransactionHistory />} />
                  <Route path="help" element={<DappHelp />} />
                  <Route path="hire" element={<DappHire />} />
                  <Route path="affiliate" element={<DappAffiliate />} />
                  <Route path="license-activation" element={<LicenseActivationWrapper />} />
                  <Route path="summary" element={<DappSummary />} />
                  <Route path="coming-soon" element={<ComingSoon />} />
                </Route>
                <Route path="/privacy" element={<Privacy />} />
                <Route
                  path="/dapp/special"
                  element={
                    <WalletContextProvider>
                      <LicenseContextProvider>
                        <SettingsContextProvider>
                          <WalletGate>
                            <Admin />
                          </WalletGate>
                        </SettingsContextProvider>
                      </LicenseContextProvider>
                    </WalletContextProvider>
                  }
                />


                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
    </AuthContextProvider>
  </QueryClientProvider>
);

export default App;
