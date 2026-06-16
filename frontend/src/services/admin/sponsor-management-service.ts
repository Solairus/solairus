/**
 * Sponsor Management Service
 * 
 * Handles sponsor changes with proper referral list management via Backend API
 */

import { PublicKey } from '@solana/web3.js';
import axios from 'axios';

export interface SponsorChangeParams {
  userPubkey: PublicKey;
  newSponsorPubkey: PublicKey;
  authorityPubkey: PublicKey;
}

export interface SponsorChangeResult {
  txSignature: string;
  userPubkey: PublicKey;
  oldSponsor: PublicKey;
  newSponsor: PublicKey;
}

const BASE_URL = '/api';

/**
 * Update a user's sponsor
 */
export async function updateUserSponsor(params: SponsorChangeParams): Promise<SponsorChangeResult> {
  const { userPubkey, newSponsorPubkey, authorityPubkey } = params;

  // Validation
  if (userPubkey.equals(newSponsorPubkey)) {
    throw new Error('User cannot sponsor themselves');
  }

  try {
    const payload = {
      authority: authorityPubkey.toString(),
      newSponsor: newSponsorPubkey.toString()
    };

    const response = await axios.post(`${BASE_URL}/users/${userPubkey.toString()}/sponsor`, payload);

    return {
      txSignature: response.data.signature || 'backend-update-ok',
      userPubkey,
      oldSponsor: new PublicKey(response.data.oldSponsor || PublicKey.default), // Backend should return this ideally
      newSponsor: newSponsorPubkey
    };

  } catch (error: unknown) {
    console.error('Sponsor update failed:', error);
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Sponsor update failed. Please try again.');
  }
}

/**
 * Get user's current sponsor information
 */
export async function getUserSponsorInfo(
  // Program arg removed
  userPubkey: PublicKey
): Promise<{
  currentSponsor: PublicKey;
  isDefaultSponsor: boolean;
}> {
  try {
    const response = await axios.get(`${BASE_URL}/users/${userPubkey.toString()}/profile`);
    const profile = response.data;

    // Assuming profile has sponsor field
    const sponsorStr = profile.sponsor || PublicKey.default.toString();
    const currentSponsor = new PublicKey(sponsorStr);
    const isDefaultSponsor = currentSponsor.equals(PublicKey.default);

    return {
      currentSponsor,
      isDefaultSponsor,
    };
  } catch (error) {
    // If profile not found, maybe return default?
    console.warn('Failed to fetch user sponsor info, assuming default', error);
    return {
      currentSponsor: PublicKey.default,
      isDefaultSponsor: true
    };
  }
}

/**
 * Get sponsor's referral count
 */
export async function getSponsorReferralCount(
  sponsorPubkey: PublicKey
): Promise<number> {
  try {
    const response = await axios.get(`${BASE_URL}/users/${sponsorPubkey.toString()}/referrals/count`);
    return response.data.count || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Get sponsor's referral list
 */
export async function getSponsorReferrals(
  sponsorPubkey: PublicKey
): Promise<PublicKey[]> {
  try {
    const response = await axios.get(`${BASE_URL}/users/${sponsorPubkey.toString()}/referrals`);
    const referrals: string[] = response.data.referrals || [];
    return referrals.map(addr => new PublicKey(addr));
  } catch (error) {
    return [];
  }
}

/**
 * Validate sponsor change before executing
 */
export function validateSponsorChange(
  userPubkey: PublicKey,
  currentSponsor: PublicKey,
  newSponsor: PublicKey
): { isValid: boolean; error?: string } {
  // Check self-sponsorship
  if (userPubkey.equals(newSponsor)) {
    return { isValid: false, error: 'User cannot sponsor themselves' };
  }

  // Check same sponsor
  if (currentSponsor.equals(newSponsor)) {
    return { isValid: false, error: 'User already has this sponsor' };
  }

  return { isValid: true };
}