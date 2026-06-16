import * as anchor from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";

/**
 * ensureAtaExists
 * Purpose: Idempotently ensure an associated token account exists for a given owner and mint.
 * Inputs:
 * - provider: Anchor provider to use for sending transactions
 * - payer: PublicKey who pays rent for ATA creation (usually the user)
 * - owner: PublicKey that will own the ATA (user or PDA)
 * - mint: SPL token mint for which to create the ATA
 * Output:
 * - Returns the ATA address and whether it was created in this call; includes a creation signature if applicable
 * Core Logic:
 * - Derive ATA via anchor.utils.token.associatedAddress
 * - Check existence via connection.getAccountInfo
 * - If missing, build and send createAssociatedTokenAccountInstruction
 */
export async function ensureAtaExists(
  provider: anchor.AnchorProvider,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<{ ata: PublicKey; created: boolean; signature?: string }> {
  const connection = provider.connection;
  const ata = anchor.utils.token.associatedAddress({ mint, owner });

  const info = await connection.getAccountInfo(ata);
  if (info) {
    return { ata, created: false };
  }

  const ix: TransactionInstruction = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    owner,
    mint
  );

  const tx = new anchor.web3.Transaction().add(ix);
  const sig = await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
  return { ata, created: true, signature: sig };
}