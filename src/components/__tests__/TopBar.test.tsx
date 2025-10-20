import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import TopBar from '../TopBar';
import * as useAdminRole from '../../hooks/useAdminRole';

// Mock the hooks
vi.mock('../../hooks/useAdminRole');
vi.mock('../../contexts/wallet-context', () => ({
  useWallet: () => ({
    publicKey: null,
    isConnected: false,
  }),
}));
vi.mock('../../contexts/license-context', () => ({
  useLicense: () => ({
    isActive: false,
    expiresAt: null,
  }),
}));

const renderTopBar = () => {
  return render(
    <BrowserRouter>
      <TopBar title="Test App" />
    </BrowserRouter>
  );
};

describe('TopBar Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not show admin button when user has no access', () => {
    vi.mocked(useAdminRole.useAdminRole).mockReturnValue({
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

    renderTopBar();

    expect(screen.queryByLabelText(/Admin Panel/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('should show admin button when user has admin access', () => {
    vi.mocked(useAdminRole.useAdminRole).mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    renderTopBar();

    expect(screen.getByLabelText('Admin Panel (admin)')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('should show admin button when user has dev access', () => {
    vi.mocked(useAdminRole.useAdminRole).mockReturnValue({
      role: 'dev',
      context: {
        canAccessConfig: true,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['dev', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    renderTopBar();

    expect(screen.getByLabelText('Admin Panel (dev)')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('should show admin button when user has marketer access', () => {
    vi.mocked(useAdminRole.useAdminRole).mockReturnValue({
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

    renderTopBar();

    expect(screen.getByLabelText('Admin Panel (marketer1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('should have correct link to admin interface', () => {
    vi.mocked(useAdminRole.useAdminRole).mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    renderTopBar();

    const adminLink = screen.getByLabelText('Admin Panel (admin)');
    expect(adminLink).toHaveAttribute('href', '/dapp/special');
  });
});