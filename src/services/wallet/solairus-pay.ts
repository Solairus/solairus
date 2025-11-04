import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "@/idl/solairus_pay.json";
import { ensureAtaExists } from "@/utils/token-ata";

/**
 * SolairusPayService
 * Purpose: Pluggable service for write interactions with solairus_pay program.
 * Methods: makePayment, withdrawReward
 * Inputs: Provider (AnchorProvider), mint, amount, recipient, memo
 * Outputs: Transaction signature string from devnet/mainnet
 * Notes: Uses devnet by default; expects correct wallet (authority for withdraw)
 */
export class SolairusPayService {
  private program: anchor.Program;

  /**
   * Initializes Anchor Program instance using processed IDL.
   * - Adds root-level address field
   * - Fixes type compatibility (publicKey -> pubkey)
   */
  constructor(provider: anchor.AnchorProvider) {
    const rawIdl = idl as unknown as { address?: string; metadata?: { address?: string } };
    const fixedIdl = SolairusPayService.fixIdlTypes({
      ...idl,
      address: rawIdl.address ?? rawIdl.metadata?.address,
    }) as unknown as anchor.Idl;

    this.program = new anchor.Program(fixedIdl, provider);
  }

  /** Fix IDL types for Anchor compatibility */
  private static fixIdlTypes(obj: unknown): unknown {
    if (typeof obj === "string") {
      return obj === "publicKey" ? "pubkey" : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(SolairusPayService.fixIdlTypes);
    }
    if (typeof obj === "object" && obj !== null) {
      const fixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (key === "defined" && typeof value === "string") {
          fixed[key] = { name: value };
        } else {
          fixed[key] = SolairusPayService.fixIdlTypes(value);
        }
      }
      return fixed;
    }
    return obj;
  }

  /** Returns the program ID */
  get programId(): PublicKey {
    return this.program.programId;
  }

  /** Derive vault authority PDA for a given mint */
  private deriveVaultAuthority(mint: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([
      Buffer.from("vault"),
      mint.toBuffer(),
    ], this.program.programId);
    return pda;
  }

  /** Derive config PDA */
  private deriveConfigPDA(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([
      Buffer.from("config"),
    ], this.program.programId);
    return pda;
  }

  /**
   * makePayment: Transfer SPL tokens from payer to vault ATA.
   * - payer must be the connected wallet
   * - mint is the SPL token mint (USDT)
   * - recipient is a PublicKey used in event metadata
   * - amount is in base units (e.g., 6 decimals for USDT)
   * - memo is an optional string (<= 128 chars)
   */
  async makePayment(params: {
    payer: PublicKey; // should match provider.wallet.publicKey
    mint: PublicKey;
    recipient: PublicKey;
    amount: number | anchor.BN;
    memo?: string;
  }): Promise<string> {
    const { payer, mint, recipient, amount, memo = "" } = params;

    // Derive addresses
    const payerAtaDerived = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const vaultAuthority = this.deriveVaultAuthority(mint);
    const vaultAtaDerived = getAssociatedTokenAddressSync(mint, vaultAuthority, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    // Idempotently ensure ATAs exist before RPC to avoid AccountNotInitialized
    const provider = this.program.provider as anchor.AnchorProvider;
    const { ata: payerAta } = await ensureAtaExists(provider, payer, payer, mint);
    const { ata: vaultAta } = await ensureAtaExists(provider, payer, vaultAuthority, mint);

    const args = {
      recipient,
      mint,
      amount: anchor.BN.isBN(amount) ? amount : new anchor.BN(amount),
      decimals: 6,
      memo,
    };

    const txSig = await this.program.methods
      .makePayment(args)
      .accounts({
        payer,
        mint,
        payerAta,
        vaultAuthority,
        vaultAta,
        reference: payer,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return txSig;
  }

  /**
   * withdrawReward: Payout from vault to recipient using backend authority.
   * - authority must be the backend authority stored in config PDA
   * - recipient is the destination owner
   * - mint is the SPL token mint (USDT)
   * - amount is in base units
   * - memo is optional
   */
  async withdrawReward(params: {
    authority: PublicKey; // must be provider.wallet.publicKey and equal to config.backend_authority
    recipient: PublicKey;
    mint: PublicKey;
    amount: number | anchor.BN;
    memo?: string;
  }): Promise<string> {
    const { authority, recipient, mint, amount, memo = "" } = params;

    const vaultAuthority = this.deriveVaultAuthority(mint);
    const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuthority, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const recipientAta = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const config = this.deriveConfigPDA();

    const args = {
      recipient,
      mint,
      amount: anchor.BN.isBN(amount) ? amount : new anchor.BN(amount),
      decimals: 6,
      memo,
    };

    const txSig = await this.program.methods
      .claimRewards(args)
      .accounts({
        authority,
        recipient,
        mint,
        vaultAuthority,
        vaultAta,
        recipientAta,
        reference: authority,
        config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return txSig;
  }
}

/**
 * Helper to create provider from wallet adapter and connection.
 * - Defaults to devnet RPC via cluster switcher outside this module.
 */
export function createProvider(connection: anchor.web3.Connection, wallet: anchor.Wallet) {
  const opts = anchor.AnchorProvider.defaultOptions();
  return new anchor.AnchorProvider(connection, wallet, opts);
}

/**
 * Usage Guide
 * - Create provider from your wallet adapter connection
 *   const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl('devnet'));
 *   const provider = createProvider(connection, walletAdapter);
 * - Instantiate service
 *   const service = new SolairusPayService(provider);
 * - Make payment (payer = wallet)
 *   await service.makePayment({ payer: wallet.publicKey, mint: usdtMint, recipient, amount: 25_000_000, memo: 'license' });
 * - Withdraw reward (authority must equal config.backend_authority)
 *   await service.withdrawReward({ authority: backendAuthority, recipient, mint: usdtMint, amount: 10_000_000, memo: 'payout' });
 */