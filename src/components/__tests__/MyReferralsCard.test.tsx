import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import MyReferralsCard from '../MyReferralsCard';

// Mock the hooks and services
vi.mock('@/hooks/wallet/use-wallet-connection', () => ({
  useWalletConnection: () => ({
    account: '11111111111111111111111111111111'
  })
}));

vi.mock('@/contexts/wallet-context', () => ({
  useWallet: () => ({
    anchorProvider: {
      connection: {}
    }
  })
}));

vi.mock('@/lib/solairus-main', () => ({
  getProgram: vi.fn()
}));

vi.mock('@/services/admin/sponsor-management-service', () => ({
  getSponsorReferrals: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('MyReferralsCard', () => {
  const mockUserPublicKey = new PublicKey('11111111111111111111111111111111');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with zero referrals', () => {
    render(
      <MyReferralsCard 
        userPublicKey={mockUserPublicKey} 
        referralCount={0} 
      />
    );

    expect(screen.getByText('My Referrals')).toBeInTheDocument();
    expect(screen.getByText('No referrals yet')).toBeInTheDocument();
  });

  it('should render with referrals but no redundant count display', () => {
    render(
      <MyReferralsCard 
        userPublicKey={mockUserPublicKey} 
        referralCount={5} 
      />
    );

    expect(screen.getByText('My Referrals')).toBeInTheDocument();
    // Should NOT show the redundant count display
    expect(screen.queryByText('Total Referrals')).not.toBeInTheDocument();
    expect(screen.getByText('💡 Referral Benefits')).toBeInTheDocument();
  });

  it('should have load button', () => {
    render(
      <MyReferralsCard 
        userPublicKey={mockUserPublicKey} 
        referralCount={3} 
      />
    );

    const loadButton = screen.getByRole('button', { name: /load/i });
    expect(loadButton).toBeInTheDocument();
  });
});