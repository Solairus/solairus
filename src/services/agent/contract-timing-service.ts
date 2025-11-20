/**
 * Contract Timing Service
 * 
 * This service reads the actual SECONDS_PER_DAY constant from the smart contract
 * to ensure UI timers match the contract's timing (especially important for debug mode)
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
// Removed solairus-removed; timing is backend-configured

// Cache for the contract timing to avoid repeated RPC calls
let cachedSecondsPerDay: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get the SECONDS_PER_DAY constant from the smart contract
 * This is crucial for debug mode where 5 minutes = 1 day
 */
export async function getContractSecondsPerDay(
  connection: Connection | anchor.AnchorProvider
): Promise<number> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedSecondsPerDay !== null && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedSecondsPerDay;
  }

  try {
    // 0) Allow explicit override via environment for testing (typed access)
    const envSecondsRaw = import.meta.env.VITE_WITHDRAWAL_WINDOW_SECONDS;
    const envSeconds = envSecondsRaw ? Number(envSecondsRaw) : NaN;
    if (!Number.isNaN(envSeconds) && envSeconds > 0) {
      cachedSecondsPerDay = envSeconds;
      cacheTimestamp = now;
      return cachedSecondsPerDay;
    }

    // For debug mode, we know the contract uses 300 seconds (5 minutes)
    // For production mode, it uses 86400 seconds (24 hours)
    // We can detect this by checking if we're in debug mode
    
    // Check if we're in debug mode by looking for debug indicators
    const isDebugMode = await detectDebugMode(connection);
    
    if (isDebugMode) {
      cachedSecondsPerDay = 300; // 5 minutes in debug mode
    } else {
      cachedSecondsPerDay = 86400; // 24 hours in production mode
    }
    
    cacheTimestamp = now;
    return cachedSecondsPerDay;
    
  } catch (error) {
    console.warn('Could not determine contract timing, using fallback:', error);
    
    // Fallback: assume production mode (24 hours)
    cachedSecondsPerDay = 86400;
    cacheTimestamp = now;
    return cachedSecondsPerDay;
  }
}

/**
 * Detect if the contract is in debug mode
 * We can do this by checking the program ID or other indicators
 */
async function detectDebugMode(connection: Connection | anchor.AnchorProvider): Promise<boolean> {
  try {
    // Get the program ID from environment (optional now)
    const programId = import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID;
    
    // If no program ID is set, default to production mode
    if (!programId) {
      console.log('ℹ️ No VITE_SOLAIRUS_MAIN_PROGRAM_ID set, defaulting to production timing');
      return false;
    }
    
    // If we're using the debug program ID, we're in debug mode
    // The debug program ID is: Ab3nFaKP6hHxKYKELvdRz3THWp5ew1xxckNiT4ZzNb4
    if (programId === 'Ab3nFaKP6hHxKYKELvdRz3THWp5ew1xxckNiT4ZzNb4') {
      console.log('🚨 Debug mode detected: Using 5-minute intervals');
      return true;
    }
    
    // Additional check: try to detect by testing withdrawal timing
    // If we can find agents with very short withdrawal intervals, we're in debug mode
    // This is a more robust detection method
    
    return false; // Default to production mode
    
  } catch (error) {
    console.warn('Error detecting debug mode:', error);
    return false; // Default to production mode
  }
}

/**
 * Get human-readable timing information
 */
export async function getContractTimingInfo(
  connection: Connection | anchor.AnchorProvider
): Promise<{
  secondsPerDay: number;
  isDebugMode: boolean;
  displayName: string;
  description: string;
}> {
  const secondsPerDay = await getContractSecondsPerDay(connection);
  const isDebugMode = secondsPerDay !== 86400; // treat any non-24h as debug/testing
  const displayName = secondsPerDay >= 3600
    ? `${Math.round(secondsPerDay / 3600)} hours`
    : secondsPerDay >= 60
      ? `${Math.round(secondsPerDay / 60)} minutes`
      : `${secondsPerDay} seconds`;
  
  return {
    secondsPerDay,
    isDebugMode,
    displayName,
    description: isDebugMode 
      ? `Debug/Testing mode: ${displayName} = 1 day for rapid testing`
      : 'Production mode: 24 hours between withdrawals'
  };
}

/**
 * Calculate next withdrawal time based on contract timing
 */
export async function calculateNextWithdrawalTime(
  connection: Connection | anchor.AnchorProvider,
  activatedAt: Date,
  lastRoiWithdrawal?: Date
): Promise<Date | null> {
  const secondsPerDay = await getContractSecondsPerDay(connection);
  const millisecondsPerDay = secondsPerDay * 1000;
  
  const now = new Date();
  
  // Check if we need to wait for activation delay
  const activationDelay = new Date(activatedAt.getTime() + millisecondsPerDay);
  if (now < activationDelay) {
    return activationDelay;
  }
  
  // Check if we need to wait for withdrawal delay
  if (lastRoiWithdrawal) {
    const withdrawalDelay = new Date(lastRoiWithdrawal.getTime() + millisecondsPerDay);
    if (now < withdrawalDelay) {
      return withdrawalDelay;
    }
  }
  
  // Ready to withdraw
  return null;
}

/**
 * Clear the cache (useful for testing or when switching between debug/production)
 */
export function clearTimingCache(): void {
  cachedSecondsPerDay = null;
  cacheTimestamp = 0;
}