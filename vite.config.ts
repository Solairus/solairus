import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDev = loadEnv(mode, process.cwd(), "");
  const envProd = loadEnv("production", process.cwd(), "");
  const cmcKey = envDev.VITE_CMC_API_KEY || envProd.VITE_CMC_API_KEY || process.env.VITE_CMC_API_KEY || "";
  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
    server: {
      host: "::",
      port: 8080,
      // Ensure HMR uses the active server and avoid cross-port confusion
      hmr: {
        // Vite will infer the correct port; setting clientPort helps when proxies exist
        // Leaving port undefined allows Vite to bind to the actual server port
        overlay: true,
      },
      proxy: {
        "/cmc": {
          target: "https://pro-api.coinmarketcap.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/cmc/, ""),
          headers: {
            "X-CMC_PRO_API_KEY": cmcKey,
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        // Force single React instance resolution
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        "@": path.resolve(__dirname, "./src"),
        // Map Solana mobile protocol imports to a web-safe shim
        "@solana-mobile/mobile-wallet-adapter-protocol": path.resolve(
          __dirname,
          "src/shims/solana-mobile-protocol.ts"
        ),
        "@solana-mobile/mobile-wallet-adapter-protocol-web3js": path.resolve(
          __dirname,
          "src/shims/solana-mobile-protocol.ts"
        ),
      },
      // Prevent duplicate React copies causing invalid hook calls
      dedupe: ["react", "react-dom"],
      // Use Vite's default resolution; no dedupe or special aliases needed
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
    define: {
      global: 'globalThis',
      'process.env': {},
    },
    // Ensure environment variables are available
    envPrefix: ['VITE_'],
    // Use default dependency optimization for simplicity
  };
});
