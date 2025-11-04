import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram, derivePdas, Config } from '@/lib/solairus-removed';
import { BucketType } from '@/hooks/useBucketBalances';

// Bucket enum mapping to match the contract
export function getBucketEnumValue(bucketType: BucketType): object {
  switch (bucketType) {
    case 'admin':
      return { admin: {} };
    case 'dev':
      return { dev: {} };
    case 'marketer1':
      return { marketer1: {} };
    case 'marketer2':
      return { marketer2: {} };
    case 'trader':
      return { trader: {} };
    case 'systemreserve':
      return { systemReserve: {} };
    default:
      throw new Error(`Invalid bucket type: ${bucketType}`);
  }
}

export interface WithdrawBucketParams {
  provider: anchor.AnchorProvider;
  bucketType: BucketType;
  amount: anchor.BN;
  authority: PublicKey;
}

export async function withdrawFromBucket({
  provider,
  bucketType,
  amount,
  authority,
}: WithdrawBucketParams): Promise<string> {
  const program = getProgram(provider);
  const { config, vault } = derivePdas();
  
  // Get config data to get USDT mint
  const configData = await program.account["config"].fetch(config) as Config;
  const usdtMint = configData.usdtMint;
  
  // Derive token accounts
  const authorityUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: authority,
  });

  const vaultUsdt = anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: vault,
  });

  // Convert bucket type to contract enum
  const targetBucket = getBucketEnumValue(bucketType);

  try {
    const txSignature = await program.methods
      .withdrawSystemBucket(targetBucket, amount)
      .accounts({
        config,
        vault,
        caller: authority,
        usdtMint,
        recipientUsdt: authorityUsdt,
        vaultUsdt,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    return txSignature;
  } catch (error) {
    console.error('Error withdrawing from bucket:', error);
    throw error;
  }
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