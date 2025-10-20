import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "@/idl/solairus_main.json";
import { buildSponsorHierarchy } from "@/lib/sponsor-tree";

// Lightweight client helpers for the solairus_main program, following existing patterns.

// Resolve program address from IDL (prefer root.address, fallback to metadata.address)
interface IdlWithAddress {
  address?: string;
  metadata?: { address?: string };
}

const mainIdl = idl as IdlWithAddress;
export const PROGRAM_ID = new PublicKey(
  mainIdl.address || mainIdl.metadata?.address || ""
);

// Error codes from IDL for optional human-friendly messages
export const ERROR_CODES = {
  Unauthorized: 6000,
  InvalidPercent: 6001,
  InvalidConfigSum: 6002,
  MathOverflow: 6003,
  InvalidAmount: 6004,
  InvalidMint: 6005,
  InsufficientFunds: 6006,
  SponsorNotRegistered: 6007,
  InvalidRemainingAccounts: 6008,
} as const;

export type ErrorCodeName = keyof typeof ERROR_CODES;

// Anchor Program factory with v0.32.1 compatibility fixes
export function getProgram(provider: anchor.AnchorProvider) {
  console.log('🔧 Creating program with provider for:', PROGRAM_ID.toString());
  console.log('🔧 Creating program instance');
  console.log('🔄 Using updated contract with profile seeds');

  // Apply Anchor v0.32.1 compatibility fixes as per project rules
  const fixIdlTypes = (obj: unknown): unknown => {
    if (typeof obj === "string") {
      // Convert publicKey to pubkey for Anchor compatibility
      return obj === "publicKey" ? "pubkey" : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(fixIdlTypes);
    }
    if (typeof obj === "object" && obj !== null) {
      const fixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Fix defined types: "Role" → {name: "Role"}
        if (key === "defined" && typeof value === "string") {
          fixed[key] = { name: value };
        } else {
          fixed[key] = fixIdlTypes(value);
        }
      }
      return fixed;
    }
    return obj;
  };

  // Ensure root address field exists (required by Anchor v0.32.1)
  const baseFixedIdl = fixIdlTypes({
    ...idl,
    address: mainIdl.address || mainIdl.metadata?.address,
  }) as Record<string, unknown>;

  // The IDL should already have proper structure, but ensure compatibility
  const finalIdl = {
    ...baseFixedIdl,
    // Ensure all required fields are present
    version: baseFixedIdl.version || "0.1.0",
    name: baseFixedIdl.name || "solairus_main",
  };

  console.log('📋 Creating Anchor program with IDL version:', finalIdl.version);
  console.log('🕐 Program creation timestamp:', new Date().toISOString());

  try {
    const program = new anchor.Program(finalIdl as unknown as anchor.Idl, provider);
    console.log('✅ Program created successfully');
    console.log('🔍 Program ID from program:', program.programId.toString());
    console.log('🔍 Expected Program ID:', PROGRAM_ID.toString());
    return program;
  } catch (error) {
    console.error('❌ Error creating program:', error);
    throw error;
  }
}

// PDA derivations inferred from IDL seeds
export function derivePdas(user?: PublicKey | null) {
  const config = PublicKey.findProgramAddressSync([
    Buffer.from("config"),
  ], PROGRAM_ID)[0];

  const vault = PublicKey.findProgramAddressSync([
    Buffer.from("vault"),
  ], PROGRAM_ID)[0];

  const profile = user
    ? PublicKey.findProgramAddressSync([
      Buffer.from("profile"),
      user.toBuffer(),
    ], PROGRAM_ID)[0]
    : null;

  const counter = user
    ? PublicKey.findProgramAddressSync([
      Buffer.from("agent_counter"),
      user.toBuffer(),
    ], PROGRAM_ID)[0]
    : null;

  const referrals = user
    ? PublicKey.findProgramAddressSync([
      Buffer.from("referrals"),
      user.toBuffer(),
    ], PROGRAM_ID)[0]
    : null;

  return { config, vault, profile, counter, referrals };
}

// Derive activation PDA with explicit nextId (u64, little-endian)
export function deriveAgentActivationPda(user: PublicKey, nextId: anchor.BN) {
  const seedNextIdLe = nextId.toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync([
    Buffer.from("agent"),
    user.toBuffer(),
    seedNextIdLe,
  ], PROGRAM_ID)[0];
}

// Agent tier enum and types
export enum AgentTier {
  NOVA = 0,
  VEGA = 1,
  ORION = 2,
  PRIME = 3
}

export interface AgentTierConfig {
  minYieldBps: number;
  maxYieldBps: number;
  yieldCapPct: number;
  name: string;
  emoji: string;
  description: string;
  dailyRange: string;
}

// Agent tier configurations matching smart contract
export const AGENT_TIER_CONFIGS: Record<AgentTier, AgentTierConfig> = {
  [AgentTier.NOVA]: {
    minYieldBps: 100,
    maxYieldBps: 175,
    yieldCapPct: 175,
    name: 'NOVA',
    emoji: '🪶',
    description: 'Entry-level agent, safe and steady',
    dailyRange: '1.00% - 1.75%'
  },
  [AgentTier.VEGA]: {
    minYieldBps: 175,
    maxYieldBps: 215,
    yieldCapPct: 200,
    name: 'VEGA',
    emoji: '🔮',
    description: 'Balanced risk and return',
    dailyRange: '1.75% - 2.15%'
  },
  [AgentTier.ORION]: {
    minYieldBps: 215,
    maxYieldBps: 300,
    yieldCapPct: 220,
    name: 'ORION',
    emoji: '⚡',
    description: 'Aggressive but controlled',
    dailyRange: '2.15% - 3.00%'
  },
  [AgentTier.PRIME]: {
    minYieldBps: 300,
    maxYieldBps: 500,
    yieldCapPct: 250,
    name: 'PRIME',
    emoji: '🧠',
    description: 'Elite trading AI',
    dailyRange: '3.00% - 5.00%'
  }
};

// TypeScript interfaces for smart contract data
export interface UserProfile {
  user: PublicKey;              // User's wallet address
  sponsor: PublicKey;           // Direct sponsor (only one sponsor stored)
  createdAt: anchor.BN;         // Profile creation timestamp
  activePrincipalUsdt: anchor.BN; // Active investment amount
  lastRoiWithdrawAt: anchor.BN; // Last ROI withdrawal timestamp
  licenseExpiresAt: anchor.BN;  // License expiration timestamp (0 = no license)
  // Affiliate earnings tracking (simplified system)
  totalAffiliateEarnings: anchor.BN;    // Total earned from all referrals
  totalAffiliateWithdrawn: anchor.BN;   // Total amount withdrawn
  level1Earnings: anchor.BN;            // Earnings from L1 referrals (accounting)
  level2Earnings: anchor.BN;            // Earnings from L2 referrals (accounting)
  level3Earnings: anchor.BN;            // Earnings from L3 referrals (accounting)
  // Credit system
  creditBalance: anchor.BN;             // Off-chain credit balance for agent activations
  // Global withdrawal limit tracking
  totalAgentDeposits: anchor.BN;        // Total USDT spent on agent activations
  totalRoiWithdrawn: anchor.BN;         // Total ROI withdrawn across all agents
}

export interface UserAgentActivation {
  user: PublicKey;                      // User who activated the agent
  activationId: anchor.BN;              // Unique ID per user
  tier: number;                         // 0=NOVA, 1=VEGA, 2=ORION, 3=PRIME
  usingUsdt: boolean;                   // Payment method (USDT vs Credit)
  amountUsdt: anchor.BN;                // Activation amount in USDT
  startedAt: anchor.BN;                 // Activation timestamp
  lastRoiWithdrawAt: anchor.BN;         // Last ROI withdrawal timestamp
  totalRoiWithdrawn: anchor.BN;         // Total ROI withdrawn from this agent
  yieldCapReached: boolean;             // Whether agent has reached yield cap
  bump: number;                         // PDA bump seed
}

export interface MyReferrals {
  sponsor: PublicKey;           // The sponsor who owns this referral list
  referrals: PublicKey[];       // List of user addresses who used this sponsor
  totalCount: number;           // Total referral count (for quick access)
}

export interface Config {
  bump: number;
  dev: PublicKey;
  admin: PublicKey;
  marketer1: PublicKey;
  marketer2: PublicKey;
  trader: PublicKey;
  systemreserve: PublicKey;
  usdtMint: PublicKey;
  activationFeeUsdt: anchor.BN;
  licenseDurationDays: number;
  roiDailyBps: number;
  licenseAdminPct: number;
  licenseDevPct: number;
  licenseMarketer1Pct: number;
  licenseMarketer2Pct: number;
  licenseReservePct: number;
  licenseAffL1Pct: number;
  licenseAffL2Pct: number;
  licenseAffL3Pct: number;
  // Agent hire (USDT) splits
  agentAdminPct: number;
  agentDevPct: number;
  agentMarketer1Pct: number;
  agentMarketer2Pct: number;
  agentTraderPct: number;
  agentReservePct: number;
  agentAffL1Pct: number;
  agentAffL2Pct: number;
  agentAffL3Pct: number;
  // Tracked system buckets (USDT ledger)
  bucketAdminUsdt: anchor.BN;
  bucketDevUsdt: anchor.BN;
  bucketMarketer1Usdt: anchor.BN;
  bucketMarketer2Usdt: anchor.BN;
  bucketTraderUsdt: anchor.BN;
  bucketSystemreserveUsdt: anchor.BN;
}

// License status types
export type LicenseStatus = 'active' | 'expired' | 'near-expiry' | 'none' | 'loading';

export interface LicenseInfo {
  status: LicenseStatus;
  expirationDate?: Date;
  daysRemaining?: number;
  isValid: boolean;
}

// License validation helpers
export function isLicenseActive(userProfile: UserProfile): boolean {
  try {
    // Check for zero or null expiration (no license)
    if (userProfile.licenseExpiresAt.eq(new anchor.BN(0))) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Validate the expiration timestamp is reasonable
    const expirationSeconds = userProfile.licenseExpiresAt.toString();
    const expirationNum = parseInt(expirationSeconds);
    
    // Check for invalid timestamps
    if (isNaN(expirationNum) || expirationNum <= 0) {
      console.warn('⚠️ Invalid license expiration timestamp:', expirationSeconds);
      return false;
    }
    
    // Use toString() and comparison for large numbers to avoid precision issues
    return userProfile.licenseExpiresAt.gt(new anchor.BN(now));
  } catch (error) {
    console.warn('⚠️ Error checking license active status:', error);
    return false;
  }
}

export function getLicenseExpiryDate(userProfile: UserProfile): Date {
  try {
    // Handle large BN values safely
    const timestampSeconds = userProfile.licenseExpiresAt.toString();
    const timestampMs = parseInt(timestampSeconds) * 1000;
    
    // Validate the timestamp is reasonable (not 0, not negative, not too far in future)
    if (timestampMs <= 0 || timestampMs > Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) {
      console.warn('⚠️ Invalid timestamp detected:', timestampMs);
      return new Date(NaN); // Return Invalid Date
    }
    
    return new Date(timestampMs);
  } catch (error) {
    console.warn('⚠️ Error parsing license expiry date:', error);
    return new Date(NaN); // Return Invalid Date
  }
}

export function getLicenseInfo(userProfile: UserProfile | null): LicenseInfo {
  if (!userProfile) {
    return {
      status: 'none',
      isValid: false,
    };
  }

  // Check if user is properly registered
  const hasValidCreatedAt = userProfile.createdAt && !userProfile.createdAt.eq(new anchor.BN(0));
  const hasValidSponsor = userProfile.sponsor && !userProfile.sponsor.equals(PublicKey.default);
  
  if (!hasValidCreatedAt || !hasValidSponsor) {
    return {
      status: 'none',
      isValid: false,
    };
  }

  // Check license expiration
  if (userProfile.licenseExpiresAt.eq(new anchor.BN(0))) {
    return {
      status: 'none',
      isValid: false,
    };
  }

  const expirationDate = getLicenseExpiryDate(userProfile);
  
  // CRITICAL FIX: Check for Invalid Date (prevents false positives)
  if (isNaN(expirationDate.getTime())) {
    console.warn('⚠️ Invalid license expiration date detected, treating as no license');
    return {
      status: 'none',
      isValid: false,
    };
  }

  const now = new Date();
  const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Additional safety check for invalid calculations
  if (isNaN(daysRemaining)) {
    console.warn('⚠️ Invalid days remaining calculation, treating as no license');
    return {
      status: 'none',
      isValid: false,
    };
  }

  if (daysRemaining <= 0) {
    return {
      status: 'expired',
      expirationDate,
      daysRemaining: 0,
      isValid: false,
    };
  }

  if (daysRemaining <= 7) {
    return {
      status: 'near-expiry',
      expirationDate,
      daysRemaining,
      isValid: true,
    };
  }

  return {
    status: 'active',
    expirationDate,
    daysRemaining,
    isValid: true,
  };
}

// Minimal error message helper
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

/**
 * License activation instruction helper (Simplified Implementation)
 * 
 * Updated for the new contract implementation that avoids stack overflow
 * by using a simplified approach where all affiliate earnings go to dev profile.
 * 
 * @param program - Anchor program instance
 * @param user - User's PublicKey who is activating the license
 * @param amount - License fee amount in USDT (smallest unit)
 * @param usdtMint - USDT token mint address
 * @returns Transaction signature
 */
export async function activateLicenseUsdt(
  program: anchor.Program,
  user: PublicKey,
  amount: number | anchor.BN,
  usdtMint: PublicKey,
) {
  console.log('🚨 License activation with affiliate system');
  console.log('🚨 Function called with user:', user.toString());
  const { config, vault, profile } = derivePdas(user);
  console.log('🚨 Derived PDAs - profile:', profile?.toString());
  const bn = anchor.BN.isBN(amount) ? amount : new anchor.BN(amount);

  if (!profile) {
    throw new Error("Could not derive user profile PDA");
  }

  // STEP 1: Profile verification removed - contract handles profile creation automatically
  console.log('📝 Profile will be created automatically by contract if needed:', profile.toString());

  // STEP 2: Derive token accounts for USDT transfer
  const userUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: user,
  });

  const vaultUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: vault,
  });

  // STEP 3: Build sponsor hierarchy for affiliate earnings
  console.log('🌳 Building sponsor hierarchy for affiliate earnings...');
  const sponsorHierarchy = await buildSponsorHierarchy(program.provider as anchor.AnchorProvider, user);
  
  // NEW APPROACH: Pass USER ADDRESSES directly (not PDAs) to contract
  // Contract will derive PDAs internally and handle duplicates intelligently
  const sponsorAddresses = [
    sponsorHierarchy.sponsorL1,  // User address (not PDA)
    sponsorHierarchy.sponsorL2,  // User address (not PDA)
    sponsorHierarchy.sponsorL3,  // User address (not PDA)
  ];
  console.log('✅ Sponsor user addresses:', sponsorAddresses.map(addr => addr.toString()));
  
  // Also need to pass the corresponding PDAs for the contract to write to
  const sponsorPDAs = [
    derivePdas(sponsorHierarchy.sponsorL1).profile!,
    derivePdas(sponsorHierarchy.sponsorL2).profile!,
    derivePdas(sponsorHierarchy.sponsorL3).profile!,
  ];
  console.log('✅ Sponsor PDAs for writing:', sponsorPDAs.map(pda => pda.toString()));
  
  // Check for duplicates in user addresses (contract expects this)
  const uniqueAddresses = new Set(sponsorAddresses.map(addr => addr.toString()));
  console.log(`🔍 Unique sponsor addresses: ${uniqueAddresses.size}, Total levels: ${sponsorAddresses.length}`);
  
  if (uniqueAddresses.size < sponsorAddresses.length) {
    console.log('🎯 DUPLICATE SPONSORS DETECTED: Contract will accumulate earnings per unique user');
    console.log('💡 Same sponsor at multiple levels will receive combined earnings');
  } else {
    console.log('✅ All sponsors are unique, each will receive their level-specific earnings');
  }
  
  // Pass both user addresses AND their PDAs to contract
  // Contract expects: [userAddr1, userAddr2, userAddr3, pda1, pda2, pda3]
  const finalRemainingAccounts: Array<{
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }> = [
    // First pass user addresses (for deduplication logic)
    ...sponsorAddresses.map(pubkey => ({
      pubkey,
      isSigner: false,
      isWritable: false, // User addresses are read-only
    })),
    // Then pass corresponding PDAs (for writing earnings)
    ...sponsorPDAs.map(pubkey => ({
      pubkey,
      isSigner: false,
      isWritable: true, // PDAs need to be writable
    }))
  ];

  // SECURITY: Validate exactly 6 remaining accounts before sending to contract
  if (finalRemainingAccounts.length !== 6) {
    throw new Error(`Invalid remaining accounts count: expected 6, got ${finalRemainingAccounts.length}`);
  }

  // STEP 4: Get the actual dev profile from config (not from sponsor hierarchy)
  console.log('🔧 Fetching config to get actual dev profile...');
  const configData = await program.account["config"].fetch(config) as Config;
  const { profile: actualDevProfile } = derivePdas(configData.dev);
  console.log('✅ Actual dev profile PDA:', actualDevProfile?.toString());

  // Build accounts object with correct dev profile
  const accounts = {
    config,                    // Program configuration PDA
    vault,                     // Program vault PDA
    profile,                   // User's profile PDA
    user,                      // User's wallet (signer)
    usdtMint,                  // USDT token mint
    userUsdt,                  // User's USDT token account
    vaultUsdt,                 // Vault's USDT token account
    devProfile: actualDevProfile!, // FIXED: Use actual dev profile from config.dev
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
  };

  // STEP 5: Submit license activation transaction with sponsor profiles
  console.log('🚀 Submitting transaction with remaining_accounts:', finalRemainingAccounts.length, 'sponsor profiles');
  console.log('📋 Remaining accounts:', finalRemainingAccounts.map(acc => acc.pubkey.toString()));
  try {
    const txSignature = await program.methods
      .activateLicenseUsdt(bn, sponsorHierarchy.sponsorL1) // Pass amount and sponsor
      .accounts(accounts)
      .remainingAccounts(finalRemainingAccounts) // ← NEW: Contract handles duplicate PDAs intelligently
      .rpc();
    console.log('✅ Transaction successful:', txSignature);
    return txSignature;
  } catch (error) {
    console.error('❌ Contract transaction failed:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// Register user instruction helper - DISABLED: register_user method removed from contract
// export async function registerUser(
//   program: anchor.Program,
//   user: PublicKey,
//   sponsor: PublicKey, // Contract only accepts one sponsor parameter
// ) {
//   const { config, profile } = derivePdas(user);

//   if (!profile) {
//     throw new Error("Could not derive user profile PDA");
//   }

//   return program.methods
//     .registerUser(sponsor) // Contract expects only one sponsor parameter
//     .accounts({
//       config,
//       profile,
//       user,
//       systemProgram: anchor.web3.SystemProgram.programId,
//     })
//     .rpc();
// }

// Get license fee from config
export async function getLicenseFee(program: anchor.Program): Promise<{
  amount: anchor.BN;
  usdtMint: PublicKey;
  durationDays: number;
}> {
  const { config } = derivePdas();
  const configData = await program.account["config"].fetch(config) as Config;

  return {
    amount: configData.activationFeeUsdt,
    usdtMint: configData.usdtMint,
    durationDays: configData.licenseDurationDays,
  };
}

// Check if user needs registration
export async function needsRegistration(
  program: anchor.Program,
  user: PublicKey,
): Promise<boolean> {
  try {
    const { profile } = derivePdas(user);
    if (!profile) return true;
    await program.account["userProfile"].fetch(profile);
    return false; // Profile exists
  } catch (error) {
    return true; // Profile doesn't exist
  }
}

// Get affiliate earnings information from user profile
export function getAffiliateEarnings(userProfile: UserProfile): {
  totalEarnings: anchor.BN;
  totalWithdrawn: anchor.BN;
  availableToWithdraw: anchor.BN;
  level1Earnings: anchor.BN;
  level2Earnings: anchor.BN;
  level3Earnings: anchor.BN;
} {
  const availableToWithdraw = userProfile.totalAffiliateEarnings.sub(userProfile.totalAffiliateWithdrawn);
  
  return {
    totalEarnings: userProfile.totalAffiliateEarnings,
    totalWithdrawn: userProfile.totalAffiliateWithdrawn,
    availableToWithdraw,
    level1Earnings: userProfile.level1Earnings,
    level2Earnings: userProfile.level2Earnings,
    level3Earnings: userProfile.level3Earnings,
  };
}

// Comprehensive license status check
export async function checkLicenseStatus(
  program: anchor.Program,
  user: PublicKey,
): Promise<{
  hasProfile: boolean;
  licenseInfo: LicenseInfo;
  needsRegistration: boolean;
}> {
  try {
    const { profile } = derivePdas(user);
    if (!profile) {
      return {
        hasProfile: false,
        licenseInfo: { status: 'none', isValid: false },
        needsRegistration: true,
      };
    }
    
    const userProfile = await program.account["userProfile"].fetch(profile) as UserProfile;

    return {
      hasProfile: true,
      licenseInfo: getLicenseInfo(userProfile),
      needsRegistration: false,
    };
  } catch (error) {
    return {
      hasProfile: false,
      licenseInfo: {
        status: 'none',
        isValid: false,
      },
      needsRegistration: true,
    };
  }
}

// Withdraw affiliate earnings
export async function withdrawAffiliateEarnings(
  program: anchor.Program,
  user: PublicKey,
  amount: number | anchor.BN,
  usdtMint: PublicKey
) {
  const { config, vault, profile } = derivePdas(user);
  const bn = anchor.BN.isBN(amount) ? amount : new anchor.BN(amount);

  if (!profile) {
    throw new Error("Could not derive user profile PDA");
  }

  const userUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: user,
  });

  const vaultUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: vault,
  });

  return program.methods
    .withdrawAffiliateEarnings(bn)
    .accounts({
      config,
      vault,
      user,
      profile,
      usdtMint,
      userUsdt,
      vaultUsdt,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    })
    .rpc();
}

// Agent tier helper functions
export function getAgentTierConfig(tier: AgentTier): AgentTierConfig {
  return AGENT_TIER_CONFIGS[tier];
}

export function getAgentTierName(tier: number): string {
  const tierConfig = AGENT_TIER_CONFIGS[tier as AgentTier];
  return tierConfig ? tierConfig.name : 'UNKNOWN';
}

export function getAgentTierEmoji(tier: number): string {
  const tierConfig = AGENT_TIER_CONFIGS[tier as AgentTier];
  return tierConfig ? tierConfig.emoji : '❓';
}

export function calculateYieldCap(tier: number, activationAmount: anchor.BN): anchor.BN {
  const tierConfig = AGENT_TIER_CONFIGS[tier as AgentTier];
  if (!tierConfig) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  
  return activationAmount
    .mul(new anchor.BN(tierConfig.yieldCapPct))
    .div(new anchor.BN(100));
}

export function calculateYieldCapProgress(
  tier: number,
  activationAmount: anchor.BN,
  totalWithdrawn: anchor.BN
): number {
  const yieldCap = calculateYieldCap(tier, activationAmount);
  if (yieldCap.eq(new anchor.BN(0))) return 0;
  
  return totalWithdrawn.mul(new anchor.BN(100)).div(yieldCap).toNumber();
}

// Withdrawal limit helper functions
export interface WithdrawalLimitStatus {
  totalDeposits: anchor.BN;
  totalWithdrawn: anchor.BN;
  maxWithdrawable: anchor.BN;
  remainingWithdrawable: anchor.BN;
  limitReached: boolean;
  isPrivileged: boolean;
  usagePercentage: number;
}

export function calculateWithdrawalLimitStatus(
  userProfile: UserProfile,
  isPrivileged: boolean = false
): WithdrawalLimitStatus {
  const totalDeposits = userProfile.totalAgentDeposits;
  const totalWithdrawn = userProfile.totalRoiWithdrawn;
  // 200% = 2x multiplier (user can withdraw 2x their total deposits)
  const maxWithdrawable = totalDeposits.mul(new anchor.BN(2));
  
  const remainingWithdrawable = isPrivileged 
    ? new anchor.BN(Number.MAX_SAFE_INTEGER) // Unlimited for privileged users
    : maxWithdrawable.sub(totalWithdrawn);
  
  const limitReached = !isPrivileged && totalWithdrawn.gte(maxWithdrawable);
  
  const usagePercentage = isPrivileged 
    ? 0 
    : maxWithdrawable.eq(new anchor.BN(0)) 
      ? 0 
      : totalWithdrawn.mul(new anchor.BN(100)).div(maxWithdrawable).toNumber();

  return {
    totalDeposits,
    totalWithdrawn,
    maxWithdrawable,
    remainingWithdrawable,
    limitReached,
    isPrivileged,
    usagePercentage
  };
}

// Agent timing helper functions
export function canWithdrawRoi(
  activation: UserAgentActivation,
  currentTimestamp: number = Math.floor(Date.now() / 1000),
  secondsPerDay: number = 86400 // Default to 24 hours, but can be overridden for debug mode
): {
  canWithdraw: boolean;
  reason?: string;
  nextWithdrawalAt?: Date;
} {
  // Check if agent has reached yield cap
  if (activation.yieldCapReached) {
    return {
      canWithdraw: false,
      reason: 'Agent has reached yield cap and is retired'
    };
  }

  const activationTime = activation.startedAt.toNumber();
  const lastWithdrawalTime = activation.lastRoiWithdrawAt.toNumber();
  
  // Use dynamic timing instead of hardcoded 24 hours
  const timeSinceActivation = currentTimestamp - activationTime;
  if (timeSinceActivation < secondsPerDay) {
    const nextWithdrawalAt = new Date((activationTime + secondsPerDay) * 1000);
    const waitTime = secondsPerDay === 300 ? '5 minutes' : '24 hours';
    return {
      canWithdraw: false,
      reason: `Must wait ${waitTime} after activation`,
      nextWithdrawalAt
    };
  }

  // Check timing since last withdrawal (if any)
  if (lastWithdrawalTime > 0) {
    const timeSinceLastWithdrawal = currentTimestamp - lastWithdrawalTime;
    if (timeSinceLastWithdrawal < secondsPerDay) {
      const nextWithdrawalAt = new Date((lastWithdrawalTime + secondsPerDay) * 1000);
      const waitTime = secondsPerDay === 300 ? '5 minutes' : '24 hours';
      return {
        canWithdraw: false,
        reason: `Must wait ${waitTime} between withdrawals`,
        nextWithdrawalAt
      };
    }
  }

  return { canWithdraw: true };
}