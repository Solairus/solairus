import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { AdminProvider, useAdmin } from '../AdminProvider';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';

// Mock dependencies
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: vi.fn(),
}));

const mockUseWallet = useWallet as vi.MockedFunction<typeof useWallet>;
const mockUseAdminRole = useAdminRole as vi.MockedFunction<typeof useAdminRole>;

// Test component that uses the admin context
const TestComponent: React.FC = () => {
  const admin = useAdmin();
  
  return (
    <div>
      <div data-testid="role">{admin.role || 'none'}</div>
      <div data-testid="can-access-config">{admin.canAccessConfig.toString()}</div>
      <div data-testid="can-manage-users">{admin.canManageUsers.toString()}</div>
      <div data-testid="can-view-all-buckets">{admin.canViewAllBuckets.toString()}</div>
      <div data-testid="accessible-buckets">{admin.accessibleBuckets.join(',')}</div>
      <div data-testid="has-access">{admin.hasAccess.toString()}</div>
      <div data-testid="is-configured">{admin.isConfigured.toString()}</div>
    </div>
  );
};

describe('AdminProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      publicKey: new PublicKey('11111111111111111111111111111111'),
      connected: true,
      connecting: false,
      disconnecting: false,
      wallet: null,
      wallets: [],
      select: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTransaction: vi.fn(),
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
      anchorProvider: {} as any,
    });
  });

  it('should provide admin context for admin role', () => {
    mockUseAdminRole.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: false,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(screen.getByTestId('can-access-config')).toHaveTextContent('false');
    expect(screen.getByTestId('can-manage-users')).toHaveTextContent('true');
    expect(screen.getByTestId('can-view-all-buckets')).toHaveTextContent('false');
    expect(screen.getByTestId('accessible-buckets')).toHaveTextContent('admin,trader,systemreserve');
    expect(screen.getByTestId('has-access')).toHaveTextContent('true');
    expect(screen.getByTestId('is-configured')).toHaveTextContent('true');
  });

  it('should provide dev context for dev role', () => {
    mockUseAdminRole.mockReturnValue({
      role: 'dev',
      context: {
        canAccessConfig: true,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('dev');
    expect(screen.getByTestId('can-access-config')).toHaveTextContent('true');
    expect(screen.getByTestId('can-manage-users')).toHaveTextContent('true');
    expect(screen.getByTestId('can-view-all-buckets')).toHaveTextContent('true');
    expect(screen.getByTestId('accessible-buckets')).toHaveTextContent('admin,dev,marketer1,marketer2,trader,systemreserve');
    expect(screen.getByTestId('has-access')).toHaveTextContent('true');
    expect(screen.getByTestId('is-configured')).toHaveTextContent('true');
  });

  it('should provide marketer context for marketer1 role', () => {
    mockUseAdminRole.mockReturnValue({
      role: 'marketer1',
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('marketer1');
    expect(screen.getByTestId('can-access-config')).toHaveTextContent('false');
    expect(screen.getByTestId('can-manage-users')).toHaveTextContent('false');
    expect(screen.getByTestId('can-view-all-buckets')).toHaveTextContent('false');
    expect(screen.getByTestId('accessible-buckets')).toHaveTextContent('marketer1');
    expect(screen.getByTestId('has-access')).toHaveTextContent('true');
    expect(screen.getByTestId('is-configured')).toHaveTextContent('true');
  });

  it('should provide no access context for unauthorized users', () => {
    mockUseAdminRole.mockReturnValue({
      role: null,
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: [],
      },
      hasAccess: false,
      isConfigured: true,
    });

    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(screen.getByTestId('can-access-config')).toHaveTextContent('false');
    expect(screen.getByTestId('can-manage-users')).toHaveTextContent('false');
    expect(screen.getByTestId('can-view-all-buckets')).toHaveTextContent('false');
    expect(screen.getByTestId('accessible-buckets')).toHaveTextContent('');
    expect(screen.getByTestId('has-access')).toHaveTextContent('false');
    expect(screen.getByTestId('is-configured')).toHaveTextContent('true');
  });

  it('should handle configuration errors', () => {
    mockUseAdminRole.mockReturnValue({
      role: null,
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: [],
      },
      hasAccess: false,
      isConfigured: false,
    });

    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(screen.getByTestId('has-access')).toHaveTextContent('false');
    expect(screen.getByTestId('is-configured')).toHaveTextContent('false');
  });

  it('should update context when wallet changes', () => {
    const { rerender } = render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    // Initially admin
    mockUseAdminRole.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: false,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    rerender(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('admin');

    // Change to dev
    mockUseAdminRole.mockReturnValue({
      role: 'dev',
      context: {
        canAccessConfig: true,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    rerender(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('dev');
    expect(screen.getByTestId('can-access-config')).toHaveTextContent('true');
  });

  it('should handle wallet disconnection', () => {
    mockUseWallet.mockReturnValue({
      publicKey: null,
      connected: false,
      connecting: false,
      disconnecting: false,
      wallet: null,
      wallets: [],
      select: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTransaction: vi.fn(),
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
      anchorProvider: null,
    });

    mockUseAdminRole.mockReturnValue({
      role: null,
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: [],
      },
      hasAccess: false,
      isConfigured: true,
    });

    render(
      <AdminProvider>
        <TestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(screen.getByTestId('has-access')).toHaveTextContent('false');
  });

  it('should throw error when useAdmin is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAdmin must be used within an AdminProvider');

    consoleSpy.mockRestore();
  });

  it('should provide helper methods for role checking', () => {
    mockUseAdminRole.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: false,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    const HelperTestComponent: React.FC = () => {
      const admin = useAdmin();
      
      return (
        <div>
          <div data-testid="is-admin">{admin.isAdmin.toString()}</div>
          <div data-testid="is-dev">{admin.isDev.toString()}</div>
          <div data-testid="is-marketer">{admin.isMarketer.toString()}</div>
          <div data-testid="can-access-bucket-admin">{admin.canAccessBucket('admin').toString()}</div>
          <div data-testid="can-access-bucket-dev">{admin.canAccessBucket('dev').toString()}</div>
        </div>
      );
    };

    render(
      <AdminProvider>
        <HelperTestComponent />
      </AdminProvider>
    );

    expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    expect(screen.getByTestId('is-dev')).toHaveTextContent('false');
    expect(screen.getByTestId('is-marketer')).toHaveTextContent('false');
    expect(screen.getByTestId('can-access-bucket-admin')).toHaveTextContent('true');
    expect(screen.getByTestId('can-access-bucket-dev')).toHaveTextContent('false');
  });
});