import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BucketType } from '@/hooks/useBucketBalances';
import { API_CONFIG, BUCKET_ENDPOINTS, ApiClient } from '@/config/service-endpoints';
import { confirmAndRecord } from '@/services/transactions/confirmAndRecord';
import { Connection } from '@solana/web3.js';

// Bucket enum mapping to match the contract
export function normalizeBucketType(bucketType: BucketType): string {
  // Map UI bucket type to backend route param
  switch (bucketType) {
    case 'admin':
      return 'admin';
    case 'dev':
      return 'dev';
    case 'marketer_1':
      return 'marketer_1';
    case 'marketer_2':
      return 'marketer_2';
    case 'trader':
      return 'trader';
    case 'reserve':
      return 'reserve';
    default:
      throw new Error(`Invalid bucket type: ${bucketType}`);
  }
}

export interface WithdrawBucketParams {
  provider: anchor.AnchorProvider;
  connection: Connection;
  bucketType: BucketType;
  amount: anchor.BN;
  authority: PublicKey;
  usdtMint: PublicKey;
  memo?: string;
  signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
}

export async function withdrawFromBucket({
  provider,
  connection,
  bucketType,
  amount,
  authority,
  usdtMint,
  memo,
}: WithdrawBucketParams): Promise<string> {
  // Validate amount
  if (amount.lte(new anchor.BN(0))) {
    throw new Error('Invalid amount. Must be greater than zero.');
  }

  // Derive recipient ATA and validate
  const recipientAta = anchor.utils.token.associatedAddress({ mint: usdtMint, owner: authority });

  const amountMicro = amount.toNumber();
  const bucketParam = normalizeBucketType(bucketType);

  // Initialize withdrawal via backend
  const initUrl = BUCKET_ENDPOINTS.buildUrl(BUCKET_ENDPOINTS.initBucketWithdrawal, { bucketType: bucketParam });
  const initResp = await ApiClient.post(initUrl, {
    amountMicro,
    mintAddress: usdtMint.toBase58(),
    recipientAta: recipientAta.toBase58(),
    memo: memo || `Bucket:${bucketParam}`,
  });

  const initData = await initResp.json();
  const { txBase64, orderId } = initData;

  // Decode and send transaction
  const txBytes = Buffer.from(txBase64, 'base64');
  let tx: VersionedTransaction | Transaction;
  try {
    tx = VersionedTransaction.deserialize(txBytes);
  } catch {
    tx = Transaction.from(txBytes);
  }

  // Sign using wallet adapter if available
  if (typeof signTransaction === 'function') {
    tx = await signTransaction(tx);
  } else if (provider.wallet && typeof provider.wallet.signTransaction === 'function') {
    tx = await provider.wallet.signTransaction(tx as Transaction);
  }

  const { signature } = await confirmAndRecord({ connection, signedTx: tx as VersionedTransaction, orderId })
  return signature;
}

export function formatUsdtAmount(amount: anchor.BN): string {
  // USDT has 6 decimal places
  const divisor = new anchor.BN(1_000_000);
  const wholePart = amount.div(divisor);
  const fractionalPart = amount.mod(divisor);
  
  // Format with proper decimal places
  const fractionalStr = fractionalPart.toString().padStart(6, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return wholePart.toString();
  }
  
  return `${wholePart.toString()}.${trimmedFractional}`;
}

export function parseUsdtAmount(amountStr: string): anchor.BN {
  // Parse string like "123.456" to BN with 6 decimal places
  const parts = amountStr.split('.');
  const wholePart = parts[0] || '0';
  const fractionalPart = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  
  const wholeAmount = new anchor.BN(wholePart).mul(new anchor.BN(1_000_000));
  const fractionalAmount = new anchor.BN(fractionalPart);
  
  return wholeAmount.add(fractionalAmount);
}