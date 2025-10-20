import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import {
  getProgram,
  derivePdas,
  deriveAgentActivationPda,
  AgentTier,
  getErrorMessage,
  PROGRAM_ID
} from '@/lib/solairus-main';
import { buildSponsorHierarchy } from '@/lib/sponsor-tree';
import { AgentErrorHandler } from '@/utils/agent-error-handler';

// Temporary type for account access until IDL is updated
type ProgramAccountAccess = {
  config: { fetch: (pda: PublicKey) => Promise<unknown> };
  userProfile: { fetch: (pda: PublicKey) => Promise<unknown> };
  userAgentCounter: { fetch: (pda: PublicKey) => Promise<unknown> };
};

// Temporary config type for agent activation
type ConfigAccount = {
  usdtMint: PublicKey;
  dev: PublicKey;
};

export interface AgentActivationParams {
  userPublicKey: PublicKey;
  amount: number; // Amount in USDT (with decimals)
  tier: AgentTier;
  paymentMethod: 'usdt' | 'credit';
}

export interface AgentActivationResult {
  success: boolean;
  txSignature?: string;
  activationId?: number;
  error?: string;
  userFriendlyMessage?: string;
}

/**
 * Activate an AI trading agent with tier selection
 */
export async function activateAgent(
  provider: anchor.AnchorProvider,
  params: AgentActivationParams
): Promise<AgentActivationResult> {
  try {
    console.log('🚀 Starting agent activation with AnchorProvider:', {
      user: params.userPublicKey.toBase58(),
      amount: params.amount,
      tier: AgentTier[params.tier],
      paymentMethod: params.paymentMethod
    });

    const program = getProgram(provider);
    const { config, vault, profile: profilePda, counter: counterPda } = derivePdas(params.userPublicKey);

    // Get USDT mint from config for USDT transactions
    const configAccount = await (program.account as ProgramAccountAccess).config.fetch(config) as ConfigAccount;
    const usdtMint = configAccount.usdtMint;

    // Derive USDT token accounts (required even for credit activation due to shared account structure)
    const userUsdt = anchor.utils.token.associatedAddress({
      mint: usdtMint,
      owner: params.userPublicKey,
    });

    const vaultUsdt = anchor.utils.token.associatedAddress({
      mint: usdtMint,
      owner: vault,
    });

    // For credit activation, ensure USDT token accounts exist (even if unused)
    // This is required because both USDT and credit activation use the same account structure
    if (params.paymentMethod === 'credit') {
      console.log('🔧 Credit activation: Ensuring USDT token accounts exist...');

      try {
        // Check if user's USDT token account exists
        const connection = provider.connection;
        const userUsdtInfo = await connection.getAccountInfo(userUsdt);

        if (!userUsdtInfo) {
          console.log('⚠️ User USDT token account does not exist, will be created automatically');
          console.log('💡 Credit activation will include USDT token account creation instruction');
          // Don't throw error - let the contract handle account creation
        } else {
          console.log('✅ User USDT token account already exists');
        }
      } catch (error) {
        console.log('⚠️ Could not verify USDT token account, proceeding with activation:', error);
        // Don't throw error - let the contract handle any issues
      }
    }

    // Get user's profile to verify registration
    let profileAccount;
    try {
      profileAccount = await (program.account as ProgramAccountAccess).userProfile.fetch(profilePda);
    } catch (error) {
      throw new Error('User profile not found. Please register first.');
    }

    // Get the user's agent counter to determine next activation ID
    let counterAccount;
    try {
      counterAccount = await (program.account as ProgramAccountAccess).userAgentCounter.fetch(counterPda);
    } catch (error) {
      // Counter doesn't exist yet, this will be the first activation (ID = 0)
      counterAccount = { nextId: new anchor.BN(0) };
    }

    const nextActivationId = counterAccount.nextId ? counterAccount.nextId.toNumber() : 0;
    console.log('📊 Next activation ID:', nextActivationId);

    // Derive the agent activation PDA
    const activationPda = deriveAgentActivationPda(
      params.userPublicKey,
      new anchor.BN(nextActivationId)
    );

    // Convert amount to proper units (USDT has 6 decimals)
    const amountBN = new anchor.BN(params.amount * 1_000_000);

    let txSignature: string;

    if (params.paymentMethod === 'usdt') {
      // Build sponsor hierarchy for affiliate earnings (same as license activation)
      console.log('🌳 Building sponsor hierarchy for affiliate earnings...');
      console.log('🔧 Provider:', provider.publicKey?.toString());
      console.log('🔧 User:', params.userPublicKey.toString());

      const sponsorHierarchy = await buildSponsorHierarchy(provider, params.userPublicKey);
      console.log('✅ Sponsor hierarchy built:', sponsorHierarchy);

      // Construct remaining accounts exactly like license activation
      const sponsorAddresses = [
        sponsorHierarchy.sponsorL1,  // User address (not PDA)
        sponsorHierarchy.sponsorL2,  // User address (not PDA)
        sponsorHierarchy.sponsorL3,  // User address (not PDA)
      ];
      console.log('✅ Sponsor user addresses:', sponsorAddresses.map(addr => addr.toString()));

      // Also need to pass the corresponding PDAs for the contract to write to
      const sponsorPDAs = [
        derivePdas(sponsorHierarchy.sponsorL1).profile!,
        derivePdas(sponsorHierarchy.sponsorL2).profile!,
        derivePdas(sponsorHierarchy.sponsorL3).profile!,
      ];
      console.log('✅ Sponsor PDAs for writing:', sponsorPDAs.map(pda => pda.toString()));

      // Check for duplicates in user addresses (contract expects this)
      const uniqueAddresses = new Set(sponsorAddresses.map(addr => addr.toString()));
      console.log(`🔍 Unique sponsor addresses: ${uniqueAddresses.size}, Total levels: ${sponsorAddresses.length}`);

      if (uniqueAddresses.size < sponsorAddresses.length) {
        console.log('🎯 DUPLICATE SPONSORS DETECTED: Contract will accumulate earnings per unique user');
        console.log('💡 Same sponsor at multiple levels will receive combined earnings');
      } else {
        console.log('✅ All sponsors are unique, each will receive their level-specific earnings');
      }

      // Pass both user addresses AND their PDAs to contract
      // Contract expects: [userAddr1, userAddr2, userAddr3, pda1, pda2, pda3]
      const finalRemainingAccounts: Array<{
        pubkey: PublicKey;
        isSigner: boolean;
        isWritable: boolean;
      }> = [
          // First pass user addresses (for deduplication logic)
          ...sponsorAddresses.map(pubkey => ({
            pubkey,
            isSigner: false,
            isWritable: false, // User addresses are read-only
          })),
          // Then pass corresponding PDAs (for writing earnings)
          ...sponsorPDAs.map(pubkey => ({
            pubkey,
            isSigner: false,
            isWritable: true, // PDAs need to be writable
          }))
        ];

      // SECURITY: Validate exactly 6 remaining accounts before sending to contract
      if (finalRemainingAccounts.length !== 6) {
        throw new Error(`Invalid remaining accounts count: expected 6, got ${finalRemainingAccounts.length}`);
      }

      // Get the actual dev profile from config (not from sponsor hierarchy)
      console.log('🔧 Using actual dev profile from config...');
      const { profile: actualDevProfile } = derivePdas(configAccount.dev);
      console.log('✅ Actual dev profile PDA:', actualDevProfile?.toString());

      // Use USDT payment method
      const accounts = {
        user: params.userPublicKey,
        config,
        profile: profilePda,
        counter: counterPda,
        activation: activationPda,
        vault,
        vaultUsdt,
        usdtMint,
        userUsdt,
        devProfile: actualDevProfile!, // Use actual dev profile from config.dev
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      };

      console.log('💰 Activating agent with USDT payment...');
      console.log('🚀 Submitting transaction with remaining_accounts:', finalRemainingAccounts.length, 'sponsor profiles');
      console.log('📋 Remaining accounts:', finalRemainingAccounts.map(acc => `${acc.pubkey.toString()} (writable: ${acc.isWritable})`));
      console.log('📋 Main accounts:', Object.keys(accounts).map(key => `${key}: ${accounts[key as keyof typeof accounts]?.toString()}`));

      try {
        txSignature = await program.methods
          .activateAgentUsdt(amountBN, params.tier)
          .accounts(accounts)
          .remainingAccounts(finalRemainingAccounts) // ← FIXED: Add remaining accounts like license activation
          .rpc();
        console.log('✅ USDT activation transaction successful:', txSignature);
      } catch (error) {
        console.error('❌ USDT activation transaction failed:', error);
        console.error('❌ Remaining accounts passed:', finalRemainingAccounts.length);
        console.error('❌ Remaining accounts details:', finalRemainingAccounts);
        throw error;
      }

    } else {
      // Credit payment method - NO remaining accounts needed (no affiliate earnings for credits)
      console.log('🎫 Credit payment method - no affiliate earnings distribution');

      // Get the actual dev profile from config
      console.log('🔧 Using actual dev profile from config...');
      const { profile: actualDevProfile } = derivePdas(configAccount.dev);
      console.log('✅ Actual dev profile PDA:', actualDevProfile?.toString());

      // Use credit payment method - NO remaining accounts
      const accounts = {
        user: params.userPublicKey,
        config,
        profile: profilePda,
        counter: counterPda,
        activation: activationPda,
        vault,
        vaultUsdt,
        usdtMint,
        userUsdt,
        devProfile: actualDevProfile!, // Use actual dev profile from config.dev
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      };

      console.log('🎫 Activating agent with credit payment...');
      console.log('📋 Main accounts:', Object.keys(accounts).map(key => `${key}: ${accounts[key as keyof typeof accounts]?.toString()}`));

      try {
        // For credit activation, we don't actually need the user's USDT account to exist
        // since no USDT transfer occurs. The contract just needs the account addresses
        // for the instruction structure, but they won't be used.
        console.log('💡 Credit activation: USDT accounts are for instruction structure only');

        txSignature = await program.methods
          .activateAgentCredit(amountBN, params.tier)
          .accounts(accounts)
          .rpc();

        console.log('✅ Credit activation transaction successful:', txSignature);
      } catch (error) {
        console.error('❌ Credit activation transaction failed:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));

        // Check if it's specifically a USDT account error
        if (error instanceof Error && error.message.includes('AccountNotInitialized')) {
          console.log('🔧 USDT account error detected, creating account and retrying...');

          try {
            // Create the USDT token account as a pre-instruction
            const createAccountIx = createAssociatedTokenAccountInstruction(
              params.userPublicKey, // payer
              userUsdt, // associated token account
              params.userPublicKey, // owner
              usdtMint // mint
            );

            // Retry with account creation
            txSignature = await program.methods
              .activateAgentCredit(amountBN, params.tier)
              .accounts(accounts)
              .preInstructions([createAccountIx])
              .rpc();

            console.log('✅ Credit activation with USDT account creation successful:', txSignature);
          } catch (retryError) {
            console.error('❌ Retry with account creation failed:', retryError);
            throw new Error(
              'Failed to create required token account. Please ensure you have sufficient SOL for transaction fees.'
            );
          }
        } else if (error instanceof Error && error.message.includes('insufficient funds')) {
          throw new Error(
            'Insufficient SOL for transaction fees. Please add some SOL to your wallet.'
          );
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Agent activation successful!');
    console.log('📝 Transaction signature:', txSignature);

    return {
      success: true,
      txSignature,
      activationId: nextActivationId,
      userFriendlyMessage: `Successfully activated agent with ${params.amount} USDT!`
    };

  } catch (error: unknown) {
    console.error('❌ Agent activation failed:', error);

    // Use the agent error handler to parse and format the error
    const agentError = AgentErrorHandler.parseError(error as Error, 'Agent activation');

    return {
      success: false,
      error: agentError.message,
      userFriendlyMessage: agentError.message
    };
  }
}

/**
 * Get the minimum activation amount for a tier
 */
export function getMinimumActivationAmount(tier: AgentTier): number {
  // These are example minimum amounts - adjust based on business requirements
  switch (tier) {
    case AgentTier.NOVA:
      return 10; // $10 minimum
    case AgentTier.VEGA:
      return 25; // $25 minimum
    case AgentTier.ORION:
      return 50; // $50 minimum
    case AgentTier.PRIME:
      return 100; // $100 minimum
    default:
      return 10;
  }
}

/**
 * Validate activation parameters
 */
export function validateActivationParams(params: AgentActivationParams): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate amount
  if (params.amount <= 0) {
    errors.push('Activation amount must be greater than 0');
  }

  const minAmount = getMinimumActivationAmount(params.tier);
  if (params.amount < minAmount) {
    errors.push(`Minimum activation amount for ${AgentTier[params.tier]} tier is $${minAmount}`);
  }

  // Validate tier
  if (params.tier < 0 || params.tier > 3) {
    errors.push('Invalid agent tier selected');
  }

  // Validate payment method
  if (!['usdt', 'credit'].includes(params.paymentMethod)) {
    errors.push('Invalid payment method selected');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}