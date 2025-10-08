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
    server: {
      host: "::",
      port: 8080,
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
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
