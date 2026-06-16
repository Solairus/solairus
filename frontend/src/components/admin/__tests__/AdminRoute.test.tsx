import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminRoute } from '../AdminRoute';
import { useWallet } from '@/contexts/wallet-context';
import { PublicKey } from '@solana/web3.js';
import * as adminRoles from '../../../utils/admin-roles';

// Mock the wallet context
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

// Mock the admin-roles module
vi.mock('../../../utils/admin-roles', () => {
  const actual = vi.importActual('../../../utils/admin-roles');
  return {
    ...actual,
    validateAdminAddresses: vi.fn(),
    detectUserRole: vi.fn(),
    hasAdminAccess: vi.fn(),
    getAdminContext: vi.fn(),
  };
});

const mockUseWallet = vi.mocked(useWallet);
const mockValidateAdminAddresses = vi.mocked(adminRoles.validateAdminAddresses);
const mockDetectUserRole = vi.mocked(adminRoles.detectUserRole);
const mockHasAdminAccess = vi.mocked(adminRoles.hasAdminAccess);
const mockGetAdminContext = vi.mocked(adminRoles.getAdminContext);

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock returns
    mockValidateAdminAddresses.mockReturnValue(true);
    mockDetectUserRole.mockReturnValue(null);
    mockHasAdminAccess.mockReturnValue(false);
    mockGetAdminContext.mockReturnValue({
      role: null,
      canAccessConfig: false,
      canManageUsers: false,
      canViewAllBuckets: false,
      accessibleBuckets: [],
    });
  });

  it('should show configuration error when admin addresses are not configured', () => {
    mockValidateAdminAddresses.mockReturnValue(false);

    mockUseWallet.mockReturnValue({
      isConnected: true,
      publicKey: new PublicKey('7KmgyD1WPmXvuKTrKLVmhZKeY27YR43riLdavFSjMgVS'),
    } as any);

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Configuration Error')).toBeInTheDocument();
    expect(screen.getByText(/Admin addresses are not properly configured/)).toBeInTheDocument();
  });

  it('should show wallet required message when wallet is not connected', () => {
    mockValidateAdminAddresses.mockReturnValue(true);
    mockUseWallet.mockReturnValue({
      isConnected: false,
      publicKey: null,
    } as any);

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Wallet Required')).toBeInTheDocument();
    expect(screen.getByText(/Please connect your wallet to access the admin interface/)).toBeInTheDocument();
  });

  it('should show access denied for unauthorized wallet', () => {
    const unauthorizedKey = new PublicKey('11111111111111111111111111111112');

    mockValidateAdminAddresses.mockReturnValue(true);
    mockDetectUserRole.mockReturnValue(null);
    mockHasAdminAccess.mockReturnValue(false);

    mockUseWallet.mockReturnValue({
      isConnected: true,
      publicKey: unauthorizedKey,
    } as any);

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/Your wallet address is not authorized/)).toBeInTheDocument();
  });

  it('should render admin content for authorized admin wallet', () => {
    const adminKey = new PublicKey('7KmgyD1WPmXvuKTrKLVmhZKeY27YR43riLdavFSjMgVS');

    mockValidateAdminAddresses.mockReturnValue(true);
    mockDetectUserRole.mockReturnValue('admin');
    mockHasAdminAccess.mockReturnValue(true);
    mockGetAdminContext.mockReturnValue({
      role: 'admin',
      canAccessConfig: false,
      canManageUsers: true,
      canViewAllBuckets: false,
      accessibleBuckets: ['admin', 'trader', 'systemreserve'],
    });

    mockUseWallet.mockReturnValue({
      isConnected: true,
      publicKey: adminKey,
    } as any);

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Admin Interface')).toBeInTheDocument();
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should render admin content for authorized dev wallet', () => {
    const devKey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');

    mockValidateAdminAddresses.mockReturnValue(true);
    mockDetectUserRole.mockReturnValue('dev');
    mockHasAdminAccess.mockReturnValue(true);
    mockGetAdminContext.mockReturnValue({
      role: 'dev',
      canAccessConfig: true,
      canManageUsers: true,
      canViewAllBuckets: true,
      accessibleBuckets: ['admin', 'dev', 'marketer1', 'marketer2', 'trader', 'systemreserve'],
    });

    mockUseWallet.mockReturnValue({
      isConnected: true,
      publicKey: devKey,
    } as unknown);

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Admin Interface')).toBeInTheDocument();
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});