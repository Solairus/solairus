import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { 
  validateAdminAddresses, 
  detectUserRole, 
  hasAdminAccess, 
  getAdminContext,
  canAccessBucket,
  canManageUsers,
  canAccessConfig
} from '../admin-roles';

// Mock environment variables
const mockEnv = {
  VITE_ADMIN_ADDRESS: '7KmgyD1WPmXvuKTrKLVmhZKeY27YR43riLdavFSjMgVS',
  VITE_DEV_ADDRESS: '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez',
  VITE_MARKETER1_ADDRESS: '8ZXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez',
  VITE_MARKETER2_ADDRESS: '9ZXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez',
};

describe('Admin Access Control Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock import.meta.env
    Object.defineProperty(import.meta, 'env', {
      value: mockEnv,
      writable: true,
    });
  });

  describe('validateAdminAddresses', () => {
    it('should return true when all admin addresses are configured', () => {
      expect(validateAdminAddresses()).toBe(true);
    });

    it('should return false when admin address is missing', () => {
      const originalEnv = import.meta.env;
      Object.defineProperty(import.meta, 'env', {
        value: { ...mockEnv, VITE_ADMIN_ADDRESS: undefined },
        writable: true,
      });

      expect(validateAdminAddresses()).toBe(false);

      // Restore
      Object.defineProperty(import.meta, 'env', {
        value: originalEnv,
        writable: true,
      });
    });

    it('should return false when dev address is missing', () => {
      const originalEnv = import.meta.env;
      Object.defineProperty(import.meta, 'env', {
        value: { ...mockEnv, VITE_DEV_ADDRESS: undefined },
        writable: true,
      });

      expect(validateAdminAddresses()).toBe(false);

      // Restore
      Object.defineProperty(import.meta, 'env', {
        value: originalEnv,
        writable: true,
      });
    });
  });

  describe('detectUserRole', () => {
    it('should detect admin role correctly', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      expect(detectUserRole(adminKey)).toBe('admin');
    });

    it('should detect dev role correctly', () => {
      const devKey = new PublicKey(mockEnv.VITE_DEV_ADDRESS);
      expect(detectUserRole(devKey)).toBe('dev');
    });

    it('should detect marketer1 role correctly', () => {
      const marketer1Key = new PublicKey(mockEnv.VITE_MARKETER1_ADDRESS);
      expect(detectUserRole(marketer1Key)).toBe('marketer1');
    });

    it('should detect marketer2 role correctly', () => {
      const marketer2Key = new PublicKey(mockEnv.VITE_MARKETER2_ADDRESS);
      expect(detectUserRole(marketer2Key)).toBe('marketer2');
    });

    it('should return null for unauthorized addresses', () => {
      const unauthorizedKey = new PublicKey('11111111111111111111111111111112');
      expect(detectUserRole(unauthorizedKey)).toBe(null);
    });

    it('should handle null public key', () => {
      expect(detectUserRole(null)).toBe(null);
    });
  });

  describe('hasAdminAccess', () => {
    it('should grant access to admin', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      expect(hasAdminAccess(adminKey)).toBe(true);
    });

    it('should grant access to dev', () => {
      const devKey = new PublicKey(mockEnv.VITE_DEV_ADDRESS);
      expect(hasAdminAccess(devKey)).toBe(true);
    });

    it('should grant access to marketer1', () => {
      const marketer1Key = new PublicKey(mockEnv.VITE_MARKETER1_ADDRESS);
      expect(hasAdminAccess(marketer1Key)).toBe(true);
    });

    it('should grant access to marketer2', () => {
      const marketer2Key = new PublicKey(mockEnv.VITE_MARKETER2_ADDRESS);
      expect(hasAdminAccess(marketer2Key)).toBe(true);
    });

    it('should deny access to unauthorized users', () => {
      const unauthorizedKey = new PublicKey('11111111111111111111111111111112');
      expect(hasAdminAccess(unauthorizedKey)).toBe(false);
    });

    it('should deny access when public key is null', () => {
      expect(hasAdminAccess(null)).toBe(false);
    });
  });

  describe('getAdminContext', () => {
    it('should return correct context for admin role', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      const context = getAdminContext(adminKey);

      expect(context).toEqual({
        role: 'admin',
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: false,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      });
    });

    it('should return correct context for dev role', () => {
      const devKey = new PublicKey(mockEnv.VITE_DEV_ADDRESS);
      const context = getAdminContext(devKey);

      expect(context).toEqual({
        role: 'dev',
        canAccessConfig: true,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'],
      });
    });

    it('should return correct context for marketer1 role', () => {
      const marketer1Key = new PublicKey(mockEnv.VITE_MARKETER1_ADDRESS);
      const context = getAdminContext(marketer1Key);

      expect(context).toEqual({
        role: 'marketer1',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
      });
    });

    it('should return correct context for marketer2 role', () => {
      const marketer2Key = new PublicKey(mockEnv.VITE_MARKETER2_ADDRESS);
      const context = getAdminContext(marketer2Key);

      expect(context).toEqual({
        role: 'marketer2',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer2'],
      });
    });

    it('should return null context for unauthorized users', () => {
      const unauthorizedKey = new PublicKey('11111111111111111111111111111112');
      const context = getAdminContext(unauthorizedKey);

      expect(context).toEqual({
        role: null,
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: [],
      });
    });
  });

  describe('canAccessBucket', () => {
    it('should allow admin to access admin buckets', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      expect(canAccessBucket(adminKey, 'admin')).toBe(true);
      expect(canAccessBucket(adminKey, 'trader')).toBe(true);
      expect(canAccessBucket(adminKey, 'systemreserve')).toBe(true);
    });

    it('should not allow admin to access dev or marketer buckets', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      expect(canAccessBucket(adminKey, 'dev')).toBe(false);
      expect(canAccessBucket(adminKey, 'marketer1')).toBe(false);
      expect(canAccessBucket(adminKey, 'marketer2')).toBe(false);
    });

    it('should allow dev to access all buckets', () => {
      const devKey = new PublicKey(mockEnv.VITE_DEV_ADDRESS);
      expect(canAccessBucket(devKey, 'admin')).toBe(true);
      expect(canAccessBucket(devKey, 'dev')).toBe(true);
      expect(canAccessBucket(devKey, 'marketer1')).toBe(true);
      expect(canAccessBucket(devKey, 'marketer2')).toBe(true);
      expect(canAccessBucket(devKey, 'trader')).toBe(true);
      expect(canAccessBucket(devKey, 'systemreserve')).toBe(true);
    });

    it('should allow marketer1 to access only their bucket', () => {
      const marketer1Key = new PublicKey(mockEnv.VITE_MARKETER1_ADDRESS);
      expect(canAccessBucket(marketer1Key, 'marketer1')).toBe(true);
      expect(canAccessBucket(marketer1Key, 'marketer2')).toBe(false);
      expect(canAccessBucket(marketer1Key, 'admin')).toBe(false);
      expect(canAccessBucket(marketer1Key, 'dev')).toBe(false);
    });

    it('should allow marketer2 to access only their bucket', () => {
      const marketer2Key = new PublicKey(mockEnv.VITE_MARKETER2_ADDRESS);
      expect(canAccessBucket(marketer2Key, 'marketer2')).toBe(true);
      expect(canAccessBucket(marketer2Key, 'marketer1')).toBe(false);
      expect(canAccessBucket(marketer2Key, 'admin')).toBe(false);
      expect(canAccessBucket(marketer2Key, 'dev')).toBe(false);
    });
  });

  describe('canManageUsers', () => {
    it('should allow admin to manage users', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      expect(canManageUsers(adminKey)).toBe(true);
    });

    it('should allow dev to manage users', () => {
      const devKey = new PublicKey(mockEnv.VITE_DEV_ADDRESS);
      expect(canManageUsers(devKey)).toBe(true);
    });

    it('should not allow marketers to manage users', () => {
      const marketer1Key = new PublicKey(mockEnv.VITE_MARKETER1_ADDRESS);
      const marketer2Key = new PublicKey(mockEnv.VITE_MARKETER2_ADDRESS);
      expect(canManageUsers(marketer1Key)).toBe(false);
      expect(canManageUsers(marketer2Key)).toBe(false);
    });

    it('should not allow unauthorized users to manage users', () => {
      const unauthorizedKey = new PublicKey('11111111111111111111111111111112');
      expect(canManageUsers(unauthorizedKey)).toBe(false);
    });
  });

  describe('canAccessConfig', () => {
    it('should allow only dev to access config', () => {
      const devKey = new PublicKey(mockEnv.VITE_DEV_ADDRESS);
      expect(canAccessConfig(devKey)).toBe(true);
    });

    it('should not allow admin to access config', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS);
      expect(canAccessConfig(adminKey)).toBe(false);
    });

    it('should not allow marketers to access config', () => {
      const marketer1Key = new PublicKey(mockEnv.VITE_MARKETER1_ADDRESS);
      const marketer2Key = new PublicKey(mockEnv.VITE_MARKETER2_ADDRESS);
      expect(canAccessConfig(marketer1Key)).toBe(false);
      expect(canAccessConfig(marketer2Key)).toBe(false);
    });

    it('should not allow unauthorized users to access config', () => {
      const unauthorizedKey = new PublicKey('11111111111111111111111111111112');
      expect(canAccessConfig(unauthorizedKey)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid public key strings gracefully', () => {
      expect(() => detectUserRole(new PublicKey('invalid'))).toThrow();
    });

    it('should handle missing environment variables gracefully', () => {
      const originalEnv = import.meta.env;
      Object.defineProperty(import.meta, 'env', {
        value: {},
        writable: true,
      });

      expect(validateAdminAddresses()).toBe(false);
      expect(detectUserRole(new PublicKey('11111111111111111111111111111112'))).toBe(null);

      // Restore
      Object.defineProperty(import.meta, 'env', {
        value: originalEnv,
        writable: true,
      });
    });

    it('should handle case-sensitive address comparison', () => {
      const adminKey = new PublicKey(mockEnv.VITE_ADMIN_ADDRESS.toLowerCase());
      // PublicKey constructor normalizes the address, so this should still work
      expect(detectUserRole(adminKey)).toBe('admin');
    });
  });
});