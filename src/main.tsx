import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletConnectionProvider } from "./lib/wallet";
import { AppKitProvider } from "@/components/shared/appkit-provider";
import { WalletContextProvider } from "@/contexts/wallet-context";

createRoot(document.getElementById("root")!).render(
  <AppKitProvider>
    <WalletContextProvider>
      <WalletConnectionProvider>
        <App />
      </WalletConnectionProvider>
    </WalletContextProvider>
  </AppKitProvider>
);

// Register service worker for PWA installability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // ignore registration errors in dev
      });
  });
}
