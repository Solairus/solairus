import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { ManualLicenseActivation } from '../ManualLicenseActivation';
import { UserCreditManagement } from '../UserCreditManagement';
import { BucketManagement } from '../BucketManagement';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useBucketBalances } from '@/hooks/useBucketBalances';

// Mock dependencies
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: vi.fn(),
}));

vi.mock('@/hooks/useBucketBalances', () => ({
  useBucketBalances: vi.fn(),
}));

vi.mock('../UserLookup', () => ({
  UserLookup: ({ onUserFound, onError }: any) => (
    <div data-testid="user-lookup">
      <button onClick={() => onUserFound?.({ address: '11111111111111111111111111111112', exists: true })}>
        Mock User Found
      </button>
      <button onClick={() => onError?.('Network error')}>
        Mock Network Error
      </button>
      <button onClick={() => onError?.('Invalid address')}>
        Mock Invalid Address
      </button>
    </div>
  ),
}));

vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(),
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
const mockUseBucketBalances = useBucketBalances as vi.MockedFunction<typeof useBucketBalances>;

describe('Admin Error Scenarios Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      anchorProvider: {} as any,
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
    });

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

  describe('Manual License Activation Error Scenarios', () => {
    it('should handle contract transaction failures', async () => {
      const mockProgram = {
        methods: {
          activateLicenseManual: vi.fn(() => ({
            accounts: vi.fn(() => ({
              rpc: vi.fn(() => Promise.reject(new Error('Unauthorized'))),
            })),
          })),
        },
      };

      const { getProgram } = require('@/lib/solairus-main');
      getProgram.mockReturnValue(mockProgram);

      render(<ManualLicenseActivation />);

      // Find user and attempt activation
      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const activateButton = screen.getByText('Activate License');
        fireEvent.click(activateButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Transaction failed/)).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      render(<ManualLicenseActivation />);

      fireEvent.click(screen.getByText('Mock Network Error'));

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should handle invalid wallet addresses', async () => {
      render(<ManualLicenseActivation />);

      fireEvent.click(screen.getByText('Mock Invalid Address'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid address/)).toBeInTheDocument();
      });
    });

    it('should handle wallet disconnection during operation', async () => {
      render(<ManualLicenseActivation />);

      // Simulate wallet disconnection
      mockUseWallet.mockReturnValue({
        anchorProvider: null,
        publicKey: null,
        connected: false,
        connecting: false,
        disconnecting: true,
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

      // Re-render to trigger the wallet state change
      render(<ManualLicenseActivation />);

      await waitFor(() => {
        expect(screen.getByText(/Wallet not connected/)).toBeInTheDocument();
      });
    });

    it('should handle insufficient permissions error', async () => {
      const mockProgram = {
        methods: {
          activateLicenseManual: vi.fn(() => ({
            accounts: vi.fn(() => ({
              rpc: vi.fn(() => Promise.reject(new Error('Access denied'))),
            })),
          })),
        },
      };

      const { getProgram } = require('@/lib/solairus-main');
      getProgram.mockReturnValue(mockProgram);

      render(<ManualLicenseActivation />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const activateButton = screen.getByText('Activate License');
        fireEvent.click(activateButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Access denied/)).toBeInTheDocument();
      });
    });
  });

  describe('User Credit Management Error Scenarios', () => {
    it('should handle credit operation failures', async () => {
      const mockProgram = {
        methods: {
          creditUserBalance: vi.fn(() => ({
            accounts: vi.fn(() => ({
              rpc: vi.fn(() => Promise.reject(new Error('Insufficient funds'))),
            })),
          })),
        },
      };

      const { getProgram } = require('@/lib/solairus-main');
      getProgram.mockReturnValue(mockProgram);

      render(<UserCreditManagement />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText(/Enter amount/);
        fireEvent.change(amountInput, { target: { value: '100' } });

        const creditButton = screen.getByText('Credit Balance');
        fireEvent.click(creditButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Insufficient funds/)).toBeInTheDocument();
      });
    });

    it('should handle invalid amount inputs', async () => {
      render(<UserCreditManagement />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText(/Enter amount/);
        fireEvent.change(amountInput, { target: { value: '-100' } });

        expect(screen.getByText(/Amount must be positive/)).toBeInTheDocument();
      });
    });

    it('should handle zero amount inputs', async () => {
      render(<UserCreditManagement />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText(/Enter amount/);
        fireEvent.change(amountInput, { target: { value: '0' } });

        expect(screen.getByText(/Amount must be greater than zero/)).toBeInTheDocument();
      });
    });
  });

  describe('Bucket Management Error Scenarios', () => {
    it('should handle bucket balance loading errors', () => {
      mockUseBucketBalances.mockReturnValue({
        balances: null,
        loading: false,
        error: 'Failed to load bucket balances',
        refresh: vi.fn(),
      });

      render(<BucketManagement />);

      expect(screen.getByText(/Failed to load bucket balances/)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should handle withdrawal failures', async () => {
      const mockProgram = {
        methods: {
          withdrawSystemBucket: vi.fn(() => ({
            accounts: vi.fn(() => ({
              rpc: vi.fn(() => Promise.reject(new Error('Insufficient bucket balance'))),
            })),
          })),
        },
      };

      const { getProgram } = require('@/lib/solairus-main');
      getProgram.mockReturnValue(mockProgram);

      mockUseBucketBalances.mockReturnValue({
        balances: {
          admin: { toString: () => '1000000000' },
          trader: { toString: () => '250000000' },
          systemreserve: { toString: () => '750000000' },
        },
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<BucketManagement />);

      const withdrawButton = screen.getAllByText('Withdraw')[0];
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText(/Enter amount/);
        fireEvent.change(amountInput, { target: { value: '2000' } });

        const confirmButton = screen.getByText('Confirm Withdrawal');
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Insufficient bucket balance/)).toBeInTheDocument();
      });
    });

    it('should handle withdrawal amount exceeding balance', async () => {
      mockUseBucketBalances.mockReturnValue({
        balances: {
          admin: { toString: () => '1000000000' }, // 1000 USDT
          trader: { toString: () => '250000000' },
          systemreserve: { toString: () => '750000000' },
        },
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<BucketManagement />);

      const withdrawButton = screen.getAllByText('Withdraw')[0];
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText(/Enter amount/);
        fireEvent.change(amountInput, { target: { value: '1500' } }); // More than balance

        expect(screen.getByText(/Amount exceeds available balance/)).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Access Error Scenarios', () => {
    it('should handle role changes during session', async () => {
      render(<ManualLicenseActivation />);

      // Initially has access
      expect(screen.getByText('Manual License Activation')).toBeInTheDocument();

      // Simulate role change (e.g., admin privileges revoked)
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

      // Re-render to trigger role change
      render(<ManualLicenseActivation />);

      await waitFor(() => {
        expect(screen.getByText(/Access denied/)).toBeInTheDocument();
      });
    });

    it('should handle configuration changes during session', async () => {
      render(<ManualLicenseActivation />);

      // Initially configured
      expect(screen.getByText('Manual License Activation')).toBeInTheDocument();

      // Simulate configuration becoming invalid
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

      // Re-render to trigger configuration change
      render(<ManualLicenseActivation />);

      await waitFor(() => {
        expect(screen.getByText(/Configuration error/)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation Error Scenarios', () => {
    it('should validate required fields in manual activation', async () => {
      render(<ManualLicenseActivation />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        // Clear duration field
        const durationInput = screen.getByDisplayValue('30');
        fireEvent.change(durationInput, { target: { value: '' } });

        const activateButton = screen.getByText('Activate License');
        expect(activateButton).toBeDisabled();
      });
    });

    it('should validate duration limits', async () => {
      render(<ManualLicenseActivation />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const durationInput = screen.getByDisplayValue('30');
        fireEvent.change(durationInput, { target: { value: '0' } });

        expect(screen.getByText(/Duration must be at least 1 day/)).toBeInTheDocument();
      });
    });

    it('should validate maximum duration', async () => {
      render(<ManualLicenseActivation />);

      fireEvent.click(screen.getByText('Mock User Found'));

      await waitFor(() => {
        const durationInput = screen.getByDisplayValue('30');
        fireEvent.change(durationInput, { target: { value: '10000' } });

        expect(screen.getByText(/Duration cannot exceed 365 days/)).toBeInTheDocument();
      });
    });
  });
});