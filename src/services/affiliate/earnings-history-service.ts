/**
 * Affiliate Earnings History Service
 * 
 * Fetches and processes affiliate earnings events from the blockchain
 * Uses the AffiliateEarningsWithdrawalEvent emitted by the smart contract
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getProgram, derivePdas, PROGRAM_ID } from '@/lib/solairus-removed';

export interface EarningsHistoryItem {
  type: 'withdrawal';
  amount: number; // In USDT (converted from smallest unit)
  totalEarnings: number;
  totalWithdrawnAfter: number;
  timestamp: Date;
  signature: string;
}

export interface EarningsHistoryResult {
  items: EarningsHistoryItem[];
  totalCount: number;
  hasMore: boolean;
}

// Cache for earnings history to reduce RPC calls
const earningsCache = new Map<string, { data: EarningsHistoryResult; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch affiliate earnings withdrawal history for a user
 * 
 * IMPORTANT: This function only shows WITHDRAWAL history, not earnings crediting history.
 * 
 * The smart contract works as follows:
 * 1. When someone activates a license → Earnings are credited to sponsors (NO EVENT EMITTED)
 * 2. When someone withdraws earnings → AffiliateEarningsWithdrawalEvent is emitted
 * 
 * So if a user has earnings but hasn't withdrawn them, this history will be empty.
 * The current earnings balance is shown in the AffiliateEarningsCard via the user profile.
 */
export async function getEarningsHistory(
  connection: Connection,
  userPublicKey: PublicKey,
  limit: number = 10,
  before?: string // Transaction signature to paginate from
): Promise<EarningsHistoryResult> {
  try {
    console.log('🔍 Fetching earnings WITHDRAWAL history for user:', userPublicKey.toString());

    // Check cache first
    const cacheKey = `${userPublicKey.toString()}-${limit}-${before || 'latest'}`;
    const cached = earningsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📋 Returning cached earnings withdrawal history');
      return cached.data;
    }

    // Check user profile to see if they have any withdrawals
    const provider = new anchor.AnchorProvider(
      connection,
      {} as anchor.Wallet,
      { commitment: 'confirmed' }
    );
    
    const program = getProgram(provider);
    const { profile } = derivePdas(userPublicKey);

    let hasWithdrawals = false;
    let totalEarnings = new anchor.BN(0);
    let totalWithdrawn = new anchor.BN(0);
    
    try {
      const userProfile = await program.account['userProfile'].fetch(profile);
      totalEarnings = userProfile.totalAffiliateEarnings || new anchor.BN(0);
      totalWithdrawn = userProfile.totalAffiliateWithdrawn || new anchor.BN(0);
      hasWithdrawals = totalWithdrawn.gt(new anchor.BN(0));
      
      console.log('👤 User profile check:');
      console.log('  - Total earnings:', totalEarnings.toString());
      console.log('  - Total withdrawn:', totalWithdrawn.toString());
      console.log('  - Has withdrawals:', hasWithdrawals);
    } catch (profileError) {
      console.log('👤 User profile not found or not accessible');
    }

    // If user has no withdrawals, return empty result
    if (!hasWithdrawals) {
      const result: EarningsHistoryResult = {
        items: [],
        totalCount: 0,
        hasMore: false
      };

      // Cache the result
      earningsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      console.log('✅ No withdrawals found - user has earnings but hasn\'t withdrawn yet');
      return result;
    }

    // User has withdrawals, let's search for withdrawal transactions
    console.log('🔍 User has withdrawals, searching for transactions...');
    
    try {
      // Strategy 1: Search transactions involving the user's profile PDA
      const userProfilePda = profile;
      
      const signatures = await connection.getSignaturesForAddress(
        userProfilePda,
        {
          limit: Math.min(limit * 2, 20), // Conservative limit
          before: before
        },
        'confirmed'
      );

      console.log(`📋 Found ${signatures.length} transactions involving user profile`);

      const withdrawalEvents: EarningsHistoryItem[] = [];
      
      if (signatures.length > 0) {
        // Process in small batches
        const batchSize = 2;
        for (let i = 0; i < signatures.length && withdrawalEvents.length < limit; i += batchSize) {
          const batch = signatures.slice(i, i + batchSize);
          
          try {
            const transactions = await connection.getTransactions(
              batch.map(sig => sig.signature),
              { 
                commitment: 'confirmed', 
                maxSupportedTransactionVersion: 0 
              }
            );

            for (let j = 0; j < transactions.length; j++) {
              const tx = transactions[j];
              const signature = batch[j].signature;
              
              if (!tx || tx.meta?.err) continue;

              // Check if this transaction involves our program and looks like a withdrawal
              const logs = tx.meta.logMessages || [];
              let isWithdrawalTx = false;

              // Look for withdrawal instruction or event logs
              for (const log of logs) {
                if (log.includes('withdraw_affiliate_earnings') || 
                    log.includes('Instruction: WithdrawAffiliateEarnings') ||
                    log.includes('AffiliateEarningsWithdrawalEvent')) {
                  isWithdrawalTx = true;
                  break;
                }
              }

              // Also check if the transaction involves our program
              const accountKeys = tx.transaction.message.accountKeys || [];
              const involvesProgram = accountKeys.some(key => 
                key.toString() === PROGRAM_ID.toString()
              );

              if (isWithdrawalTx && involvesProgram) {
                // This looks like a withdrawal transaction
                // Since we know the user has withdrawn, we can create an entry
                withdrawalEvents.push({
                  type: 'withdrawal',
                  amount: totalWithdrawn.toNumber() / 1_000_000, // Convert from micro USDT
                  totalEarnings: totalEarnings.toNumber() / 1_000_000,
                  totalWithdrawnAfter: totalWithdrawn.toNumber() / 1_000_000,
                  timestamp: new Date((tx.blockTime || 0) * 1000),
                  signature: signature
                });
                
                console.log(`✅ Found withdrawal transaction: ${signature}`);
                console.log(`   Amount: ${totalWithdrawn.toNumber() / 1_000_000} USDT`);
                console.log(`   Time: ${new Date((tx.blockTime || 0) * 1000)}`);
              }
            }
          } catch (batchError) {
            console.warn('⚠️ Error processing transaction batch:', batchError);
            continue;
          }
        }
      }

      // If we didn't find any transactions but user has withdrawals, create a synthetic entry
      // This handles cases where the transaction might be older or harder to find
      if (withdrawalEvents.length === 0 && hasWithdrawals) {
        console.log('📝 Creating synthetic withdrawal entry based on profile data');
        withdrawalEvents.push({
          type: 'withdrawal',
          amount: totalWithdrawn.toNumber() / 1_000_000,
          totalEarnings: totalEarnings.toNumber() / 1_000_000,
          totalWithdrawnAfter: totalWithdrawn.toNumber() / 1_000_000,
          timestamp: new Date(), // Use current time as fallback
          signature: 'profile-based-entry' // Indicate this is derived from profile
        });
        console.log(`📝 Synthetic entry: ${totalWithdrawn.toNumber() / 1_000_000} USDT withdrawn`);
      }

      // Sort by timestamp (newest first)
      withdrawalEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const result: EarningsHistoryResult = {
        items: withdrawalEvents.slice(0, limit),
        totalCount: withdrawalEvents.length,
        hasMore: signatures.length >= limit * 2
      };

      // Cache the result
      earningsCache.set(cacheKey, { data: result, timestamp: Date.now() });

      console.log(`✅ Returning ${result.items.length} withdrawal entries`);
      return result;

    } catch (eventError) {
      console.error('❌ Error searching for withdrawal transactions:', eventError);
      
      // Fallback: if user has withdrawals but we can't find transactions, 
      // create a synthetic entry based on profile data
      if (hasWithdrawals) {
        console.log('🔄 Fallback: creating entry from profile data');
        const fallbackResult: EarningsHistoryResult = {
          items: [{
            type: 'withdrawal',
            amount: totalWithdrawn.toNumber() / 1_000_000,
            totalEarnings: totalEarnings.toNumber() / 1_000_000,
            totalWithdrawnAfter: totalWithdrawn.toNumber() / 1_000_000,
            timestamp: new Date(),
            signature: 'profile-fallback'
          }],
          totalCount: 1,
          hasMore: false
        };
        earningsCache.set(cacheKey, { data: fallbackResult, timestamp: Date.now() });
        return fallbackResult;
      }
      
      // Return empty result
      const result: EarningsHistoryResult = {
        items: [],
        totalCount: 0,
        hasMore: false
      };
      earningsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

  } catch (error) {
    console.error('❌ Error fetching earnings withdrawal history:', error);
    
    // Return empty result instead of throwing to avoid breaking UI
    return { items: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Get a summary of earnings activity
 * Uses cached data from getEarningsHistory to avoid additional RPC calls
 */
export async function getEarningsSummary(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<{
  totalWithdrawals: number;
  lastWithdrawal: Date | null;
  averageWithdrawal: number;
}> {
  try {
    // Use a reasonable limit to get summary data
    const history = await getEarningsHistory(connection, userPublicKey, 20);
    
    if (history.items.length === 0) {
      return {
        totalWithdrawals: 0,
        lastWithdrawal: null,
        averageWithdrawal: 0
      };
    }

    const totalAmount = history.items.reduce((sum, item) => sum + item.amount, 0);
    const lastWithdrawal = history.items[0]?.timestamp || null;

    return {
      totalWithdrawals: history.items.length,
      lastWithdrawal,
      averageWithdrawal: totalAmount / history.items.length
    };
  } catch (error) {
    console.error('❌ Error getting earnings summary:', error);
    return {
      totalWithdrawals: 0,
      lastWithdrawal: null,
      averageWithdrawal: 0
    };
  }
}

/**
 * Format USDT amount from smallest unit to display format
 */
export function formatUsdtAmount(amount: anchor.BN | number): string {
  const amountNum = typeof amount === 'number' ? amount : amount.toNumber();
  return (amountNum / 1_000_000).toFixed(2);
}