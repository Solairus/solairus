import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  detectUserRole,
  getAdminContext,
  hasAdminAccess,
  validateAdminAddresses,
  canPerformAction,
} from '../admin-roles';

describe('admin-roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment variables
    vi.stubEnv('VITE_ADMIN_ADDRESS', '7KmgyD1WPmXvuKTrKLVmhZKeY27YR43riLdavFSjMgVS');
    vi.stubEnv('VITE_DEV_ADDRESS', '4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
    vi.stubEnv('VITE_MARKETER1_ADDRESS', 'AvpfRzHW2UJkUcQYCRj4vz4ZweKLzYPBjjbWRUMk7fjH');
    vi.stubEnv('VITE_MARKETER2_ADDRESS', '84DLxUZuKKdYpW6CqTK7Xy3P4sa9SX9cUiBDtKzFeacd');
  });

  describe('detectUserRole', () => {
    it('should return null for null wallet address', () => {
      expect(detectUserRole(null)).toBe(null);
    });

    it('should detect admin role correctly', () => {
      const adminKey = new PublicKey('7KmgyD1WPmXvuKTrKLVmhZKeY27YR43riLdavFSjMgVS');
      expect(detectUserRole(adminKey)).toBe('admin');
    });

    it('should detect dev role correctly', () => {
      const devKey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
      expect(detectUserRole(devKey)).toBe('dev');
    });

    it('should detect marketer1 role correctly', () => {
      const marketer1Key = new PublicKey('AvpfRzHW2UJkUcQYCRj4vz4ZweKLzYPBjjbWRUMk7fjH');
      expect(detectUserRole(marketer1Key)).toBe('marketer1');
    });

    it('should detect marketer2 role correctly', () => {
      const marketer2Key = new PublicKey('84DLxUZuKKdYpW6CqTK7Xy3P4sa9SX9cUiBDtKzFeacd');
      expect(detectUserRole(marketer2Key)).toBe('marketer2');
    });

    it('should return null for unauthorized address', () => {
      const unauthorizedKey = new PublicKey('11111111111111111111111111111112');
      expect(detectUserRole(unauthorizedKey)).toBe(null);
    });
  });

  describe('validateAdminAddresses', () => {
    it('should return true when all addresses are configured', () => {
      expect(validateAdminAddresses()).toBe(true);
    });

    it('should return false when admin address is missing', () => {
      vi.stubEnv('VITE_ADMIN_ADDRESS', '');
      expect(validateAdminAddresses()).toBe(false);
    });

    it('should return false when dev address is missing', () => {
      vi.stubEnv('VITE_DEV_ADDRESS', '');
      expect(validateAdminAddresses()).toBe(false);
    });
  });

  describe('getAdminContext', () => {
    it('should return correct context for admin role', () => {
      const context = getAdminContext('admin');
      expect(context.role).toBe('admin');
      expect(context.canAccessConfig).toBe(false);
      expect(context.canManageUsers).toBe(true);
      expect(context.canViewAllBuckets).toBe(false);
      expect(context.accessibleBuckets).toEqual(['admin', 'trader', 'systemreserve']);
    });

    it('should return correct context for dev role', () => {
      const context = getAdminContext('dev');
      expect(context.role).toBe('dev');
      expect(context.canAccessConfig).toBe(true);
      expect(context.canManageUsers).toBe(true);
      expect(context.canViewAllBuckets).toBe(true);
      expect(context.accessibleBuckets).toEqual(['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve']);
    });

    it('should return correct context for marketer1 role', () => {
      const context = getAdminContext('marketer1');
      expect(context.role).toBe('marketer1');
      expect(context.canAccessConfig).toBe(false);
      expect(context.canManageUsers).toBe(false);
      expect(context.canViewAllBuckets).toBe(false);
      expect(context.accessibleBuckets).toEqual(['marketer1']);
    });

    it('should return null context for null role', () => {
      const context = getAdminContext(null);
      expect(context.role).toBe(null);
      expect(context.canAccessConfig).toBe(false);
      expect(context.canManageUsers).toBe(false);
      expect(context.canViewAllBuckets).toBe(false);
      expect(context.accessibleBuckets).toEqual([]);
    });
  });

  describe('hasAdminAccess', () => {
    it('should return true for admin role', () => {
      expect(hasAdminAccess('admin')).toBe(true);
    });

    it('should return true for dev role', () => {
      expect(hasAdminAccess('dev')).toBe(true);
    });

    it('should return true for marketer roles', () => {
      expect(hasAdminAccess('marketer1')).toBe(true);
      expect(hasAdminAccess('marketer2')).toBe(true);
    });

    it('should return false for null role', () => {
      expect(hasAdminAccess(null)).toBe(false);
    });
  });

  describe('canPerformAction', () => {
    it('should allow dev to access config', () => {
      expect(canPerformAction('dev', 'config')).toBe(true);
    });

    it('should not allow admin to access config', () => {
      expect(canPerformAction('admin', 'config')).toBe(false);
    });

    it('should allow admin and dev to manage users', () => {
      expect(canPerformAction('admin', 'users')).toBe(true);
      expect(canPerformAction('dev', 'users')).toBe(true);
    });

    it('should not allow marketers to manage users', () => {
      expect(canPerformAction('marketer1', 'users')).toBe(false);
      expect(canPerformAction('marketer2', 'users')).toBe(false);
    });

    it('should allow all roles to access buckets', () => {
      expect(canPerformAction('admin', 'buckets')).toBe(true);
      expect(canPerformAction('dev', 'buckets')).toBe(true);
      expect(canPerformAction('marketer1', 'buckets')).toBe(true);
      expect(canPerformAction('marketer2', 'buckets')).toBe(true);
    });

    it('should only allow dev to view all buckets', () => {
      expect(canPerformAction('dev', 'all-buckets')).toBe(true);
      expect(canPerformAction('admin', 'all-buckets')).toBe(false);
      expect(canPerformAction('marketer1', 'all-buckets')).toBe(false);
    });
  });
});