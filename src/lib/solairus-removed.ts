import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Solairus Removed Module
 * Purpose: Placeholder exports to keep the app compiling after removing
 * solairus-main and solairus-core. All functions either return safe defaults
 * or throw explicit errors to prevent unintended on-chain calls.
 * Inputs/Outputs: Mirrors commonly imported types and functions.
 */

export type LicenseStatus = "none" | "active" | "expired" | "near-expiry";

export interface LicenseInfo {
  status: LicenseStatus;
  isValid: boolean;
  expirationDate?: Date;
  daysRemaining?: number;
  [key: string]: unknown;
}

export interface UserProfile {
  user: PublicKey;
  sponsor: PublicKey;
  sponsorL1?: PublicKey;
  sponsorL2?: PublicKey;
  sponsorL3?: PublicKey;
  createdAt: anchor.BN;
  activePrincipalUsdt: anchor.BN;
  licenseExpiresAt: anchor.BN;
  totalAffiliateEarnings: anchor.BN;
  level1Earnings: anchor.BN;
  level2Earnings?: anchor.BN;
  level3Earnings?: anchor.BN;
  licenseActivation?: anchor.BN;
  licenseExpiration?: anchor.BN;
  [key: string]: unknown;
}

export interface Config {
  activationFeeUsdt: anchor.BN;
  licenseDurationDays: number;
  usdtMint: PublicKey;
  durationDays?: number;
  [key: string]: unknown;
}

export type MyReferrals = unknown;

export const AgentTier = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
  PLATINUM: "PLATINUM",
  DIAMOND: "DIAMOND",
  NOVA: "NOVA",
  VEGA: "VEGA",
  ORION: "ORION",
  PRIME: "PRIME",
} as const;
export type AgentTier = typeof AgentTier[keyof typeof AgentTier] | string;

export interface AgentTierConfig {
  name: string;
  emoji: string;
  description: string;
  dailyRange: string;
  yieldCapPct: number;
  minYieldBps: number;
  maxYieldBps: number;
}

export const AGENT_TIER_CONFIGS: Record<AgentTier, AgentTierConfig> = {
  BRONZE: {
    name: "Bronze",
    emoji: "🥉",
    description: "Entry tier with stable daily yields",
    dailyRange: "1–2% daily",
    yieldCapPct: 200,
    minYieldBps: 100,
    maxYieldBps: 200,
  },
  SILVER: {
    name: "Silver",
    emoji: "🥈",
    description: "Balanced yields for consistent growth",
    dailyRange: "2–3% daily",
    yieldCapPct: 200,
    minYieldBps: 200,
    maxYieldBps: 300,
  },
  GOLD: {
    name: "Gold",
    emoji: "🥇",
    description: "Higher yields with moderate risk",
    dailyRange: "3–4% daily",
    yieldCapPct: 200,
    minYieldBps: 300,
    maxYieldBps: 400,
  },
  PLATINUM: {
    name: "Platinum",
    emoji: "💠",
    description: "Premium tier with elevated yields",
    dailyRange: "4–5% daily",
    yieldCapPct: 200,
    minYieldBps: 400,
    maxYieldBps: 500,
  },
  DIAMOND: {
    name: "Diamond",
    emoji: "💎",
    description: "Elite tier with top yields",
    dailyRange: "5–6% daily",
    yieldCapPct: 200,
    minYieldBps: 500,
    maxYieldBps: 600,
  },
  NOVA: {
    name: "Nova",
    emoji: "🪐",
    description: "Next-gen tier with smart rewards",
    dailyRange: "1–5% daily",
    yieldCapPct: 200,
    minYieldBps: 100,
    maxYieldBps: 500,
  },
  VEGA: {
    name: "Vega",
    emoji: "🌠",
    description: "Adaptive yield tier",
    dailyRange: "1–5% daily",
    yieldCapPct: 200,
    minYieldBps: 100,
    maxYieldBps: 500,
  },
  ORION: {
    name: "Orion",
    emoji: "✨",
    description: "Pro tier for steady growth",
    dailyRange: "1–5% daily",
    yieldCapPct: 200,
    minYieldBps: 100,
    maxYieldBps: 500,
  },
  PRIME: {
    name: "Prime",
    emoji: "🚀",
    description: "Flagship tier with optimized yields",
    dailyRange: "1–5% daily",
    yieldCapPct: 200,
    minYieldBps: 100,
    maxYieldBps: 500,
  },
};

/** Program ID placeholder (no real program calls) */
export const PROGRAM_ID = PublicKey.default;

/** Return a clear error for any attempted contract access
 * Type is anchor.Program to satisfy compile-time usage sites. */
export type ProviderLike = anchor.AnchorProvider | { connection?: unknown } | unknown;
export function getProgram(_provider: ProviderLike): anchor.Program<anchor.Idl> {
  throw new Error("Contract module removed: use SolairusPay or updated services");
}

/** PDA derivation placeholder with flexible shape */
export function derivePdas(_arg?: PublicKey | anchor.AnchorProvider | null): { [key: string]: PublicKey | null } {
  return {
    config: null,
    vault: null,
    profile: null,
    counter: null,
    devProfile: null,
    sponsorReferrals: null,
    vaultUsdt: null,
    userUsdt: null,
  };
}

/** Specific PDA helpers commonly used */
export function deriveAgentActivationPda(_user: PublicKey): { activation: PublicKey | null } {
  return { activation: null };
}

/** License helpers returning safe defaults */
export function getLicenseInfo(_profile: UserProfile): LicenseInfo {
  return { status: "none", isValid: false };
}

export function isLicenseActive(_profile: UserProfile): boolean {
  return false;
}

export function getLicenseExpiryDate(_profile: UserProfile): Date | null {
  return null;
}

export async function checkLicenseStatus(
  _program: anchor.Program,
  _user: PublicKey
): Promise<{ hasProfile: boolean; licenseInfo: LicenseInfo; needsRegistration: boolean }> {
  return { hasProfile: false, licenseInfo: { status: "none", isValid: false }, needsRegistration: true };
}

export function needsRegistration(_info?: unknown): boolean {
  return true;
}

/** Affiliate helpers (no-ops) */
export function getAffiliateEarnings(_profile: UserProfile): {
  totalEarnings: number;
  totalWithdrawn: number;
  availableToWithdraw: number;
  level1Earnings: number;
  level2Earnings: number;
  level3Earnings: number;
} {
  return {
    totalEarnings: 0,
    totalWithdrawn: 0,
    availableToWithdraw: 0,
    level1Earnings: 0,
    level2Earnings: 0,
    level3Earnings: 0,
  };
}

export async function withdrawAffiliateEarnings(
  _program: anchor.Program,
  _user: PublicKey,
  _amount: anchor.BN,
  _usdtMint: PublicKey
): Promise<string> {
  throw new Error("Affiliate operations removed with contract module");
}

export async function activateLicenseUsdt(
  _program: anchor.Program,
  _user: PublicKey,
  _amount: anchor.BN,
  _usdtMint: PublicKey
): Promise<string> {
  throw new Error("License activation removed with contract module");
}

export interface UserAgentActivation {
  id?: anchor.BN;
  user?: PublicKey;
  tier?: number;
  principalUsdt?: anchor.BN;
  startedAt?: anchor.BN;
  lastRoiWithdrawAt?: anchor.BN;
  [key: string]: unknown;
}

/** Error helper */
export function getErrorMessage(_e: unknown): string {
  return "Feature unavailable: contract module removed";
}

/** Core instruction placeholders */
export const accounts: Record<string, unknown> = {};

export async function depositUsdt(): Promise<never> {
  throw new Error("depositUsdt removed with contract module");
}

export async function terminate(): Promise<never> {
  throw new Error("terminate removed with contract module");
}

export type WithdrawalLimitStatus = {
  canWithdraw: boolean;
  remaining: number;
  nextWindowAt?: Date;
  reason?: string;
};

export function calculateWithdrawalLimitStatus(_profile: UserProfile): WithdrawalLimitStatus {
  return { canWithdraw: true, remaining: 0 };
}

export function canWithdrawRoi(_activation?: unknown): boolean {
  return false;
}

export function getAgentTierConfig(tier: AgentTier): AgentTierConfig {
  return AGENT_TIER_CONFIGS[(tier as AgentTier)] ?? AGENT_TIER_CONFIGS.NOVA;
}
export function calculateYieldCapProgress(
  _tier: number | AgentTier,
  _activationAmount: anchor.BN | number,
  _totalRoiWithdrawn: anchor.BN | number
): number {
  return 0;
}
