import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BucketManagement } from '../BucketManagement';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useBucketBalances } from '@/hooks/useBucketBalances';
import { useWallet } from '@/contexts/wallet-context';
import * as anchor from '@coral-xyz/anchor';

// Mock the hooks
vi.mock('@/hooks/useAdminRole');
vi.mock('@/hooks/useBucketBalances');
vi.mock('@/contexts/wallet-context');

const mockUseAdminRole = vi.mocked(useAdminRole);
const mockUseBucketBalances = vi.mocked(useBucketBalances);
const mockUseWallet = vi.mocked(useWallet);

describe('BucketManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock wallet context
    mockUseWallet.mockReturnValue({
      publicKey: null,
      anchorProvider: null,
      isConnected: false,
      account: null,
      chainId: null,
      balance: null,
      isConnecting: false,
      isInitializing: false,
      provider: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
      switchNetwork: vi.fn(),
      formatAddress: vi.fn(),
      getChainInfo: vi.fn(),
    });
  });

  it('should deny access when user has no admin privileges', () => {
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

    mockUseBucketBalances.mockReturnValue({
      balances: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BucketManagement />);
    
    expect(screen.getByText('Access denied. Admin privileges required.')).toBeInTheDocument();
  });

  it('should show loading state when fetching bucket balances', () => {
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

    mockUseBucketBalances.mockReturnValue({
      balances: null,
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<BucketManagement />);
    
    expect(screen.getByText('Loading bucket balances...')).toBeInTheDocument();
  });

  it('should display bucket cards for accessible buckets', () => {
    const mockBalances = {
      admin: new anchor.BN(1000000000), // 1000 USDT
      dev: new anchor.BN(500000000),    // 500 USDT
      marketer1: new anchor.BN(0),
      marketer2: new anchor.BN(0),
      trader: new anchor.BN(250000000), // 250 USDT
      systemreserve: new anchor.BN(750000000), // 750 USDT
    };

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

    mockUseBucketBalances.mockReturnValue({
      balances: mockBalances,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BucketManagement />);
    
    // Should show bucket management title
    expect(screen.getByText('Bucket Management')).toBeInTheDocument();
    
    // Should show accessible buckets
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Trader')).toBeInTheDocument();
    expect(screen.getByText('System Reserve')).toBeInTheDocument();
    
    // Should show balances
    expect(screen.getByText('1000 USDT')).toBeInTheDocument();
    expect(screen.getByText('250 USDT')).toBeInTheDocument();
    expect(screen.getByText('750 USDT')).toBeInTheDocument();
  });

  it('should show all buckets for dev role', () => {
    const mockBalances = {
      admin: new anchor.BN(1000000000),
      dev: new anchor.BN(500000000),
      marketer1: new anchor.BN(100000000),
      marketer2: new anchor.BN(200000000),
      trader: new anchor.BN(250000000),
      systemreserve: new anchor.BN(750000000),
    };

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

    mockUseBucketBalances.mockReturnValue({
      balances: mockBalances,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BucketManagement />);
    
    // Should show all bucket types
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Marketer 1')).toBeInTheDocument();
    expect(screen.getByText('Marketer 2')).toBeInTheDocument();
    expect(screen.getByText('Trader')).toBeInTheDocument();
    expect(screen.getByText('System Reserve')).toBeInTheDocument();
  });
});