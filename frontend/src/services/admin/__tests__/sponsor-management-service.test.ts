/**
 * Sponsor Management Service Tests
 */

import { PublicKey } from '@solana/web3.js';
import { validateSponsorChange } from '../sponsor-management-service';

describe('Sponsor Management Service', () => {
  const userPubkey = new PublicKey('11111111111111111111111111111111');
  const sponsorPubkey = new PublicKey('22222222222222222222222222222222');
  const newSponsorPubkey = new PublicKey('33333333333333333333333333333333');

  describe('validateSponsorChange', () => {
    it('should allow valid sponsor change', () => {
      const result = validateSponsorChange(userPubkey, sponsorPubkey, newSponsorPubkey);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject self-sponsorship', () => {
      const result = validateSponsorChange(userPubkey, sponsorPubkey, userPubkey);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User cannot sponsor themselves');
    });

    it('should reject same sponsor update', () => {
      const result = validateSponsorChange(userPubkey, sponsorPubkey, sponsorPubkey);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User already has this sponsor');
    });

    it('should allow changing from default sponsor', () => {
      const result = validateSponsorChange(userPubkey, PublicKey.default, newSponsorPubkey);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow changing to default sponsor', () => {
      const result = validateSponsorChange(userPubkey, sponsorPubkey, PublicKey.default);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});