/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ENABLE_WALLET_GUARD?: string;
  readonly VITE_DEFAULT_SPONSOR_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}