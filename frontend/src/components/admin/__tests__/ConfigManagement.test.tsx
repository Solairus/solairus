import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigManagement } from '../ConfigManagement';
import { useWallet } from '@/contexts/wallet-context';
import { useToast } from '@/hooks/use-toast';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

// Mock dependencies
vi.mock('@/contexts/wallet-context');
vi.mock('@/hooks/use-toast');
vi.mock('@/services/config/config-service');

const mockUseWallet = vi.mocked(useWallet);
const mockUseToast = vi.mocked(useToast);

// Mock config data
const mockConfig = {
  dev: new PublicKey('11111111111111111111111111111112'),
  admin: new PublicKey('11111111111111111111111111111113'),
  marketer1: new PublicKey('11111111111111111111111111111114'),
  marketer2: new PublicKey('11111111111111111111111111111115'),
  trader: new PublicKey('11111111111111111111111111111116'),
  systemreserve: new PublicKey('11111111111111111111111111111117'),
  usdtMint: new PublicKey('11111111111111111111111111111118'),
  activationFeeUsdt: new anchor.BN(100),
  roiDailyBps: 100,
  licenseDurationDays: 365,
  licenseAdminPct: 10,
  licenseDevPct: 20,
  licenseMarketer1Pct: 15,
  licenseMarketer2Pct: 15,
  licenseReservePct: 20,
  licenseAffL1Pct: 10,
  licenseAffL2Pct: 5,
  licenseAffL3Pct: 5,
  agentAdminPct: 15,
  agentDevPct: 25,
  agentMarketer1Pct: 10,
  agentMarketer2Pct: 10,
  agentTraderPct: 20,
  agentReservePct: 10,
  agentAffL1Pct: 5,
  agentAffL2Pct: 3,
  agentAffL3Pct: 2,
};

describe('ConfigManagement', () => {
  const mockToast = vi.fn();
  const mockAnchorProvider = {} as anchor.AnchorProvider;
  const mockPublicKey = new PublicKey('11111111111111111111111111111112');

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      publicKey: mockPublicKey,
      anchorProvider: mockAnchorProvider,
      account: null,
      chainId: null,
      balance: null,
      isConnecting: false,
      isConnected: true,
      isInitializing: false,
      provider: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
      switchNetwork: vi.fn(),
      formatAddress: vi.fn(),
      getChainInfo: vi.fn(),
      openConnectModal: vi.fn(),
      lastError: null,
      clearError: vi.fn(),
      signTransaction: null,
      signAllTransactions: null,
      refreshBalance: vi.fn(),
    });

    mockUseToast.mockReturnValue({
      toast: mockToast,
    });
  });

  it('renders configuration management interface', () => {
    render(<ConfigManagement />);
    
    expect(screen.getByText('System Configuration')).toBeInTheDocument();
    expect(screen.getByText('Manage system settings and parameters (Dev Only)')).toBeInTheDocument();
  });

  it('displays role addresses section', () => {
    render(<ConfigManagement />);
    
    expect(screen.getByText('Role Addresses')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Marketer1 Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Marketer2 Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Trader Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Systemreserve Address')).toBeInTheDocument();
  });

  it('displays system parameters section', () => {
    render(<ConfigManagement />);
    
    expect(screen.getByText('System Parameters')).toBeInTheDocument();
    expect(screen.getByLabelText('Activation Fee (USDT)')).toBeInTheDocument();
    expect(screen.getByLabelText('ROI Daily (BPS)')).toBeInTheDocument();
    expect(screen.getByLabelText('License Duration (Days)')).toBeInTheDocument();
  });

  it('displays license percentages section', () => {
    render(<ConfigManagement />);
    
    expect(screen.getByText('License Distribution Percentages')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin')).toBeInTheDocument();
    expect(screen.getByLabelText('Dev')).toBeInTheDocument();
  });

  it('displays agent percentages section', () => {
    render(<ConfigManagement />);
    
    expect(screen.getByText('Agent Distribution Percentages')).toBeInTheDocument();
  });

  it('shows validation error when percentages do not sum to 100', async () => {
    render(<ConfigManagement />);
    
    // Change a percentage value to make sum != 100
    const adminInput = screen.getByLabelText('Admin') as HTMLInputElement;
    fireEvent.change(adminInput, { target: { value: '50' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: expect.stringContaining('must sum to 100%'),
        variant: 'destructive',
      });
    });
  });

  it('disables save button when percentages are invalid', () => {
    render(<ConfigManagement />);
    
    const saveButton = screen.getByText('Save Changes');
    // Button should be disabled initially since percentages sum to 0
    expect(saveButton).toBeDisabled();
  });

  it('enables refresh button', () => {
    render(<ConfigManagement />);
    
    const refreshButton = screen.getByText('Refresh');
    expect(refreshButton).toBeEnabled();
  });

  it('handles role address input changes', () => {
    render(<ConfigManagement />);
    
    const adminInput = screen.getByLabelText('Admin Address') as HTMLInputElement;
    const testAddress = '11111111111111111111111111111112';
    
    fireEvent.change(adminInput, { target: { value: testAddress } });
    
    expect(adminInput.value).toBe(testAddress);
  });

  it('handles system parameter input changes', () => {
    render(<ConfigManagement />);
    
    const feeInput = screen.getByLabelText('Activation Fee (USDT)') as HTMLInputElement;
    fireEvent.change(feeInput, { target: { value: '200' } });
    
    expect(feeInput.value).toBe('200');
  });

  it('shows percentage totals in badges', () => {
    render(<ConfigManagement />);
    
    // Should show "Total: 0%" initially since all percentages start at 0
    const badges = screen.getAllByText(/Total: \d+%/);
    expect(badges).toHaveLength(2); // One for license, one for agent
  });

  it('renders without wallet connection', () => {
    mockUseWallet.mockReturnValue({
      publicKey: null,
      anchorProvider: null,
      account: null,
      chainId: null,
      balance: null,
      isConnecting: false,
      isConnected: false,
      isInitializing: false,
      provider: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
      switchNetwork: vi.fn(),
      formatAddress: vi.fn(),
      getChainInfo: vi.fn(),
      openConnectModal: vi.fn(),
      lastError: null,
      clearError: vi.fn(),
      signTransaction: null,
      signAllTransactions: null,
      refreshBalance: vi.fn(),
    });

    render(<ConfigManagement />);
    
    expect(screen.getByText('System Configuration')).toBeInTheDocument();
  });
});