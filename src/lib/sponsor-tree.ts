import { PublicKey } from '@solana/web3.js';
import { getSponsorAddress } from './address-crypto';
import { derivePdas, getProgram } from './solairus-removed';
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
async function getUserSponsor(
  program: anchor.Program, 
  userAddress: PublicKey
): Promise<PublicKey | null> {
  try {
    // Try new PDA format first
    const { profile } = derivePdas(userAddress);
    const userProfile = await program.account["userProfile"].fetch(profile);
    
    return userProfile.sponsor as PublicKey;
  } catch (newFormatError) {
    // Try legacy PDA format
    try {
      const legacyProfile = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        userAddress.toBuffer(),
      ], program.programId)[0];
      
      const userProfile = await program.account["userProfile"].fetch(legacyProfile);
      
      return userProfile.sponsor as PublicKey;
    } catch (legacyFormatError) {
      console.log(`User ${userAddress.toString()} not found or not registered`);
      return null;
    }
  }
}

/**
 * Build sponsor hierarchy for registration (L1 only)
 * 
 * @param provider - Anchor provider for blockchain connection
 * @returns L1 sponsor from referral or default
 */
export async function getSponsorL1(provider: anchor.AnchorProvider, userAddress: PublicKey): Promise<PublicKey> {
  const defaultSponsor = getDefaultSponsor();
  const program = getProgram(provider);
  
  console.log('🔍 Getting L1 sponsor for user:', userAddress.toString());
  console.log('🔧 Default sponsor (dev key):', defaultSponsor.toString());
  
  // STEP 1: Check if user is already registered (try both new and legacy PDA formats)
  try {
    // Try new PDA format first
    const { profile } = derivePdas(userAddress);
    const userProfile = await program.account["userProfile"].fetch(profile);
    
    // User is registered with new format, use their on-chain sponsor
    console.log('✅ User already registered, using on-chain sponsor:', userProfile.sponsor.toString());
    return userProfile.sponsor as PublicKey;
  } catch (newFormatError) {
    // Try legacy PDA format
    try {
      const legacyProfile = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        userAddress.toBuffer(),
      ], program.programId)[0];
      
      const userProfile = await program.account["userProfile"].fetch(legacyProfile);
      
      // User is registered with legacy format, use their on-chain sponsor
      console.log('✅ User already registered (legacy format), using on-chain sponsor:', userProfile.sponsor.toString());
      return userProfile.sponsor as PublicKey;
    } catch (legacyFormatError) {
      // User not registered in either format, continue with localStorage check
      console.log('📝 User not registered, checking localStorage for referral sponsor');
    }
  }
  
  // STEP 2: User not registered, check localStorage for referral sponsor
  const storedSponsorAddress = getSponsorAddress();
  console.log('📱 Stored sponsor from referral:', storedSponsorAddress || 'none');
  
  if (storedSponsorAddress && storedSponsorAddress !== '') {
    try {
      const storedSponsor = new PublicKey(storedSponsorAddress);
      
      // STEP 3: Check if stored sponsor is registered (try both new and legacy PDA formats)
      try {
        // Try new PDA format first
        const { profile: sponsorProfile } = derivePdas(storedSponsor);
        await program.account["userProfile"].fetch(sponsorProfile);
        
        // Stored sponsor is registered with new format, use them
        console.log('✅ Using referral sponsor (registered with new format):', storedSponsor.toString());
        return storedSponsor;
      } catch (newFormatError) {
        // Try legacy PDA format
        try {
          const legacySponsorProfile = PublicKey.findProgramAddressSync([
            Buffer.from("profile"),
            storedSponsor.toBuffer(),
          ], program.programId)[0];
          
          await program.account["userProfile"].fetch(legacySponsorProfile);
          
          // Stored sponsor is registered with legacy format, use them
          console.log('✅ Using referral sponsor (registered with legacy format):', storedSponsor.toString());
          return storedSponsor;
        } catch (legacyFormatError) {
          // Stored sponsor not registered in either format, use default
          console.log('⚠️ Referral sponsor not registered, using default:', defaultSponsor.toString());
          return defaultSponsor;
        }
      }
    } catch (error) {
      console.warn('❌ Invalid stored sponsor address, using default');
      return defaultSponsor;
    }
  } else {
    console.log('📝 No referral sponsor in localStorage, using default as L1');
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
 * 2. sponsor_l2 = sponsor_l1's sponsor or default  
 * 3. sponsor_l3 = sponsor_l2's sponsor or default
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
  
  // Step 1: Get user's L1 sponsor using the hierarchy logic
  const sponsorL1 = await getSponsorL1(provider, userAddress);
  
  console.log('✅ User\'s existing L1 sponsor:', sponsorL1.toString());
  
  // Step 2: Build L2 from L1's sponsor
  console.log('🔍 Looking up L1 sponsor\'s sponsor...');
  const sponsorL2 = await getUserSponsor(program, sponsorL1);
  
  let finalSponsorL2: PublicKey;
  let finalSponsorL3: PublicKey;
  
  if (sponsorL2) {
    finalSponsorL2 = sponsorL2; // L1's sponsor becomes our L2
    console.log('✅ Found L2 sponsor:', finalSponsorL2.toString());
    
    // Step 3: Build L3 from L2's sponsor  
    console.log('🔍 Looking up L2 sponsor\'s sponsor...');
    const sponsorL3 = await getUserSponsor(program, finalSponsorL2);
    
    if (sponsorL3) {
      finalSponsorL3 = sponsorL3; // L2's sponsor becomes our L3
      console.log('✅ Found L3 sponsor:', finalSponsorL3.toString());
    } else {
      finalSponsorL3 = defaultSponsor;
      console.log('📝 L2 sponsor not found, using default as L3');
    }
  } else {
    // L1 sponsor not found, use defaults for L2 and L3
    finalSponsorL2 = defaultSponsor;
    finalSponsorL3 = defaultSponsor;
    console.log('📝 L1 sponsor not found, using defaults for L2 and L3');
  }
  
  const hierarchy = {
    sponsorL1, // EXISTING L1 - never changed
    sponsorL2: finalSponsorL2, // Constructed from L1's sponsor
    sponsorL3: finalSponsorL3  // Constructed from L2's sponsor
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
  const defaultSponsor = getDefaultSponsor();
  
  // Try to build the complete hierarchy
  try {
    const hierarchy = await buildSponsorHierarchy(provider, userAddress);
    return {
      user: userAddress,
      sponsorL1: hierarchy.sponsorL1,
      sponsorL2: hierarchy.sponsorL2,
      sponsorL3: hierarchy.sponsorL3,
      isRegistered: true
    };
  } catch (error) {
    // User not registered or error occurred
    return {
      user: userAddress,
      sponsorL1: defaultSponsor,
      sponsorL2: defaultSponsor,
      sponsorL3: defaultSponsor,
      isRegistered: false
    };
  }
}