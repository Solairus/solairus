import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminDashboard } from '../AdminDashboard';
import { useAdmin } from '../AdminProvider';

// Mock the useAdmin hook
vi.mock('../AdminProvider', () => ({
  useAdmin: vi.fn(),
}));

// Mock all admin components
vi.mock('../ConfigManagement', () => ({
  ConfigManagement: () => <div data-testid="config-management">Config Management</div>,
}));

vi.mock('../BucketManagement', () => ({
  BucketManagement: () => <div data-testid="bucket-management">Bucket Management</div>,
}));

vi.mock('../UserCreditManagement', () => ({
  UserCreditManagement: () => <div data-testid="user-credit-management">User Credit Management</div>,
}));

vi.mock('../UserSponsorManagement', () => ({
  UserSponsorManagement: () => <div data-testid="user-sponsor-management">User Sponsor Management</div>,
}));

vi.mock('../ManualLicenseActivation', () => ({
  ManualLicenseActivation: () => <div data-testid="manual-license-activation">Manual License Activation</div>,
}));

vi.mock('../MarketerDashboard', () => ({
  MarketerDashboard: () => <div data-testid="marketer-dashboard">Marketer Dashboard</div>,
}));

const mockUseAdmin = useAdmin as vi.MockedFunction<typeof useAdmin>;

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders admin dashboard for admin role', () => {
    mockUseAdmin.mockReturnValue({
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

    render(<AdminDashboard />);
    
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('bucket-management')).toBeInTheDocument();
    expect(screen.getByTestId('user-credit-management')).toBeInTheDocument();
    expect(screen.getByTestId('user-sponsor-management')).toBeInTheDocument();
    expect(screen.getByTestId('manual-license-activation')).toBeInTheDocument();
    
    // Admin should not see config management
    expect(screen.queryByTestId('config-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketer-dashboard')).not.toBeInTheDocument();
  });

  it('renders dev dashboard with all components', () => {
    mockUseAdmin.mockReturnValue({
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

    render(<AdminDashboard />);
    
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('config-management')).toBeInTheDocument();
    expect(screen.getByTestId('bucket-management')).toBeInTheDocument();
    expect(screen.getByTestId('user-credit-management')).toBeInTheDocument();
    expect(screen.getByTestId('user-sponsor-management')).toBeInTheDocument();
    expect(screen.getByTestId('manual-license-activation')).toBeInTheDocument();
    
    // Dev should not see marketer dashboard
    expect(screen.queryByTestId('marketer-dashboard')).not.toBeInTheDocument();
  });

  it('renders marketer1 dashboard with limited access', () => {
    mockUseAdmin.mockReturnValue({
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

    render(<AdminDashboard />);
    
    expect(screen.getByTestId('marketer-dashboard')).toBeInTheDocument();
    
    // Marketer should not see admin components
    expect(screen.queryByTestId('config-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bucket-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-credit-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-sponsor-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manual-license-activation')).not.toBeInTheDocument();
  });

  it('renders marketer2 dashboard with limited access', () => {
    mockUseAdmin.mockReturnValue({
      role: 'marketer2',
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer2'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(<AdminDashboard />);
    
    expect(screen.getByTestId('marketer-dashboard')).toBeInTheDocument();
    
    // Marketer should not see admin components
    expect(screen.queryByTestId('config-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bucket-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-credit-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-sponsor-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manual-license-activation')).not.toBeInTheDocument();
  });

  it('shows access denied for unauthorized users', () => {
    mockUseAdmin.mockReturnValue({
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

    render(<AdminDashboard />);
    
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to access the admin dashboard.')).toBeInTheDocument();
  });

  it('shows configuration error when admin addresses not configured', () => {
    mockUseAdmin.mockReturnValue({
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

    render(<AdminDashboard />);
    
    expect(screen.getByText('Configuration Error')).toBeInTheDocument();
    expect(screen.getByText('Admin addresses are not properly configured. Please check your environment variables.')).toBeInTheDocument();
  });
});