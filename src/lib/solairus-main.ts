import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "@/idl/solairus_main.json";

// Lightweight client helpers for the solairus_main program, following existing patterns.

// Resolve program address from IDL (prefer root.address, fallback to metadata.address)
const mainIdl = idl as unknown as { address?: string; metadata?: { address?: string } };
export const PROGRAM_ID = new PublicKey(
  (mainIdl.address ?? mainIdl.metadata?.address ?? "")
);

// Error codes from IDL for optional human-friendly messages
export const ERROR_CODES = {
  Unauthorized: 6000,
  InvalidPercent: 6001,
  InvalidConfigSum: 6002,
  MathOverflow: 6003,
  InvalidAmount: 6004,
} as const;

export type ErrorCodeName = keyof typeof ERROR_CODES;

// Anchor Program factory using the IDL directly
export function getProgram(provider: anchor.AnchorProvider) {
  // The IDL already contains the program address; Program can be constructed with idl only
  const processedIdl = idl as unknown as anchor.Idl;
  return new anchor.Program(processedIdl, provider);
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

// Derive affiliate earnings PDA for a given owner
export function deriveAffiliateEarningsPda(owner: PublicKey) {
  return PublicKey.findProgramAddressSync([
    Buffer.from("affiliate"),
    owner.toBuffer(),
  ], PROGRAM_ID)[0];
}

// Convenience accessors for Anchor account clients
export function accounts(program: anchor.Program) {
  // The names match IDL "accounts" definitions
  return {
    AffiliateEarnings: program.account["affiliateEarnings"] as anchor.AccountClient,
    Config: program.account["config"] as anchor.AccountClient,
    UserAgentActivation: program.account["userAgentActivation"] as anchor.AccountClient,
    UserAgentCounter: program.account["userAgentCounter"] as anchor.AccountClient,
    UserProfile: program.account["userProfile"] as anchor.AccountClient,
    Vault: program.account["vault"] as anchor.AccountClient,
  };
}

// Minimal error message helper
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

// Example usage:
// const program = getProgram(anchorProvider);
// const { config, vault, profile } = derivePdas(userPublicKey);
// const cfg = await accounts(program).Config.fetch(config);

// Instruction helpers
export async function activateAgentCredit(
  program: anchor.Program,
  user: PublicKey,
  amount: number | anchor.BN,
) {
  const { config } = derivePdas(user);
  const bn = anchor.BN.isBN(amount) ? amount : new anchor.BN(amount);
  return program.methods.activateAgentCredit(bn).accounts({ config, user }).rpc();
}

export async function withdrawCommissions(
  program: anchor.Program,
  caller: PublicKey,
) {
  const affiliate = deriveAffiliateEarningsPda(caller);
  const { config } = derivePdas();
  return program.methods.withdrawCommissions().accounts({ config, affiliate, caller }).rpc();
}