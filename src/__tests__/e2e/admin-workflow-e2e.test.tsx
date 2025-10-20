import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';

// Mock all dependencies
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: vi.fn(),
}));

vi.mock('@/hooks/useBucketBalances', () => ({
  useBucketBalances: vi.fn(() => ({
    balances: {
      admin: { toString: () => '1000000000' },
      dev: { toString: () => '500000000' },
      marketer1: { toString: () => '100000000' },
      marketer2: { toString: () => '200000000' },
      trader: { toString: () => '250000000' },
      systemreserve: { toString: () => '750000000' },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(() => ({
    methods: {
      activateLicenseManual: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(() => Promise.resolve('mock-tx-signature')),
        })),
      })),
      creditUserBalance: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(() => Promise.resolve('mock-tx-signature')),
        })),
      })),
      updateUserProfile: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(() => Promise.resolve('mock-tx-signature')),
        })),
      })),
      withdrawSystemBucket: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(() => Promise.resolve('mock-tx-signature')),
        })),
      })),
    },
  })),
  derivePdas: vi.fn(() => ({
    config: new PublicKey('11111111111111111111111111111111'),
    profile: new PublicKey('22222222222222222222222222222222'),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUseWallet = useWallet as vi.MockedFunction<typeof useWallet>;
const mockUseAdminRole = useAdminRole as vi.MockedFunction<typeof useAdminRole>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Admin Workflow End-to-End Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      isConnected: true,
      publicKey: new PublicKey('7KmgyD1WPmXvuKTrKLVmhZKeY27YR43riLdavFSjMgVS'),
      anchorProvider: {} as any,
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
    });
  });

  describe('Admin Access Control Flow', () => {
    it('should allow admin access and show appropriate dashboard', async () => {
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

      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Interface')).toBeInTheDocument();
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });

      // Should show admin-specific components
      expect(screen.getByText('Bucket Management')).toBeInTheDocument();
      expect(screen.getByText('User Credit Management')).toBeInTheDocument();
      expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
      
      // Should not show dev-only components
      expect(screen.queryByText('Configuration Management')).not.toBeInTheDocument();
    });

    it('should allow dev access and show full dashboard', async () => {
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

      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Interface')).toBeInTheDocument();
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });

      // Should show all components including dev-only
      expect(screen.getByText('Configuration Management')).toBeInTheDocument();
      expect(screen.getByText('Bucket Management')).toBeInTheDocument();
      expect(screen.getByText('User Credit Management')).toBeInTheDocument();
      expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
    });

    it('should restrict marketer access to limited dashboard', async () => {
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

      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Interface')).toBeInTheDocument();
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });

      // Should only show marketer dashboard
      expect(screen.getByText('Marketer Dashboard')).toBeInTheDocument();
      
      // Should not show admin components
      expect(screen.queryByText('Configuration Management')).not.toBeInTheDocument();
      expect(screen.queryByText('User Credit Management')).not.toBeInTheDocument();
      expect(screen.queryByText('Manual License Activation')).not.toBeInTheDocument();
    });

    it('should deny access to unauthorized users', async () => {
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

      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.getByText(/Your wallet address is not authorized/)).toBeInTheDocument();
      });
    });
  });

  describe('Manual License Activation Workflow', () => {
    beforeEach(() => {
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
    });

    it('should complete manual license activation for existing user', async () => {
      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
      });

      // Simulate user lookup
      const userInput = screen.getByPlaceholderText(/Enter wallet address/);
      fireEvent.change(userInput, { 
        target: { value: '11111111111111111111111111111112' } 
      });

      const lookupButton = screen.getByText('Lookup User');
      fireEvent.click(lookupButton);

      await waitFor(() => {
        expect(screen.getByText('License Activation')).toBeInTheDocument();
      });

      // Set duration
      const durationInput = screen.getByDisplayValue('30');
      fireEvent.change(durationInput, { target: { value: '60' } });

      // Activate license
      const activateButton = screen.getByText('Activate License');
      fireEvent.click(activateButton);

      await waitFor(() => {
        expect(screen.getByText(/License activated successfully/)).toBeInTheDocument();
      });
    });

    it('should handle new user registration during activation', async () => {
      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
      });

      // Simulate new user lookup
      const userInput = screen.getByPlaceholderText(/Enter wallet address/);
      fireEvent.change(userInput, { 
        target: { value: '22222222222222222222222222222222' } 
      });

      const lookupButton = screen.getByText('Lookup User');
      fireEvent.click(lookupButton);

      await waitFor(() => {
        expect(screen.getByText(/User not found/)).toBeInTheDocument();
        expect(screen.getByText(/Sponsor Address/)).toBeInTheDocument();
      });

      // Set sponsor for new user
      const sponsorInput = screen.getByPlaceholderText(/Enter sponsor address/);
      fireEvent.change(sponsorInput, { 
        target: { value: '33333333333333333333333333333333' } 
      });

      // Set duration
      const durationInput = screen.getByDisplayValue('30');
      fireEvent.change(durationInput, { target: { value: '90' } });

      // Activate license
      const activateButton = screen.getByText('Activate License');
      fireEvent.click(activateButton);

      await waitFor(() => {
        expect(screen.getByText(/User registered and license activated/)).toBeInTheDocument();
      });
    });
  });

  describe('Bucket Management Workflow', () => {
    beforeEach(() => {
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
    });

    it('should display bucket balances and allow withdrawal', async () => {
      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Bucket Management')).toBeInTheDocument();
      });

      // Should show accessible buckets
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Trader')).toBeInTheDocument();
      expect(screen.getByText('System Reserve')).toBeInTheDocument();

      // Should show balances
      expect(screen.getByText('1000 USDT')).toBeInTheDocument();
      expect(screen.getByText('250 USDT')).toBeInTheDocument();
      expect(screen.getByText('750 USDT')).toBeInTheDocument();

      // Test withdrawal
      const withdrawButton = screen.getAllByText('Withdraw')[0];
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(screen.getByText('Withdraw from Admin Bucket')).toBeInTheDocument();
      });

      const amountInput = screen.getByPlaceholderText(/Enter amount/);
      fireEvent.change(amountInput, { target: { value: '100' } });

      const confirmButton = screen.getByText('Confirm Withdrawal');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Withdrawal successful/)).toBeInTheDocument();
      });
    });
  });

  describe('User Credit Management Workflow', () => {
    beforeEach(() => {
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
    });

    it('should credit user balance', async () => {
      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('User Credit Management')).toBeInTheDocument();
      });

      // Lookup user
      const userInput = screen.getByPlaceholderText(/Enter wallet address/);
      fireEvent.change(userInput, { 
        target: { value: '11111111111111111111111111111112' } 
      });

      const lookupButton = screen.getByText('Lookup User');
      fireEvent.click(lookupButton);

      await waitFor(() => {
        expect(screen.getByText('Credit Operations')).toBeInTheDocument();
      });

      // Set credit amount
      const amountInput = screen.getByPlaceholderText(/Enter amount/);
      fireEvent.change(amountInput, { target: { value: '50' } });

      // Credit balance
      const creditButton = screen.getByText('Credit Balance');
      fireEvent.click(creditButton);

      await waitFor(() => {
        expect(screen.getByText(/Balance credited successfully/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Workflows', () => {
    beforeEach(() => {
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
    });

    it('should handle transaction failures gracefully', async () => {
      // Mock transaction failure
      const { getProgram } = require('@/lib/solairus-main');
      getProgram.mockReturnValue({
        methods: {
          activateLicenseManual: vi.fn(() => ({
            accounts: vi.fn(() => ({
              rpc: vi.fn(() => Promise.reject(new Error('Transaction failed'))),
            })),
          })),
        },
      });

      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
      });

      // Attempt activation that will fail
      const userInput = screen.getByPlaceholderText(/Enter wallet address/);
      fireEvent.change(userInput, { 
        target: { value: '11111111111111111111111111111112' } 
      });

      const lookupButton = screen.getByText('Lookup User');
      fireEvent.click(lookupButton);

      await waitFor(() => {
        const activateButton = screen.getByText('Activate License');
        fireEvent.click(activateButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Transaction failed/)).toBeInTheDocument();
      });
    });

    it('should validate form inputs', async () => {
      renderWithRouter(
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
      });

      // Try to activate without user lookup
      const activateButton = screen.getByText('Activate License');
      expect(activateButton).toBeDisabled();

      // Try invalid wallet address
      const userInput = screen.getByPlaceholderText(/Enter wallet address/);
      fireEvent.change(userInput, { target: { value: 'invalid-address' } });

      const lookupButton = screen.getByText('Lookup User');
      fireEvent.click(lookupButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid wallet address/)).toBeInTheDocument();
      });
    });
  });
});