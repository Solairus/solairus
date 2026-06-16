import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';
import * as useAdminRole from '../../hooks/useAdminRole';

// Mock the hooks
vi.mock('../../hooks/useAdminRole');

const renderBottomNav = (initialPath = '/dapp') => {
  return render(
    <BrowserRouter>
      <div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
};

describe('BottomNav Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not show admin navigation when user has no access', () => {
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

    renderBottomNav();

    expect(screen.queryByLabelText('Admin')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Market')).toBeInTheDocument();
    expect(screen.getByLabelText('Affiliate')).toBeInTheDocument();
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
  });

  it('should show admin navigation when user has admin access', () => {
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

    renderBottomNav();

    expect(screen.getByLabelText('Admin')).toBeInTheDocument();
    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Market')).toBeInTheDocument();
    expect(screen.getByLabelText('Affiliate')).toBeInTheDocument();
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
  });

  it('should show admin navigation when user has dev access', () => {
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

    renderBottomNav();

    expect(screen.getByLabelText('Admin')).toBeInTheDocument();
  });

  it('should show admin navigation when user has marketer access', () => {
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

    renderBottomNav();

    expect(screen.getByLabelText('Admin')).toBeInTheDocument();
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

    renderBottomNav();

    const adminLink = screen.getByLabelText('Admin');
    expect(adminLink).toHaveAttribute('href', '/dapp/special');
  });

  it('should apply special styling to admin navigation item', () => {
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

    renderBottomNav();

    const adminLink = screen.getByLabelText('Admin');
    expect(adminLink).toHaveClass('text-orange-400');
  });
});