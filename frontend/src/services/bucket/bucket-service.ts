import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BucketType } from '@/hooks/useBucketBalances';
import { API_CONFIG, ApiClient } from '@/config/service-endpoints';
import { ensureUserUsdtAta, isAtaSetupRequired } from '@/utils/ensure-usdt-ata';

export function normalizeBucketType(bucketType: BucketType): string {
  switch (bucketType) {
    case 'admin': return 'admin';
    case 'dev': return 'dev';
    case 'marketer1': return 'marketer1';
    case 'marketer2': return 'marketer2';
    case 'trader': return 'trader';
    case 'reserve': return 'reserve';
    default: throw new Error(`Invalid bucket type: ${bucketType}`);
  }
}

export interface WithdrawBucketParams {
  connection: Connection;
  bucketType: BucketType;
  amount: number; // micro-USDT
  authority: PublicKey;
  usdtMint?: PublicKey; // unused (recipient = acting admin's wallet, treasury pays out) — kept for callers
  memo?: string;
  signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
}

/**
 * Withdraw from a role/admin bucket. Treasury pays out server-side to the acting
 * admin's connected wallet (no SC, no user-signed payout). If the wallet has no USDT
 * account, the one-time setup gate runs first (user pays their own refundable rent).
 * Returns the payout signature.
 */
export async function withdrawFromBucket({
  connection,
  bucketType,
  amount,
  authority,
  signTransaction,
}: WithdrawBucketParams): Promise<string> {
  if (amount <= 0) {
    throw new Error('Invalid amount. Must be greater than zero.');
  }

  const bucketParam = normalizeBucketType(bucketType);
  const amountMicro = Math.round(amount);
  const url = `${API_CONFIG.getBaseUrl()}/admin/buckets/${bucketParam}/withdraw`;
  const post = () => ApiClient.post(url, { amountMicro });

  let resp = await post();
  let json = await resp.json().catch(() => ({} as Record<string, unknown>));

  // One-time USDT-account setup gate (NOT an error) — admin creates their own account.
  if (resp.ok && isAtaSetupRequired(json)) {
    if (!signTransaction) throw new Error('Your wallet needs to set up a USDT account first, but it can’t sign.');
    await ensureUserUsdtAta(connection, { publicKey: authority, signTransaction });
    resp = await post();
    json = await resp.json().catch(() => ({} as Record<string, unknown>));
    if (isAtaSetupRequired(json)) throw new Error('USDT account setup didn’t complete. Please try again.');
  }

  if (!resp.ok) throw new Error((json as { error?: string }).error || 'Bucket withdrawal failed');

  const status = (json as { status?: string }).status;
  if (resp.status === 202 || status === 'processing') {
    throw new Error('Withdrawal submitted — confirmation pending. It will be reconciled automatically.');
  }

  const signature = (json as { signature?: string }).signature;
  if (!signature) throw new Error('Backend did not return a payout signature');
  return signature;
}

export function formatUsdtAmount(amountMicro: number): string {
  const whole = Math.floor(amountMicro / 1_000_000);
  const frac = String(Math.abs(amountMicro) % 1_000_000).padStart(6, '0');
  return `${whole}.${frac}`;
}

export function parseUsdtAmount(amountStr: string): number {
  const parts = amountStr.split('.');
  const wholePart = parseInt(parts[0] || '0', 10);
  const fracStr = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  const fracPart = parseInt(fracStr, 10);
  return wholePart * 1_000_000 + fracPart;
}
