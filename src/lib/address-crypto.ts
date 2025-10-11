/**
 * Referral address crypto utilities (mirrored from kriptiz with adjustments for Solana).
 */

// Simple XOR key; for obfuscation, not strong security.
const ENCRYPTION_KEY = "solairus-referral-key-2025";

/**
 * Encrypt a wallet address for use in referral links (URL-safe).
 */
export function encryptAddress(address: string): string {
  if (!address || typeof address !== "string") throw new Error("Invalid wallet address");
  const clean = address.trim();
  let encryptedHex = "";
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const keyCharCode = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    const enc = charCode ^ keyCharCode;
    encryptedHex += enc.toString(16).padStart(2, "0");
  }
  return btoa(encryptedHex).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decrypt an encrypted referral code back to the original address.
 */
export function decryptAddress(code: string): string {
  try {
    const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const hex = atob(base64);
    let out = "";
    for (let i = 0; i < hex.length; i += 2) {
      const hexPair = hex.substr(i, 2);
      const charCode = Number.parseInt(hexPair, 16);
      const keyCharCode = ENCRYPTION_KEY.charCodeAt((i / 2) % ENCRYPTION_KEY.length);
      out += String.fromCharCode(charCode ^ keyCharCode);
    }
    return out;
  } catch (err) {
    throw new Error("Invalid referral code");
  }
}

/**
 * Basic Solana address validation (Base58, typical 32–44 length).
 */
export function isValidSolAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr || "");
}

const SPONSOR_KEY = "referralSponsor";
const SPONSOR_EXP_KEY = "referralSponsorExpiresAt";

/**
 * Store sponsor with 30-day TTL.
 */
export function storeSponsorAddress(address: string, days = 30): void {
  try {
    localStorage.setItem(SPONSOR_KEY, address);
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(SPONSOR_EXP_KEY, String(expiresAt));
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("Failed to store sponsor address", err);
    }
  }
}

/**
 * Get sponsor if not expired; else default from env.
 */
export function getSponsorAddress(): string {
  const DEFAULT = import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS || "";
  try {
    const addr = localStorage.getItem(SPONSOR_KEY) || "";
    const expRaw = localStorage.getItem(SPONSOR_EXP_KEY);
    const exp = expRaw ? Number(expRaw) : 0;
    if (addr && (!exp || Date.now() < exp)) return addr;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("Failed to read sponsor address", err);
    }
  }
  return DEFAULT;
}

export function clearSponsorAddress(): void {
  try {
    localStorage.removeItem(SPONSOR_KEY);
    localStorage.removeItem(SPONSOR_EXP_KEY);
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("Failed to clear sponsor address", err);
    }
  }
}