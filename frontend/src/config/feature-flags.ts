/**
 * Feature Flags Utility
 * Purpose: Centralize control of runtime feature toggles.
 * Inputs: Reads env vars and optional localStorage overrides.
 * Outputs: Boolean flags to conditionally enable/disable features.
 */

/**
 * Check if smart contract integration is disabled.
 * - Env: VITE_DISABLE_SMARTCONTRACT ("true" to disable)
 * - Optional localStorage override: solairus.disableSmartContract
 */
export function isSmartContractDisabled(): boolean {
  try {
    const raw = (import.meta.env.VITE_DISABLE_SMARTCONTRACT ?? "false")
      .toString()
      .toLowerCase()
      .trim();

    let override = null as string | null;
    if (typeof window !== "undefined" && window.localStorage) {
      override = window.localStorage.getItem("solairus.disableSmartContract");
    }

    if (override) {
      return override.toLowerCase().trim() === "true";
    }

    return raw === "true";
  } catch {
    // Safe default: integration enabled
    return false;
  }
}