/**
 * UserSponsorManagement Component Tests
 * 
 * Tests for the user sponsor management interface component
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { UserSponsorManagement } from '../UserSponsorManagement';

// Mock dependencies
vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(() => ({
    anchorProvider: {
      connection: {},
      wallet: {},
    },
    publicKey: new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
  })),
}));

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: vi.fn(() => ({
    hasAccess: true,
    role: 'admin',
  })),
}));

vi.mock('../UserLookup', () => ({
  UserLookup: vi.fn(() => (
    <div data-testid="user-lookup">
      User Lookup Component
    </div>
  )),
}));

vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn(() => ({
    methods: {
      updateUserProfile: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
        })),
      })),
    },
  })),
  derivePdas: vi.fn(() => ({
    config: new PublicKey('7YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
    profile: new PublicKey('8YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez'),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UserSponsorManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the component with proper title and description', () => {
    render(<UserSponsorManagement />);
    
    expect(screen.getByText('User Sponsor Management')).toBeInTheDocument();
    expect(screen.getByText(/Update user sponsor relationships/)).toBeInTheDocument();
  });

  it('should show access denied message for unauthorized users', async () => {
    const useAdminRoleMock = await import('@/hooks/useAdminRole');
    vi.mocked(useAdminRoleMock.useAdminRole).mockReturnValue({ hasAccess: false, role: null });

    render(<UserSponsorManagement />);
    
    expect(screen.getByText('Access denied. Admin or dev privileges required.')).toBeInTheDocument();
  });

  it('should render UserLookup component', () => {
    render(<UserSponsorManagement />);
    
    expect(screen.getByTestId('user-lookup')).toBeInTheDocument();
  });

  it('should display instructions section', () => {
    render(<UserSponsorManagement />);
    
    expect(screen.getByText('Instructions:')).toBeInTheDocument();
    expect(screen.getByText(/Enter a user wallet address to lookup/)).toBeInTheDocument();
    expect(screen.getByText(/Only existing registered users can have their sponsors updated/)).toBeInTheDocument();
    expect(screen.getByText(/Only admin and dev roles can perform sponsor updates/)).toBeInTheDocument();
  });

  it('should have proper component structure', () => {
    render(<UserSponsorManagement />);
    
    // Check for main sections
    expect(screen.getByText('User Sponsor Management')).toBeInTheDocument();
    expect(screen.getByText('User Lookup Component')).toBeInTheDocument();
    expect(screen.getByText('Instructions:')).toBeInTheDocument();
  });
});