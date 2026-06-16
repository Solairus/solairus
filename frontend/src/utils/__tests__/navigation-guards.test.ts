import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { canAccessAdmin, getUnauthorizedRedirect, isAdminRoute } from '../navigation-guards';
import * as adminRoles from '../admin-roles';

// Mock the admin-roles module
vi.mock('../admin-roles', () => ({
  detectUserRole: vi.fn(),
  hasAdminAccess: vi.fn(),
  validateAdminAddresses: vi.fn(),
}));

describe('Navigation Guards', () => {
  const mockPublicKey = new PublicKey('11111111111111111111111111111112');
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canAccessAdmin', () => {
    it('should return false when publicKey is null', () => {
      expect(canAccessAdmin(null)).toBe(false);
    });

    it('should return false when admin addresses are not configured', () => {
      vi.mocked(adminRoles.validateAdminAddresses).mockReturnValue(false);
      
      expect(canAccessAdmin(mockPublicKey)).toBe(false);
    });

    it('should return false when user has no admin access', () => {
      vi.mocked(adminRoles.validateAdminAddresses).mockReturnValue(true);
      vi.mocked(adminRoles.detectUserRole).mockReturnValue(null);
      vi.mocked(adminRoles.hasAdminAccess).mockReturnValue(false);
      
      expect(canAccessAdmin(mockPublicKey)).toBe(false);
    });

    it('should return true when user has admin access', () => {
      vi.mocked(adminRoles.validateAdminAddresses).mockReturnValue(true);
      vi.mocked(adminRoles.detectUserRole).mockReturnValue('admin');
      vi.mocked(adminRoles.hasAdminAccess).mockReturnValue(true);
      
      expect(canAccessAdmin(mockPublicKey)).toBe(true);
    });
  });

  describe('getUnauthorizedRedirect', () => {
    it('should return the main dapp path', () => {
      expect(getUnauthorizedRedirect()).toBe('/dapp');
    });
  });

  describe('isAdminRoute', () => {
    it('should return true for admin routes', () => {
      expect(isAdminRoute('/dapp/special')).toBe(true);
      expect(isAdminRoute('/dapp/special/config')).toBe(true);
    });

    it('should return false for non-admin routes', () => {
      expect(isAdminRoute('/dapp')).toBe(false);
      expect(isAdminRoute('/dapp/market')).toBe(false);
      expect(isAdminRoute('/privacy')).toBe(false);
      expect(isAdminRoute('/')).toBe(false);
    });
  });
});