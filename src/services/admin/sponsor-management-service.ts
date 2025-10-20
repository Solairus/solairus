/**
 * Sponsor Management Service
 * 
 * Handles sponsor changes with proper referral list management
 */

import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram, derivePdas } from '@/lib/solairus-main';

export interface SponsorChangeParams {
  userPubkey: PublicKey;
  newSponsorPubkey: PublicKey;
  authorityPubkey: PublicKey;
  program: anchor.Program;
}

export interface SponsorChangeResult {
  txSignature: string;
  userPubkey: PublicKey;
  oldSponsor: PublicKey;
  newSponsor: PublicKey;
}

/**
 * Update a user's sponsor with proper referral list management
 */
export async function updateUserSponsor(params: SponsorChangeParams): Promise<SponsorChangeResult> {
  const { userPubkey, newSponsorPubkey, authorityPubkey, program } = params;

  // Validation
  if (userPubkey.equals(newSponsorPubkey)) {
    throw new Error('User cannot sponsor themselves');
  }

  // Get current user profile to check existing sponsor
  const { profile: userProfile } = derivePdas(userPubkey);
  
  let currentProfile;
  try {
    currentProfile = await program.account['userProfile'].fetch(userProfile);
  } catch (error) {
    throw new Error('User profile not found');
  }

  if (currentProfile.sponsor.equals(newSponsorPubkey)) {
    throw new Error('User already has this sponsor');
  }

  // Derive PDAs
  const { config } = derivePdas();
  
  // Old sponsor referrals PDA
  const oldSponsorReferrals = PublicKey.findProgramAddressSync(
    [Buffer.from("referrals"), currentProfile.sponsor.toBuffer()],
    program.programId
  )[0];
  
  // New sponsor referrals PDA
  const newSponsorReferrals = PublicKey.findProgramAddressSync(
    [Buffer.from("referrals"), newSponsorPubkey.toBuffer()],
    program.programId
  )[0];

  try {
    // Execute transaction
    const txSignature = await program.methods
      .updateUserProfile(newSponsorPubkey)
      .accounts({
        config,
        profile: userProfile,
        user: userPubkey,
        authority: authorityPubkey,
        oldSponsorReferrals,
        newSponsorReferrals,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    return {
      txSignature,
      userPubkey,
      oldSponsor: currentProfile.sponsor,
      newSponsor: newSponsorPubkey,
    };
  } catch (error) {
    console.error('Sponsor update transaction failed:', error);
    
    // Parse contract errors
    if (error instanceof Error) {
      const message = error.message;
      
      if (message.includes('SelfSponsorNotAllowed')) {
        throw new Error('Cannot set self as sponsor');
      }
      
      if (message.includes('SameSponsorNotAllowed')) {
        throw new Error('Cannot update to same sponsor');
      }
      
      if (message.includes('Unauthorized')) {
        throw new Error('You are not authorized to change sponsors');
      }
      
      if (message.includes('TooManyReferrals')) {
        throw new Error('New sponsor has reached maximum referral limit');
      }
    }
    
    throw new Error('Sponsor update failed. Please try again.');
  }
}

/**
 * Get user's current sponsor information
 */
export async function getUserSponsorInfo(
  program: anchor.Program,
  userPubkey: PublicKey
): Promise<{
  currentSponsor: PublicKey;
  isDefaultSponsor: boolean;
}> {
  try {
    const { profile } = derivePdas(userPubkey);
    const userProfile = await program.account['userProfile'].fetch(profile);
    
    const currentSponsor = userProfile.sponsor;
    const isDefaultSponsor = currentSponsor.equals(PublicKey.default);
    
    return {
      currentSponsor,
      isDefaultSponsor,
    };
  } catch (error) {
    throw new Error('Failed to fetch user sponsor information');
  }
}

/**
 * Get sponsor's referral count
 */
export async function getSponsorReferralCount(
  program: anchor.Program,
  sponsorPubkey: PublicKey
): Promise<number> {
  try {
    const { referrals } = derivePdas(sponsorPubkey);
    
    if (!referrals) {
      return 0;
    }
    
    const referralData = await program.account['myReferrals'].fetch(referrals);
    return referralData.totalCount || 0;
  } catch (error) {
    // Referral account doesn't exist yet (no referrals)
    return 0;
  }
}

/**
 * Get sponsor's referral list
 */
export async function getSponsorReferrals(
  program: anchor.Program,
  sponsorPubkey: PublicKey
): Promise<PublicKey[]> {
  try {
    const { referrals } = derivePdas(sponsorPubkey);
    
    if (!referrals) {
      return [];
    }
    
    const referralData = await program.account['myReferrals'].fetch(referrals);
    return referralData.referrals || [];
  } catch (error) {
    // Referral account doesn't exist yet (no referrals)
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