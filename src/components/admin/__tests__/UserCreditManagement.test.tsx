import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserCreditManagement } from '../UserCreditManagement';
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
  UserLookup: ({ onUserFound, showCreateOption }: any) => (
    <div data-testid="user-lookup">
      <div>User Lookup Component</div>
      <div>Show Create Option: {showCreateOption ? 'true' : 'false'}</div>
      <button 
        onClick={() => onUserFound?.({ 
          address: '11111111111111111111111111111112', 
          exists: true,
          balance: { toString: () => '100' }
        })}
      >
        Mock User Found
      </button>
    </div>
  ),
}));

// Mock the solairus-main library
vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(() => ({
    methods: {
      creditUserBalance: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn(() => Promise.resolve('mock-tx-signature')),
        })),
      })),
    },
  })),
  derivePdas: vi.fn(() => ({ 
    config: new PublicKey('11111111111111111111111111111111'),
    profile: new PublicKey('11111111111111111111111111111112'),
  })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock anchor
vi.mock('@coral-xyz/anchor', () => ({
  BN: class MockBN {
    constructor(value: number | string) {
      this.value = typeof value === 'string' ? parseInt(value) : value;
    }
    toString() {
      return this.value.toString();
    }
    neg() {
      return new MockBN(-this.value);
    }
  },
  web3: {
    SystemProgram: {
      programId: new PublicKey('11111111111111111111111111111111'),
    },
  },
}));

const mockUseWallet = useWallet as vi.MockedFunction<typeof useWallet>;
const mockUseAdminRole = useAdminRole as vi.MockedFunction<typeof useAdminRole>;

describe('UserCreditManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      anchorProvider: {
        connection: {},
        wallet: {},
        opts: {},
      } as any,
      publicKey: new PublicKey('11111111111111111111111111111111'),
      connected: true,
      connecting: false,
      disconnect: vi.fn(),
      connect: vi.fn(),
      wallet: null,
      wallets: [],
      select: vi.fn(),
    });

    mockUseAdminRole.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: true,
        canManageUsers: true,
        canViewAllBuckets: true,
        accessibleBuckets: ['admin', 'trader'],
      },
      hasAccess: true,
      isConfigured: true,
    });
  });

  it('renders user credit management interface', () => {
    render(<UserCreditManagement />);
    
    expect(screen.getByText('User Credit Management')).toBeInTheDocument();
    expect(screen.getByText('Credit or debit user balances. Auto-registration will create new users with dev as sponsor.')).toBeInTheDocument();
    expect(screen.getByTestId('user-lookup')).toBeInTheDocument();
  });

  it('shows access denied for unauthorized users', () => {
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

    render(<UserCreditManagement />);
    
    expect(screen.getByText('Access denied. Admin or dev privileges required.')).toBeInTheDocument();
  });

  it('shows credit operation form when user is found', async () => {
    render(<UserCreditManagement />);
    
    // Simulate user found
    const mockUserFoundButton = screen.getByText('Mock User Found');
    fireEvent.click(mockUserFoundButton);
    
    await waitFor(() => {
      expect(screen.getByText('Credit Operations')).toBeInTheDocument();
      expect(screen.getByText('Credit Balance')).toBeInTheDocument();
      expect(screen.getByText('Debit Balance')).toBeInTheDocument();
    });
  });

  it('validates amount input', async () => {
    render(<UserCreditManagement />);
    
    // Simulate user found
    const mockUserFoundButton = screen.getByText('Mock User Found');
    fireEvent.click(mockUserFoundButton);
    
    await waitFor(() => {
      const creditButton = screen.getByText('Credit Balance');
      expect(creditButton).toBeDisabled(); // Should be disabled without amount
    });
  });

  it('shows auto-registration message in UserLookup', () => {
    render(<UserCreditManagement />);
    
    expect(screen.getByText('Show Create Option: true')).toBeInTheDocument();
  });

  it('shows instructions section', () => {
    render(<UserCreditManagement />);
    
    expect(screen.getByText('Instructions:')).toBeInTheDocument();
    expect(screen.getByText('Enter a user wallet address to lookup their current balance and status')).toBeInTheDocument();
    expect(screen.getByText('Credit operations add USDT to the user\'s balance')).toBeInTheDocument();
    expect(screen.getByText('New users will be automatically registered with dev as their sponsor')).toBeInTheDocument();
  });
});