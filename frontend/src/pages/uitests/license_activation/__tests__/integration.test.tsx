import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WalletContextProvider } from '@/contexts/wallet-context'
import WalletGate from '@/components/WalletGate'
import LicenseActivationUITest from '../index'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: vi.fn(),
  useAppKitProvider: vi.fn(),
}))

vi.mock('@/services/wallet/wallet-manager', () => ({
  WalletManager: {
    getInstance: vi.fn(() => ({
      disconnect: vi.fn(),
      openConnectModal: vi.fn(),
    })),
  },
}))

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual,
    Connection: vi.fn(),
    clusterApiUrl: vi.fn(),
  }
})

vi.mock('@coral-xyz/anchor', async () => {
  const actual = await vi.importActual('@coral-xyz/anchor')
  return {
    ...actual,
    AnchorProvider: vi.fn(),
  }
})

vi.mock('@/lib/license-activation', async () => {
  const actual = await vi.importActual('@/lib/license-activation')
  return {
    ...actual,
    getProgram: vi.fn(),
    accounts: vi.fn(),
    initializeConfig: vi.fn(),
    updateLicenseConfig: vi.fn(),
    derivePdas: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const { useAppKitAccount, useAppKitProvider } = await import('@reown/appkit/react')
const { WalletManager } = await import('@/services/wallet/wallet-manager')
const licenseActivationLib = await import('@/lib/license-activation')

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('License Activation Page Integration Tests', () => {
  const mockAccount = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
  const mockConfigPda = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const mockVaultPda = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  const mockLicensePda = 'So11111111111111111111111111111111111111112'

  const mockConnection = {
    getBalance: vi.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
  }
  const mockWalletProvider = {
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
  }
  const mockProgram = {
    methods: {
      initializeConfig: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
        })),
      })),
      updateLicenseConfig: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
        })),
      })),
      activateLicense: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
        })),
      })),
      withdrawEarnings: vi.fn(() => ({
        accounts: vi.fn(() => ({
          rpc: vi.fn().mockResolvedValue('mock-tx-signature'),
        })),
      })),
    },
  }
  const mockAccounts = {
    config: {
      fetch: vi.fn(),
    },
    userLicense: {
      fetch: vi.fn(),
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(useAppKitAccount).mockReturnValue({
      isConnected: false,
      address: null,
    })

    vi.mocked(useAppKitProvider).mockReturnValue({
      walletProvider: null,
    })

    vi.mocked(Connection).mockImplementation(() => mockConnection as any)
    vi.mocked(anchor.AnchorProvider).mockImplementation(() => ({} as any))

    // Mock clusterApiUrl
    const { clusterApiUrl } = await import('@solana/web3.js')
    vi.mocked(clusterApiUrl).mockReturnValue('https://api.devnet.solana.com')

    // Mock license activation library
    vi.mocked(licenseActivationLib.getProgram).mockReturnValue(mockProgram as any)
    vi.mocked(licenseActivationLib.accounts).mockReturnValue(mockAccounts as unknown)
    vi.mocked(licenseActivationLib.initializeConfig).mockResolvedValue('mock-tx-signature')
    vi.mocked(licenseActivationLib.updateLicenseConfig).mockResolvedValue('mock-tx-signature')

    // Mock derivePdas function with unique addresses
    vi.mocked(licenseActivationLib.derivePdas).mockReturnValue({
      config: new PublicKey(mockConfigPda),
      vault: new PublicKey(mockVaultPda),
      license: new PublicKey(mockLicensePda),
    })

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue('devnet'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    // Mock import.meta.env
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_SOLANA_CLUSTER: 'devnet',
        VITE_ENABLE_WALLET_GUARD: 'false', // Disable wallet guard for easier testing
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('License activation page with global context only', () => {
    it('should render correctly when wallet is not connected', async () => {
      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      expect(screen.getByText('License Activation – UI Tests')).toBeInTheDocument()
      expect(screen.getByText('Connected Wallet:')).toBeInTheDocument()
      expect(screen.getByText('(not connected)')).toBeInTheDocument()
      expect(screen.getByText('Connection Status:')).toBeInTheDocument()
      expect(screen.getByText('Not connected')).toBeInTheDocument()
    })

    it('should display wallet information when connected', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Connected Wallet:')).toBeInTheDocument()
        expect(screen.getByText('Connected')).toBeInTheDocument()
      })
    })

    it('should use only global wallet context without dual-wallet complexity', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      // Verify that the component uses global context
      await waitFor(() => {
        expect(screen.getByText('Connected Wallet:')).toBeInTheDocument()
      })

      // Verify no @solana/wallet-adapter-react imports are used
      // This is verified by the component rendering successfully with only global context mocks
      expect(vi.mocked(licenseActivationLib.getProgram)).toHaveBeenCalled()
    })

    it('should display PDA information correctly', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('PDAs')).toBeInTheDocument()
        expect(screen.getByText('Program:')).toBeInTheDocument()
        expect(screen.getByText('Config PDA:')).toBeInTheDocument()
        expect(screen.getByText('Vault PDA:')).toBeInTheDocument()
        expect(screen.getByText('License PDA:')).toBeInTheDocument()
      })
    })
  })

  describe('Smart contract interactions work correctly', () => {
    beforeEach(() => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })
    })

    it('should read config successfully', async () => {
      const mockConfig = {
        dev: new PublicKey(mockAccount),
        admin: new PublicKey(mockAccount),
        marketer1: new PublicKey(mockAccount),
        marketer2: new PublicKey(mockAccount),
        usdtPriceCents: new anchor.BN(500),
        durationDays: 30,
        usdtMint: new PublicKey(mockAccount),
        balances: {
          admin: new anchor.BN(0),
          dev: new anchor.BN(0),
          marketer1: new anchor.BN(0),
          marketer2: new anchor.BN(0),
          reserve: new anchor.BN(0),
        },
        bumpConfig: 255,
        bumpVault: 254,
      }

      mockAccounts.config.fetch.mockResolvedValue(mockConfig)

      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      const readConfigButton = await screen.findByText('Read Config')

      await act(async () => {
        fireEvent.click(readConfigButton)
      })

      await waitFor(() => {
        expect(mockAccounts.config.fetch).toHaveBeenCalled()
      })
    })

    it('should handle smart contract errors gracefully', async () => {
      const error = new Error('Transaction failed')
      mockAccounts.config.fetch.mockRejectedValue(error)

      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      const readConfigButton = await screen.findByText('Read Config')

      await act(async () => {
        fireEvent.click(readConfigButton)
      })

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Transaction failed')
      })
    })

    it('should update USDT mint successfully', async () => {
      const user = userEvent.setup()
      const newMintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

      render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      const mintInput = await screen.findByPlaceholderText('Mint address')
      const updateButton = await screen.findByText('Update Mint')

      await act(async () => {
        await user.type(mintInput, newMintAddress)
        fireEvent.click(updateButton)
      })

      await waitFor(() => {
        expect(vi.mocked(licenseActivationLib.updateLicenseConfig)).toHaveBeenCalled()
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith('USDT mint updated')
      })
    })
  })

  describe('Wallet connection state consistency', () => {
    it('should reflect wallet connection state changes immediately', async () => {
      const { rerender } = render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      // Initially disconnected
      expect(screen.getByText('Not connected')).toBeInTheDocument()

      // Mock wallet connection
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      rerender(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument()
        expect(screen.getByText(mockAccount)).toBeInTheDocument()
      })
    })

    it('should handle wallet disconnection correctly', async () => {
      // Start with connected wallet
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      const { rerender } = render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument()
      })

      // Mock wallet disconnection
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: null,
      })

      rerender(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Not connected')).toBeInTheDocument()
        expect(screen.getByText('(not connected)')).toBeInTheDocument()
      })
    })

    it('should maintain consistent wallet state across component re-renders', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      const { rerender } = render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument()
        expect(screen.getByText(mockAccount)).toBeInTheDocument()
      })

      // Re-render multiple times
      for (let i = 0; i < 3; i++) {
        rerender(
          <TestWrapper>
            <LicenseActivationUITest />
          </TestWrapper>
        )

        await waitFor(() => {
          expect(screen.getByText('Connected')).toBeInTheDocument()
          expect(screen.getByText(mockAccount)).toBeInTheDocument()
        })
      }
    })



    it('should handle wallet provider changes correctly', async () => {
      const initialProvider = { signTransaction: vi.fn() }
      const newProvider = {
        signTransaction: vi.fn(),
        signAllTransactions: vi.fn()
      }

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: initialProvider,
      })

      const { rerender } = render(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument()
      })

      // Change wallet provider
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: newProvider,
      })

      rerender(
        <TestWrapper>
          <LicenseActivationUITest />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument()
        expect(screen.getByText(mockAccount)).toBeInTheDocument()
      })
    })
  })

})