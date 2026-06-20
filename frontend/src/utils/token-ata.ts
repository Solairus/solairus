import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

export async function ensureAtaExists(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  sendTransaction: (tx: Transaction) => Promise<string>
): Promise<{ ata: PublicKey; created: boolean; signature?: string }> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) {
    return { ata, created: false };
  }

  const ix = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
  const tx = new Transaction().add(ix);
  const sig = await sendTransaction(tx);
  return { ata, created: true, signature: sig };
}
