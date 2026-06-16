import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MarketerDashboard } from '../MarketerDashboard';
import { useAdmin } from '../AdminProvider';
import { useBucketBalances } from '@/hooks/useBucketBalances';
import { useWallet } from '@/contexts/wallet-context';
import * as anchor from '@coral-xyz/anchor';

// Mock the hooks
vi.mock('../AdminProvider');
vi.mock('@/hooks/useBucketBalances');
vi.mock('@/contexts/wallet-context');

const mockUseAdmin = vi.mocked(useAdmin);
const mockUseBucketBalances = vi.mocked(useBucketBalances);
const mockUseWallet = vi.mocked(useWallet);

describe('MarketerDashboard', () => {
  const mockBuckets = {
    admin: new anchor.BN(0),
    dev: new anchor.BN(0),
    marketer1: new anchor.BN(1000000), // 1 USDT
    marketer2: new anchor.BN(2000000), // 2 USDT
    trader: new anchor.BN(0),
    systemreserve: new anchor.BN(0),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseBucketBalances.mockReturnValue({
      buckets: mockBuckets,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock useWallet hook
    mockUseWallet.mockReturnValue({
      publicKey: null,
      anchorProvider: null,
      connected: false,
      connecting: false,
      disconnecting: false,
      wallet: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTransaction: vi.fn(),
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
    });
  });

  it('renders marketer1 dashboard correctly', async () => {
    mockUseAdmin.mockReturnValue({
      role: 'marketer1',
      context: {
        role: 'marketer1',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Marketer 1 Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Manage your marketing earnings')).toBeInTheDocument();
    expect(screen.getByText('Marketer 1 Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/1\s+USDT/)).toBeInTheDocument();
  });

  it('renders marketer2 dashboard correctly', async () => {
    mockUseAdmin.mockReturnValue({
      role: 'marketer2',
      context: {
        role: 'marketer2',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer2'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Marketer 2 Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Manage your marketing earnings')).toBeInTheDocument();
    expect(screen.getByText('Marketer 2 Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/2\s+USDT/)).toBeInTheDocument();
  });

  it('shows access denied for non-marketer roles', async () => {
    mockUseAdmin.mockReturnValue({
      role: 'admin',
      context: {
        role: 'admin',
        canAccessConfig: false,
        canManageUsers: true,
        canViewAllBuckets: false,
        accessibleBuckets: ['admin', 'trader', 'systemreserve'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    expect(screen.getByText('This interface is restricted to marketer accounts only.')).toBeInTheDocument();
  });

  it('shows access denied for null role', async () => {
    mockUseAdmin.mockReturnValue({
      role: null,
      context: {
        role: null,
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: [],
      },
      hasAccess: false,
      isConfigured: true,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    mockUseAdmin.mockReturnValue({
      role: 'marketer1',
      context: {
        role: 'marketer1',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    mockUseBucketBalances.mockReturnValue({
      buckets: mockBuckets,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Loading your earnings...')).toBeInTheDocument();
    });
  });

  it('shows error state with retry button', async () => {
    const mockRefetch = vi.fn();
    
    mockUseAdmin.mockReturnValue({
      role: 'marketer1',
      context: {
        role: 'marketer1',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    mockUseBucketBalances.mockReturnValue({
      buckets: mockBuckets,
      isLoading: false,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load bucket balance information.')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
  });

  it('displays correct information sections', async () => {
    mockUseAdmin.mockReturnValue({
      role: 'marketer1',
      context: {
        role: 'marketer1',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer1'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Account Information')).toBeInTheDocument();
    });

    expect(screen.getByText('Your Earnings')).toBeInTheDocument();
    expect(screen.getByText('Marketer Interface')).toBeInTheDocument();
    expect(screen.getByText('Earnings Only')).toBeInTheDocument();
    expect(screen.getByText('View your current earnings balance')).toBeInTheDocument();
    expect(screen.getByText('Withdraw funds from your earnings bucket')).toBeInTheDocument();
    expect(screen.getByText('Real-time balance updates')).toBeInTheDocument();
  });

  it('shows correct note about restricted access', async () => {
    mockUseAdmin.mockReturnValue({
      role: 'marketer2',
      context: {
        role: 'marketer2',
        canAccessConfig: false,
        canManageUsers: false,
        canViewAllBuckets: false,
        accessibleBuckets: ['marketer2'],
      },
      hasAccess: true,
      isConfigured: true,
    });

    render(<MarketerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/As a marketer, you only have access to your own earnings bucket/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Other administrative functions are not available in this interface/)).toBeInTheDocument();
  });
});