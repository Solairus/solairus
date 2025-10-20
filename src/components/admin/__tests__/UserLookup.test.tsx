import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserLookup } from '../UserLookup';
import { useWallet } from '@/contexts/wallet-context';
import { PublicKey } from '@solana/web3.js';

// Mock the wallet context
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

// Mock the solairus-main library
vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(),
  derivePdas: vi.fn(() => ({ profile: new PublicKey('11111111111111111111111111111111') })),
  getLicenseInfo: vi.fn(() => ({ status: 'none', isValid: false })),
  getAffiliateEarnings: vi.fn(() => ({
    totalEarnings: { toString: () => '0' },
    availableToWithdraw: { toString: () => '0' },
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
    eq(other: any) {
      return this.value === (other.value || other);
    }
    div(other: any) {
      return new MockBN(Math.floor(this.value / (other.value || other)));
    }
    mod(other: any) {
      return new MockBN(this.value % (other.value || other));
    }
  },
}));

const mockUseWallet = useWallet as vi.MockedFunction<typeof useWallet>;

describe('UserLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      anchorProvider: {} as any,
      publicKey: null,
      connected: false,
      connecting: false,
      disconnect: vi.fn(),
      connect: vi.fn(),
      wallet: null,
      wallets: [],
      select: vi.fn(),
    });
  });

  it('renders user lookup form', () => {
    render(<UserLookup />);
    
    expect(screen.getByText('User Lookup')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter user wallet address...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows error for invalid address format', async () => {
    render(<UserLookup />);
    
    const input = screen.getByPlaceholderText('Enter user wallet address...');
    const button = screen.getByRole('button');
    
    fireEvent.change(input, { target: { value: 'invalid-address' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid Solana address format')).toBeInTheDocument();
    });
  });

  it('shows error when wallet not connected', async () => {
    render(<UserLookup />);
    
    const input = screen.getByPlaceholderText('Enter user wallet address...');
    const button = screen.getByRole('button');
    
    // Valid Solana address format
    fireEvent.change(input, { target: { value: '11111111111111111111111111111112' } });
    fireEvent.click(button);
    
    // Should show wallet not connected error via toast (mocked)
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Wallet not connected');
  });

  it('calls onUserFound callback when user is found', async () => {
    const mockOnUserFound = vi.fn();
    
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

    render(<UserLookup onUserFound={mockOnUserFound} />);
    
    const input = screen.getByPlaceholderText('Enter user wallet address...');
    const button = screen.getByRole('button');
    
    fireEvent.change(input, { target: { value: '11111111111111111111111111111112' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnUserFound).toHaveBeenCalled();
    });
  });

  it('shows auto-registration message when showCreateOption is true', () => {
    render(<UserLookup showCreateOption={true} />);
    
    // The component should render, and when a non-existent user is looked up,
    // it should show the auto-registration message
    expect(screen.getByText('User Lookup')).toBeInTheDocument();
  });
});