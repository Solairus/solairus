import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManualLicenseActivation } from '../ManualLicenseActivation';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';
import { PublicKey } from '@solana/web3.js';

// Mock the wallet context
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

// Mock the admin role hook
vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: vi.fn(),
}));

// Mock the UserLookup component
vi.mock('../UserLookup', () => ({
  UserLookup: ({ onUserFound }: any) => (
    <div data-testid="user-lookup">
      <div>User Lookup Component</div>
      <button 
        onClick={() => onUserFound?.({ 
          address: '11111111111111111111111111111112', 
          exists: true,
          licenseStatus: 'active',
          licenseExpiresAt: new Date('2024-12-31'),
          daysRemaining: 30,
          sponsor: new PublicKey('11111111111111111111111111111113')
        })}
      >
        Mock Existing User Found
      </button>
      <button 
        onClick={() => onUserFound?.({ 
          address: '11111111111111111111111111111114', 
          exists: false
        })}
      >
        Mock New User Found
      </button>
    </div>
  ),
}));

// Mock the solairus-main library
vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(() => ({
    methods: {
      activateLicenseManual: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(() => Promise.resolve('mock-tx-signature')),
        })),
      })),
    },
  })),
  derivePdas: vi.fn(() => ({ 
    config: new PublicKey('11111111111111111111111111111111'),
    profile: new PublicKey('22222222222222222222222222222222')
  })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUseWallet = useWallet as vi.MockedFunction<typeof useWallet>;
const mockUseAdminRole = useAdminRole as vi.MockedFunction<typeof useAdminRole>;

describe('ManualLicenseActivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      anchorProvider: {} as unknown,
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
      hasAccess: true,
      canAccessConfig: true,
      canManageUsers: true,
      canViewAllBuckets: true,
      accessibleBuckets: ['admin', 'trader', 'systemreserve'],
    });
  });

  it('renders the manual license activation interface', () => {
    render(<ManualLicenseActivation />);
    
    expect(screen.getByText('Manual License Activation')).toBeInTheDocument();
    expect(screen.getByText(/Manually activate user licenses without USDT payment/)).toBeInTheDocument();
    expect(screen.getByTestId('user-lookup')).toBeInTheDocument();
  });

  it('shows access denied for unauthorized users', () => {
    mockUseAdminRole.mockReturnValue({
      role: null,
      hasAccess: false,
      canAccessConfig: false,
      canManageUsers: false,
      canViewAllBuckets: false,
      accessibleBuckets: [],
    });

    render(<ManualLicenseActivation />);
    
    expect(screen.getByText(/Access denied/)).toBeInTheDocument();
    expect(screen.getByText(/Admin or dev privileges required/)).toBeInTheDocument();
  });

  it('displays activation form when user is found', async () => {
    render(<ManualLicenseActivation />);
    
    // Simulate finding an existing user
    fireEvent.click(screen.getByText('Mock Existing User Found'));
    
    await waitFor(() => {
      expect(screen.getByText('License Activation')).toBeInTheDocument();
      expect(screen.getByText('License Duration (Days)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Default duration
    });
  });

  it('shows extension option for users with active licenses', async () => {
    render(<ManualLicenseActivation />);
    
    // Simulate finding an existing user with active license
    fireEvent.click(screen.getByText('Mock Existing User Found'));
    
    await waitFor(() => {
      expect(screen.getByText('Extend existing license')).toBeInTheDocument();
    });
  });

  it('shows sponsor field for new users', async () => {
    render(<ManualLicenseActivation />);
    
    // Simulate finding a new user
    fireEvent.click(screen.getByText('Mock New User Found'));
    
    await waitFor(() => {
      expect(screen.getByText(/Sponsor Address/)).toBeInTheDocument();
      expect(screen.getByText(/Required for new users/)).toBeInTheDocument();
    });
  });

  it('validates form inputs correctly', async () => {
    render(<ManualLicenseActivation />);
    
    // Find a new user first
    fireEvent.click(screen.getByText('Mock New User Found'));
    
    await waitFor(() => {
      const activateButton = screen.getByRole('button', { name: /Activate License/ });
      expect(activateButton).toBeDisabled();
    });
  });

  it('enables activation button when form is valid', async () => {
    render(<ManualLicenseActivation />);
    
    // Find an existing user
    fireEvent.click(screen.getByText('Mock Existing User Found'));
    
    await waitFor(() => {
      const durationInput = screen.getByDisplayValue('30');
      fireEvent.change(durationInput, { target: { value: '60' } });
      
      const activateButton = screen.getByRole('button', { name: /Activate License/ });
      expect(activateButton).not.toBeDisabled();
    });
  });

  it('displays current license status correctly', async () => {
    render(<ManualLicenseActivation />);
    
    // Find an existing user with active license
    fireEvent.click(screen.getByText('Mock Existing User Found'));
    
    await waitFor(() => {
      expect(screen.getByText('Current License Status')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  it('shows auto-registration info for new users', async () => {
    render(<ManualLicenseActivation />);
    
    // Find a new user
    fireEvent.click(screen.getByText('Mock New User Found'));
    
    await waitFor(() => {
      expect(screen.getByText(/Auto-Registration/)).toBeInTheDocument();
      expect(screen.getByText(/automatically registered/)).toBeInTheDocument();
    });
  });

  it('displays instructions section', () => {
    render(<ManualLicenseActivation />);
    
    expect(screen.getByText('Instructions:')).toBeInTheDocument();
    expect(screen.getByText(/Enter a user wallet address to lookup/)).toBeInTheDocument();
    expect(screen.getByText(/Manual activations do not involve USDT payments/)).toBeInTheDocument();
  });
});