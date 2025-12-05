/**
 * Affiliate Earnings History Service
 * 
 * Fetches and processes affiliate earnings events from the backend via API
 */

import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { EarningsHistoryPayout } from '@/types/backend';

export interface EarningsHistoryItem extends EarningsHistoryPayout {
  // Aliases or extensions if needed
  totalEarnings?: number;
  totalWithdrawnAfter?: number;
}

export interface EarningsHistoryResult {
  items: EarningsHistoryItem[];
  totalCount: number;
  hasMore: boolean;
}

// Cache for earnings history
const earningsCache = new Map<string, { data: EarningsHistoryResult; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch affiliate earnings withdrawal history from backend
 */
export async function getEarningsHistory(
  connection: Connection, // Kept for compatibility, unused
  userPublicKey: PublicKey,
  limit: number = 10,
  before?: string // Transaction signature to paginate from
): Promise<EarningsHistoryResult> {
  try {
    console.log('🔍 Fetching earnings history via API for:', userPublicKey.toString());

    // Check cache first
    const cacheKey = `${userPublicKey.toString()}-${limit}-${before || 'latest'}`;
    const cached = earningsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📋 Returning cached earnings history');
      return cached.data;
    }

    // Call Backend API
    // GET /api/affiliate/history?limit=10&before=...
    const response = await axios.get<EarningsHistoryResult>(`/api/affiliate/history`, {
      params: {
        user: userPublicKey.toString(),
        limit,
        before
      }
    });

    const result = response.data || { items: [], totalCount: 0, hasMore: false };

    // Convert date strings to Date objects if needed
    result.items = result.items.map(item => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }));

    // Cache the result
    earningsCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`✅ Returning ${result.items.length} earnings entries`);
    return result;

  } catch (error) {
    console.error('❌ Error fetching earnings history:', error);

    // Return empty result instead of throwing to avoid breaking UI
    return { items: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Get a summary of earnings activity
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
export function formatUsdtAmount(amount: number): string {
  // Assuming backend returns standard units, but if micro-units (6 decimals):
  // If input is 1000000 -> 1.00
  // Adjust based on verified backend behavior. For now, matching previous logic:
  return (amount / 1_000_000).toFixed(2);
}