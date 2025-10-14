import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "@/idl/license_activation.json";

export type Role = "Admin" | "Dev" | "Marketer1" | "Marketer2" | "Reserve";

export const PROGRAM_ID = new PublicKey(idl.metadata.address);

export function getProgram(provider: anchor.AnchorProvider) {
  // Fix IDL compatibility issues for Anchor:
  // 1. Add address field at root level (Anchor expects idl.address)
  // 2. Convert "publicKey" to "pubkey" for type compatibility
  // 3. Convert defined types from string to object format (Anchor expects {name: string})
  // 4. Restructure accounts to move inline types to types array and add discriminators
  const fixIdlTypes = (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      return obj === 'publicKey' ? 'pubkey' : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(fixIdlTypes);
    }
    if (typeof obj === 'object' && obj !== null) {
      const fixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Fix defined types: convert "Role" to {name: "Role"}
        if (key === 'defined' && typeof value === 'string') {
          fixed[key] = { name: value };
        } else {
          fixed[key] = fixIdlTypes(value);
        }
      }
      return fixed;
    }
    return obj;
  };

  const baseFixedIdl = fixIdlTypes({
    ...idl,
    address: idl.metadata.address  // Add address field for Anchor
  }) as Record<string, unknown> & {
    accounts: Record<string, unknown>[];
    types: Record<string, unknown>[];
  };

  // Restructure accounts: move inline type definitions to types array and add discriminators
  const accountTypes: Record<string, unknown>[] = [];
  const fixedAccounts = baseFixedIdl.accounts.map((account: Record<string, unknown>, index: number) => {
    if (account.type && !account.discriminator) {
      // Move the inline type definition to the types array
      accountTypes.push({
        name: account.name,
        type: account.type
      });

      // Create a simple discriminator (8 bytes, using account index)
      const discriminator = new Array(8).fill(0);
      discriminator[0] = index + 1; // Simple discriminator based on index

      return {
        name: account.name,
        discriminator
      };
    }
    return account;
  });

  const finalIdl = {
    ...baseFixedIdl,
    accounts: fixedAccounts,
    types: [...baseFixedIdl.types, ...accountTypes]
  };

  return new anchor.Program(finalIdl as unknown as anchor.Idl, provider);
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