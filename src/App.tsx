import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dapp from "./pages/Dapp";
import DappHome from "./pages/DappHome";
import DappMarket from "./pages/DappMarket";
import DappHistory from "./pages/DappHistory";
import DappHelp from "./pages/DappHelp";
import DappHire from "./pages/DappHire";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import InstallPrompt from "@/components/InstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dapp" element={<Dapp />}>
            <Route index element={<DappHome />} />
            <Route path="market" element={<DappMarket />} />
            <Route path="history" element={<DappHistory />} />
            <Route path="help" element={<DappHelp />} />
            <Route path="hire" element={<DappHire />} />
          </Route>
          <Route path="/privacy" element={<Privacy />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
