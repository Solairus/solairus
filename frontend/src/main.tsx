import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from "buffer";

// Polyfill Buffer for browser libs expecting Node Buffer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).Buffer = Buffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Buffer = Buffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Buffer = Buffer;

createRoot(document.getElementById("root")!).render(
  <App />
);

// Register service worker for PWA installability (production only)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // ignore registration errors in dev
      });
  });
}
