import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "@/idl/solairus_main.json";

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
} as const;

export type ErrorCodeName = keyof typeof ERROR_CODES;

// Anchor Program factory with v0.32.1 compatibility fixes
export function getProgram(provider: anchor.AnchorProvider) {
  console.log('🔧 Creating program with provider for:', PROGRAM_ID.toString());
  console.log('🔧 IDL reload timestamp:', Date.now());

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

  return { config, vault, profile, counter };
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

// TypeScript interfaces for smart contract data
export interface UserProfile {
  user: PublicKey;              // User's wallet address
  sponsorL1: PublicKey;         // Level 1 sponsor (direct referrer)
  sponsorL2: PublicKey;         // Level 2 sponsor (sponsor's sponsor)
  sponsorL3: PublicKey;         // Level 3 sponsor (L2's sponsor)
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
  const now = Math.floor(Date.now() / 1000);
  // Use toString() and comparison for large numbers to avoid precision issues
  return userProfile.licenseExpiresAt.gt(new anchor.BN(now));
}

export function getLicenseExpiryDate(userProfile: UserProfile): Date {
  // Handle large BN values safely
  const timestampSeconds = userProfile.licenseExpiresAt.toString();
  const timestampMs = parseInt(timestampSeconds) * 1000;
  return new Date(timestampMs);
}

export function getLicenseInfo(userProfile: UserProfile | null): LicenseInfo {
  if (!userProfile || userProfile.licenseExpiresAt.eq(new anchor.BN(0))) {
    return {
      status: 'none',
      isValid: false,
    };
  }

  const expirationDate = getLicenseExpiryDate(userProfile);
  const now = new Date();
  const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
  console.log('🚨 License activation with simplified affiliate system');
  console.log('🚨 Function called with user:', user.toString());
  const { config, vault, profile } = derivePdas(user);
  console.log('🚨 Derived PDAs - profile:', profile?.toString());
  const bn = anchor.BN.isBN(amount) ? amount : new anchor.BN(amount);

  if (!profile) {
    throw new Error("Could not derive user profile PDA");
  }

  // STEP 1: Verify user profile exists
  console.log('🔍 Looking for user profile at PDA:', profile.toString());
  try {
    await program.account["userProfile"].fetch(profile);
    console.log('✅ User profile found');
  } catch (error) {
    console.error('❌ Failed to fetch user profile:', error);
    throw new Error("User profile not found. Please register first.");
  }

  // STEP 2: Derive token accounts for USDT transfer
  const userUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: user,
  });

  const vaultUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: vault,
  });

  // STEP 3: Get config to find dev account
  const configData = await program.account["config"].fetch(config) as Config;
  const devProfile = derivePdas(configData.dev).profile!;

  // STEP 4: Build simplified accounts object (no sponsor profiles needed)
  const accounts = {
    config,                    // Program configuration PDA
    vault,                     // Program vault PDA  
    profile,                   // User's profile PDA
    user,                      // User's wallet (signer)
    usdtMint,                  // USDT token mint
    userUsdt,                  // User's USDT token account
    vaultUsdt,                 // Vault's USDT token account
    devProfile,                // Dev profile (receives all affiliate earnings)
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
  };

  // STEP 5: Submit license activation transaction
  console.log('🚀 Submitting transaction with simplified accounts');
  try {
    const txSignature = await program.methods
      .activateLicenseUsdt(bn)
      .accounts(accounts)
      .rpc();
    console.log('✅ Transaction successful:', txSignature);
    return txSignature;
  } catch (error) {
    console.error('❌ Contract transaction failed:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// Register user instruction helper
export async function registerUser(
  program: anchor.Program,
  user: PublicKey,
  sponsorL1: PublicKey,
  sponsorL2: PublicKey,
  sponsorL3: PublicKey,
) {
  const { config, profile } = derivePdas(user);

  if (!profile) {
    throw new Error("Could not derive user profile PDA");
  }

  return program.methods
    .registerUser(sponsorL1, sponsorL2, sponsorL3)
    .accounts({
      config,
      profile,
      user,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
}

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