import { PublicKey } from '@solana/web3.js';
import { getSponsorAddress } from './address-crypto';
import { derivePdas, getProgram } from './solairus-main';
import * as anchor from '@coral-xyz/anchor';

// Get program ID from environment variable
const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID
);

/**
 * Computed sponsor hierarchy for license activation
 *
 * IMPORTANT: This is NOT stored data - it's computed off-chain from on-chain sponsor relationships.
 * The smart contract only stores the direct sponsor (L1) in each user profile.
 * L2 and L3 are derived by traversing the sponsor chain: L2 = L1's sponsor, L3 = L2's sponsor.
 */
export interface SponsorHierarchy {
  sponsorL1: PublicKey;  // Direct sponsor (stored in user profile)
  sponsorL2: PublicKey;  // Computed: L1's sponsor (looked up on-chain)
  sponsorL3: PublicKey;  // Computed: L2's sponsor (looked up on-chain)
}

/**
 * Get the default sponsor address (dev key)
 */
function getDefaultSponsor(): PublicKey {
  const defaultAddress = import.meta.env.VITE_DEFAULT_SPONSOR_ADDRESS;
  return new PublicKey(defaultAddress);
}

/**
 * Fetch a user's sponsor information from their profile
 */
async function getUserSponsors(
  program: anchor.Program, 
  userAddress: PublicKey
): Promise<{ sponsorL1: PublicKey; sponsorL2: PublicKey; sponsorL3: PublicKey } | null> {
  try {
    const { profile } = derivePdas(userAddress);
    const userProfile = await program.account["userProfile"].fetch(profile);
    
    return {
      sponsorL1: userProfile.sponsorL1 as PublicKey,
      sponsorL2: userProfile.sponsorL2 as PublicKey,
      sponsorL3: userProfile.sponsorL3 as PublicKey,
    };
  } catch (error) {
    console.log(`User ${userAddress.toString()} not found or not registered`);
    return null;
  }
}

/**
 * Build sponsor hierarchy for registration (L1 only)
 * 
 * @param provider - Anchor provider for blockchain connection
 * @returns L1 sponsor from referral or default
 */
export async function getSponsorL1(provider: anchor.AnchorProvider): Promise<PublicKey> {
  const defaultSponsor = getDefaultSponsor();
  
  console.log('🔍 Getting L1 sponsor for registration...');
  console.log('🔧 Default sponsor (dev key):', defaultSponsor.toString());
  
  // Get stored sponsor from referral link
  const storedSponsorAddress = getSponsorAddress();
  console.log('📱 Stored sponsor from referral:', storedSponsorAddress || 'none');
  
  if (storedSponsorAddress && storedSponsorAddress !== '') {
    try {
      const sponsorL1 = new PublicKey(storedSponsorAddress);
      console.log('✅ Using referral sponsor as L1:', sponsorL1.toString());
      return sponsorL1;
    } catch (error) {
      console.warn('❌ Invalid stored sponsor address, using default');
      return defaultSponsor;
    }
  } else {
    console.log('📝 No referral sponsor, using default as L1');
    return defaultSponsor;
  }
}

/**
 * Build complete sponsor hierarchy for license activation
 * 
 * IMPORTANT: This constructs L2/L3 from on-chain data, never modifies L1
 * 
 * Logic:
 * 1. sponsor_l1 = EXISTING L1 from user profile (NEVER CHANGED)
 * 2. sponsor_l2 = sponsor_l1's sponsor_l1 or default  
 * 3. sponsor_l3 = sponsor_l2's sponsor_l1 or default
 * 
 * @param provider - Anchor provider for blockchain connection
 * @param userAddress - User whose hierarchy to build
 * @returns Complete sponsor hierarchy for activation
 */
export async function buildSponsorHierarchy(
  provider: anchor.AnchorProvider, 
  userAddress: PublicKey
): Promise<SponsorHierarchy> {
  const program = getProgram(provider);
  const defaultSponsor = getDefaultSponsor();
  
  console.log('🌳 Building sponsor hierarchy for activation...');
  console.log('👤 User:', userAddress.toString());
  console.log('🔧 Default sponsor (dev key):', defaultSponsor.toString());
  
  // Step 1: Get user's EXISTING L1 sponsor (never change this)
  const userSponsors = await getUserSponsors(program, userAddress);
  if (!userSponsors) {
    throw new Error('User profile not found - user must be registered first');
  }
  
  const sponsorL1 = userSponsors.sponsorL1;
  console.log('✅ User\'s existing L1 sponsor:', sponsorL1.toString());
  
  // Step 2: Build L2 from L1's sponsor
  console.log('🔍 Looking up L1 sponsor\'s hierarchy...');
  const l1Sponsors = await getUserSponsors(program, sponsorL1);
  
  let sponsorL2: PublicKey;
  let sponsorL3: PublicKey;
  
  if (l1Sponsors) {
    sponsorL2 = l1Sponsors.sponsorL1; // L1's sponsor becomes our L2
    console.log('✅ Found L2 sponsor:', sponsorL2.toString());
    
    // Step 3: Build L3 from L2's sponsor  
    console.log('🔍 Looking up L2 sponsor\'s hierarchy...');
    const l2Sponsors = await getUserSponsors(program, sponsorL2);
    
    if (l2Sponsors) {
      sponsorL3 = l2Sponsors.sponsorL1; // L2's sponsor becomes our L3
      console.log('✅ Found L3 sponsor:', sponsorL3.toString());
    } else {
      sponsorL3 = defaultSponsor;
      console.log('📝 L2 sponsor not found, using default as L3');
    }
  } else {
    // L1 sponsor not found, use defaults for L2 and L3
    sponsorL2 = defaultSponsor;
    sponsorL3 = defaultSponsor;
    console.log('📝 L1 sponsor not found, using defaults for L2 and L3');
  }
  
  const hierarchy = {
    sponsorL1, // EXISTING L1 - never changed
    sponsorL2, // Constructed from L1's sponsor
    sponsorL3  // Constructed from L2's sponsor
  };
  
  console.log('🌳 Final sponsor hierarchy for activation:');
  console.log('  L1 (existing):', hierarchy.sponsorL1.toString());
  console.log('  L2 (L1\'s sponsor):', hierarchy.sponsorL2.toString());
  console.log('  L3 (L2\'s sponsor):', hierarchy.sponsorL3.toString());
  
  return hierarchy;
}

/**
 * Check if all sponsors in hierarchy are the same (dev key default)
 */
export function isDefaultHierarchy(hierarchy: SponsorHierarchy): boolean {
  const defaultSponsor = getDefaultSponsor();
  return (
    hierarchy.sponsorL1.equals(defaultSponsor) &&
    hierarchy.sponsorL2.equals(defaultSponsor) &&
    hierarchy.sponsorL3.equals(defaultSponsor)
  );
}

/**
 * Get a user's complete referral tree (for display purposes)
 */
export async function getUserReferralTree(
  provider: anchor.AnchorProvider,
  userAddress: PublicKey
): Promise<{
  user: PublicKey;
  sponsorL1: PublicKey;
  sponsorL2: PublicKey; 
  sponsorL3: PublicKey;
  isRegistered: boolean;
}> {
  const program = getProgram(provider);
  const defaultSponsor = getDefaultSponsor();
  
  const sponsors = await getUserSponsors(program, userAddress);
  
  if (sponsors) {
    return {
      user: userAddress,
      sponsorL1: sponsors.sponsorL1,
      sponsorL2: sponsors.sponsorL2,
      sponsorL3: sponsors.sponsorL3,
      isRegistered: true
    };
  } else {
    return {
      user: userAddress,
      sponsorL1: defaultSponsor,
      sponsorL2: defaultSponsor,
      sponsorL3: defaultSponsor,
      isRegistered: false
    };
  }
}