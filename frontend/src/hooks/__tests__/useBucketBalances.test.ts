import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBucketBalances } from '../useBucketBalances';
import { useWallet } from '@/contexts/wallet-context';
import { getProgram, derivePdas } from '@/lib/solairus-main';
import * as anchor from '@coral-xyz/anchor';

// Mock the dependencies
vi.mock('@/contexts/wallet-context');
vi.mock('@/lib/solairus-main');

const mockUseWallet = vi.mocked(useWallet);
const mockGetProgram = vi.mocked(getProgram);
const mockDerivePdas = vi.mocked(derivePdas);

describe('useBucketBalances', () => {
  const mockAnchorProvider = {} as anchor.AnchorProvider;
  const mockConfigPda = new anchor.web3.PublicKey('11111111111111111111111111111112');

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDerivePdas.mockReturnValue({
      config: mockConfigPda,
      vault: new anchor.web3.PublicKey('11111111111111111111111111111113'),
      profile: null,
      counter: null,
    });
  });

  it('should return error when wallet is not connected', async () => {
    mockUseWallet.mockReturnValue({
      anchorProvider: null,
      publicKey: null,
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

    const { result } = renderHook(() => useBucketBalances());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Wallet not connected');
    expect(result.current.balances).toBeNull();
  });

  it('should fetch bucket balances successfully', async () => {
    const mockConfigData = {
      bucketAdminUsdt: new anchor.BN(1000000000),
      bucketDevUsdt: new anchor.BN(500000000),
      bucketMarketer1Usdt: new anchor.BN(100000000),
      bucketMarketer2Usdt: new anchor.BN(200000000),
      bucketTraderUsdt: new anchor.BN(250000000),
      bucketSystemreserveUsdt: new anchor.BN(750000000),
    };

    const mockProgram = {
      account: {
        config: {
          fetch: vi.fn().mockResolvedValue(mockConfigData),
        },
      },
    };

    mockUseWallet.mockReturnValue({
      anchorProvider: mockAnchorProvider,
      publicKey: null,
      isConnected: true,
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

    mockGetProgram.mockReturnValue(mockProgram as any);

    const { result } = renderHook(() => useBucketBalances());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.balances).toEqual({
      admin: mockConfigData.bucketAdminUsdt,
      dev: mockConfigData.bucketDevUsdt,
      marketer1: mockConfigData.bucketMarketer1Usdt,
      marketer2: mockConfigData.bucketMarketer2Usdt,
      trader: mockConfigData.bucketTraderUsdt,
      systemreserve: mockConfigData.bucketSystemreserveUsdt,
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const mockProgram = {
      account: {
        config: {
          fetch: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      },
    };

    mockUseWallet.mockReturnValue({
      anchorProvider: mockAnchorProvider,
      publicKey: null,
      isConnected: true,
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

    mockGetProgram.mockReturnValue(mockProgram as any);

    const { result } = renderHook(() => useBucketBalances());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.balances).toBeNull();
  });
});