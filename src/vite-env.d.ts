/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ENABLE_WALLET_GUARD?: string;
  readonly VITE_DEFAULT_SPONSOR_ADDRESS?: string;
  // Local testing override for withdrawal window seconds
  readonly VITE_WITHDRAWAL_WINDOW_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}