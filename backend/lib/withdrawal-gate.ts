/**
 * Shared helpers for treasury-payout withdrawal routes (user withdrawals + bucket/admin payouts).
 * Keeps the ATA-setup gate and post-broadcast detection consistent across routes.
 */
import { ATA_RENT_LAMPORTS } from './usdt-transfer'

/**
 * Build the "set up USDT first" gate payload. This is NOT an error — it's a normal
 * one-time step the user must complete (create their own USDT account). The platform
 * never pays this rent. Returned with HTTP 200 + a status discriminator.
 */
export function ataSetupRequiredPayload(recipient: string, recipientAta: string, mint: string) {
  return {
    status: 'ata_setup_required' as const,
    recipient,
    recipientAta,
    mint,
    rentLamports: ATA_RENT_LAMPORTS,
    rentSol: ATA_RENT_LAMPORTS / 1_000_000_000,
    message:
      'Your wallet needs to set up a USDT account before it can receive this withdrawal. ' +
      'This is a one-time step and costs a small, refundable network deposit (~0.002 SOL). ' +
      'Approve the request in your wallet to finish.',
  }
}

/** True when the failure happened AFTER broadcast (confirmation uncertain) — never auto-revert these. */
export function isPostBroadcastError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return (
    msg.includes('was not confirmed') ||
    msg.includes('block height exceeded') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('confirmtransaction')
  )
}
