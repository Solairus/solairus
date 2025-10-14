import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "@/idl/solairus_core.json";

// Core helpers for Solairus Core UI tests using the solairus_core IDL directly.

// Resolve program address from IDL (root.address preferred per project rules)
const coreIdl = idl as unknown as { address?: string; metadata?: { address?: string } };
export const PROGRAM_ID = new PublicKey(
  (coreIdl.address ?? coreIdl.metadata?.address ?? "")
);

export function getProgram(provider: anchor.AnchorProvider) {
  // Fix IDL compatibility issues for Anchor:
  // 1. Add address field at root level (Anchor expects idl.address)
  // 2. Convert "publicKey" to "pubkey" for type compatibility
  // 3. Convert defined types from string to object format (Anchor expects {name: string})
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
    ...coreIdl,
    address: coreIdl.address ?? coreIdl.metadata?.address  // Add address field for Anchor
  }) as Record<string, unknown> & {
    accounts: Record<string, unknown>[];
    types: Record<string, unknown>[];
  };

  // Restructure accounts: move inline type definitions to types array and add REAL discriminators
  const accountTypes: Record<string, unknown>[] = [];

  // Real discriminators extracted from on-chain account data
  const realDiscriminators: Record<string, number[]> = {
    config: [155, 12, 170, 224, 30, 250, 204, 130],
    vault: [211, 8, 232, 43, 2, 152, 117, 119],
    userLicense: [0, 0, 0, 0, 0, 0, 0, 0] // Placeholder - will be updated when we find a real one
  };

  const fixedAccounts = baseFixedIdl.accounts.map((account: Record<string, unknown>) => {
    if (account.type && !account.discriminator) {
      // Move the inline type definition to the types array
      accountTypes.push({
        name: account.name,
        type: account.type
      });

      // Use the real discriminator from on-chain data
      const accountName = account.name as string;
      const discriminator = realDiscriminators[accountName] || [0, 0, 0, 0, 0, 0, 0, 0];

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
  const license = user
    ? PublicKey.findProgramAddressSync([enc.encode("license"), user.toBytes()], PROGRAM_ID)[0]
    : null;
  // Best-effort derivation for a potential user deposit PDA. Actual seed may differ.
  const userDeposit = user
    ? PublicKey.findProgramAddressSync([enc.encode("user_deposit"), user.toBytes()], PROGRAM_ID)[0]
    : null;
  return { config, vault, userDeposit, license };
}

export function accounts(program: anchor.Program) {
  const pa = program.account as unknown as Record<string, anchor.AccountClient>;
  return {
    config: pa["config"],
    userLicense: pa["userLicense"],
    // userDeposit may be undefined if not present in the IDL; callers should handle errors.
    userDeposit: pa["userDeposit"] as anchor.AccountClient | undefined,
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

// Safe account fetch with owner preflight to avoid invalid discriminator errors
export async function safeFetchAccount<T = unknown>(
  program: anchor.Program,
  client: anchor.AccountClient,
  address: PublicKey
): Promise<T> {
  const info = await program.provider.connection.getAccountInfo(address);
  if (!info) throw new Error("Account not found");
  if (!info.owner.equals(PROGRAM_ID)) throw new Error("Account owned by different program");
  const data = await client.fetch(address);
  return data as T;
}

// Instruction wrappers mapped to IDL
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

// Minimal token transfer helper to simulate "depositUsdt" for UI testing.
// This performs a direct SPL Token transfer from user ATA to vault ATA.
export async function depositUsdt(
  program: anchor.Program,
  user: PublicKey,
  _pdas: { config: PublicKey; vault: PublicKey; userDeposit: PublicKey },
  atAs: { mint: PublicKey; userAta: PublicKey; vaultAta: PublicKey },
  amount: anchor.BN
) {
  const tx = new Transaction().add(
    createTransferInstruction(
      atAs.userAta,
      atAs.vaultAta,
      user,
      amount.toNumber(),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  const sig = await (program.provider as any).sendAndConfirm(tx, [], { skipPreflight: true });
  return sig as string;
}

// Placeholder terminate helper. The actual instruction depends on core program.
export async function terminate(
  _program: anchor.Program,
  _dev: PublicKey,
  _config: PublicKey,
  _vault: PublicKey
) {
  throw new Error("terminate instruction not available in current IDL");
}