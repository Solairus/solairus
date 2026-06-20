import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { BucketType } from '@/hooks/useBucketBalances';
import { API_CONFIG, BUCKET_ENDPOINTS, ApiClient } from '@/config/service-endpoints';
import { confirmAndRecord } from '@/services/transactions/confirmAndRecord';
import { Connection } from '@solana/web3.js';

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
  amount: number;
  authority: PublicKey;
  usdtMint: PublicKey;
  memo?: string;
  signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
}

export async function withdrawFromBucket({
  connection,
  bucketType,
  amount,
  authority,
  usdtMint,
  memo,
  signTransaction,
}: WithdrawBucketParams): Promise<string> {
  if (amount <= 0) {
    throw new Error('Invalid amount. Must be greater than zero.');
  }

  const recipientAta = getAssociatedTokenAddressSync(usdtMint, authority);
  const amountMicro = Math.round(amount);
  const bucketParam = normalizeBucketType(bucketType);

  const initUrl = BUCKET_ENDPOINTS.buildUrl(BUCKET_ENDPOINTS.initBucketWithdrawal, { bucketType: bucketParam });
  const initResp = await ApiClient.post(initUrl, {
    amountMicro,
    mintAddress: usdtMint.toBase58(),
    recipientAta: recipientAta.toBase58(),
    memo: memo || `Bucket:${bucketParam}`,
  });

  const initData = await initResp.json();
  const { txBase64, orderId } = initData;

  const txBytes = Buffer.from(txBase64, 'base64');
  let tx: VersionedTransaction | Transaction;
  try {
    tx = VersionedTransaction.deserialize(txBytes);
  } catch {
    tx = Transaction.from(txBytes);
  }

  if (typeof signTransaction === 'function') {
    tx = await signTransaction(tx);
  }

  const { signature } = await confirmAndRecord({ connection, signedTx: tx as VersionedTransaction, orderId });
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
