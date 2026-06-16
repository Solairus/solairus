import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
// Deprecated: license_activation IDL removed; using SolairusPay only

export type Role = "Admin" | "Dev" | "Marketer1" | "Marketer2" | "Reserve";

export const PROGRAM_ID = PublicKey.default;

export function getProgram(_provider: anchor.AnchorProvider) {
  // Deprecated: License activation program has been removed. Use SolairusPay service.
  throw new Error("License activation program has been deprecated; use SolairusPay service.");
}

export function derivePdas(user?: PublicKey | null) {
  const enc = new TextEncoder();
  const [config] = PublicKey.findProgramAddressSync([enc.encode("config")], PROGRAM_ID);
  const [vault] = PublicKey.findProgramAddressSync([enc.encode("vault")], PROGRAM_ID);
  const license = user ? PublicKey.findProgramAddressSync([enc.encode("license"), user.toBytes()], PROGRAM_ID)[0] : null;
  return { config, vault, license };
}

export function accounts(program: anchor.Program) {
  const pa = program.account as unknown as Record<string, anchor.AccountClient>;
  return {
    config: pa["config"],
    userLicense: pa["userLicense"],
  };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Instruction wrappers
export async function initializeConfig(
  program: anchor.Program,
  dev: PublicKey,
  config: PublicKey,
  vault: PublicKey,
  args: {
    admin: PublicKey;
    marketer1: PublicKey;
    marketer2: PublicKey;
    usdtPriceCents: anchor.BN;
    durationDays: number; // u16
    usdtMint: PublicKey;
  }
) {
  return program.methods
    .initializeConfig(
      args.admin,
      args.marketer1,
      args.marketer2,
      args.usdtPriceCents,
      args.durationDays,
      args.usdtMint
    )
    .accounts({ dev, config, vault, systemProgram: SystemProgram.programId })
    .rpc();
}

export async function updateLicenseConfig(
  program: anchor.Program,
  authority: PublicKey,
  config: PublicKey,
  opts: {
    usdtPriceCents?: anchor.BN | null;
    durationDays?: number | null;
    usdtMint?: PublicKey | null;
  }
) {
  return program.methods
    .updateLicenseConfig(
      opts.usdtPriceCents ?? null,
      opts.durationDays ?? null,
      opts.usdtMint ?? null
    )
    .accounts({ authority, config })
    .rpc();
}