import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dapp from "./pages/Dapp";
import DappHome from "./pages/Dapp/Home";
import DappMarket from "./pages/Dapp/Market";
import DappHistory from "./pages/Dapp/History";
import DappHelp from "./pages/Dapp/Help";
import DappHire from "./pages/Dapp/Hire";
import DappReferral from "./pages/Dapp/Referral";
import CoreUITest from "./pages/uitests/core";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import InstallPrompt from "@/components/InstallPrompt";
import WalletGate from "@/components/WalletGate";
import LicenseActivationUITest from "./pages/uitests/license_activation";
// Removed RpcDebug and env-debug to prevent unnecessary RPC calls

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              <WalletGate>
                <Dapp />
              </WalletGate>
            }
          >
            <Route index element={<DappHome />} />
            <Route path="market" element={<DappMarket />} />
            <Route path="history" element={<DappHistory />} />
            <Route path="help" element={<DappHelp />} />
            <Route path="hire" element={<DappHire />} />
          </Route>
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/uitests/license_activation"
            element={
              <WalletGate>
                <LicenseActivationUITest />
              </WalletGate>
            }
          />
          <Route
            path="/uitests/core"
            element={
              <WalletGate>
                <CoreUITest />
              </WalletGate>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
