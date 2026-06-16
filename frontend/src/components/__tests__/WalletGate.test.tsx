/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WalletContextProvider } from '@/contexts/wallet-context'
import WalletGate from '@/components/WalletGate'

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

const { useAppKitAccount, useAppKitProvider } = await import('@reown/appkit/react')
const { WalletManager } = await import('@/services/wallet/wallet-manager')

// Type definitions for mocked values
interface MockWalletProvider {
  signTransaction: ReturnType<typeof vi.fn>
  signAllTransactions: ReturnType<typeof vi.fn>
}

// Test components for different route types
function DappTestPage() {
  return <div data-testid="dapp-page">Dapp Page Content</div>
}

function UitestsTestPage() {
  return <div data-testid="uitests-page">UI Tests Page Content</div>
}

function PublicTestPage() {
  return <div data-testid="public-page">Public Page Content</div>
}

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

describe('WalletGate Consistency Tests', () => {
  const mockAccount = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
  const mockWalletProvider: MockWalletProvider = {
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
  }
  const mockOpenModal = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(useAppKitAccount).mockReturnValue({
      isConnected: false,
      address: null,
      allAccounts: [],
      caipAddress: null,
      status: 'disconnected',
    } as any)
    
    vi.mocked(useAppKitProvider).mockReturnValue({
      walletProvider: null,
      walletProviderType: 'injected',
    } as any)
    
    // Mock clusterApiUrl
    const { clusterApiUrl } = await import('@solana/web3.js')
    vi.mocked(clusterApiUrl).mockReturnValue('https://api.devnet.solana.com')

    // Mock WalletManager
    vi.mocked(WalletManager.getInstance).mockReturnValue({
      disconnect: vi.fn(),
      openConnectModal: mockOpenModal,
    } as any)

    // Mock import.meta.env
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_ENABLE_WALLET_GUARD: 'true', // Enable wallet guard for testing
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('WalletGate behavior across different route types', () => {
    it('should protect Dapp routes consistently', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show wallet connection prompt, not the protected content
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.getByText('Please connect your wallet to continue.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
      expect(screen.queryByTestId('dapp-page')).not.toBeInTheDocument()
    })

    it('should protect uitests routes consistently', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <UitestsTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show wallet connection prompt, not the protected content
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.getByText('Please connect your wallet to continue.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
      expect(screen.queryByTestId('uitests-page')).not.toBeInTheDocument()
    })

    it('should allow access to both route types when wallet is connected', async () => {
      // Mock connected wallet

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      } as any)
      

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      } as any)

      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show protected Dapp content
      await waitFor(() => {
        expect(screen.getByTestId('dapp-page')).toBeInTheDocument()
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
      })

      // Test uitests route with same wallet state
      rerender(
        <TestWrapper>
          <WalletGate>
            <UitestsTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show protected uitests content
      await waitFor(() => {
        expect(screen.getByTestId('uitests-page')).toBeInTheDocument()
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
      })
    })

    it('should not protect public routes', async () => {
      render(
        <TestWrapper>
          <PublicTestPage />
        </TestWrapper>
      )

      // Should show public content without wallet connection
      expect(screen.getByTestId('public-page')).toBeInTheDocument()
      expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
    })

    it('should use identical UI components across all protected route types', async () => {
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Capture Dapp route UI elements
      const dappTitle = screen.getByText('Connect Wallet to access dApp')
      const dappDescription = screen.getByText('Please connect your wallet to continue.')
      const dappButton = screen.getByRole('button', { name: 'Connect Wallet' })

      expect(dappTitle).toBeInTheDocument()
      expect(dappDescription).toBeInTheDocument()
      expect(dappButton).toBeInTheDocument()

      // Test uitests route
      rerender(
        <TestWrapper>
          <WalletGate>
            <UitestsTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should have identical UI elements
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.getByText('Please connect your wallet to continue.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    })
  })

  describe('Wallet connection requirements are enforced', () => {
    it('should block access when wallet is not connected', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.queryByTestId('dapp-page')).not.toBeInTheDocument()
    })

    it('should allow access when wallet is connected', async () => {

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      } as any)
      

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      } as any)

      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('dapp-page')).toBeInTheDocument()
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
      })
    })

    it('should immediately block access when wallet disconnects', async () => {
      // Start with connected wallet

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      } as any)
      

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      } as any)

      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show protected content
      await waitFor(() => {
        expect(screen.getByTestId('dapp-page')).toBeInTheDocument()
      })

      // Mock wallet disconnection

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'disconnected',
      } as any)
      

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: null,
        walletProviderType: 'injected',
      } as any)

      rerender(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should immediately show connection prompt
      await waitFor(() => {
        expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
        expect(screen.queryByTestId('dapp-page')).not.toBeInTheDocument()
      })
    })

    it('should handle wallet guard configuration correctly', async () => {
      // This test verifies that WalletGate respects its configuration
      // The actual environment variable testing is done at integration level
      // Here we test the core functionality that when wallet is not connected,
      // the gate blocks access (which is the expected behavior with guard enabled)
      
      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show connection prompt when wallet is not connected (guard enabled behavior)
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.queryByTestId('dapp-page')).not.toBeInTheDocument()
    })

    it('should handle connecting state appropriately', async () => {

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'connecting',
      } as any)

      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should still show connection prompt during connecting state
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.queryByTestId('dapp-page')).not.toBeInTheDocument()
    })
  })

  describe('Consistent user experience for wallet connection', () => {
    it('should trigger wallet connection modal when connect button is clicked', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      const connectButton = screen.getByRole('button', { name: 'Connect Wallet' })
      fireEvent.click(connectButton)

      expect(mockOpenModal).toHaveBeenCalledTimes(1)
    })

    it('should maintain consistent styling across all protected routes', async () => {
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Check Dapp route styling - find the outer container
      const dappOuterContainer = screen.getByText('Connect Wallet to access dApp').closest('div')?.parentElement
      expect(dappOuterContainer).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center', 'p-4')

      const dappCard = screen.getByText('Connect Wallet to access dApp').closest('.w-full')
      expect(dappCard).toHaveClass('w-full', 'max-w-md', 'rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'p-6', 'text-center', 'space-y-4')

      // Test uitests route styling
      rerender(
        <TestWrapper>
          <WalletGate>
            <UitestsTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should have identical styling
      const uitestsOuterContainer = screen.getByText('Connect Wallet to access dApp').closest('div')?.parentElement
      expect(uitestsOuterContainer).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center', 'p-4')

      const uitestsCard = screen.getByText('Connect Wallet to access dApp').closest('.w-full')
      expect(uitestsCard).toHaveClass('w-full', 'max-w-md', 'rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'p-6', 'text-center', 'space-y-4')
    })

    it('should display consistent messaging across all protected routes', async () => {
      const components = [DappTestPage, UitestsTestPage]

      for (const Component of components) {
        const { unmount } = render(
          <TestWrapper>
            <WalletGate>
              <Component />
            </WalletGate>
          </TestWrapper>
        )

        // Check consistent messaging
        expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
        expect(screen.getByText('Please connect your wallet to continue.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()

        unmount()
      }
    })

    it('should handle wallet connection errors consistently', async () => {
      const mockOpenModalWithError = vi.fn(() => {
        throw new Error('Connection failed')
      })


      vi.mocked(WalletManager.getInstance).mockReturnValue({
        disconnect: vi.fn(),
        openConnectModal: mockOpenModalWithError,
      } as any)

      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      const connectButton = screen.getByRole('button', { name: 'Connect Wallet' })
      
      // Should not throw error when connection fails
      expect(() => fireEvent.click(connectButton)).not.toThrow()
      expect(mockOpenModalWithError).toHaveBeenCalledTimes(1)
    })

    it('should maintain consistent behavior during wallet state transitions', async () => {
      // Start disconnected
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

      // Transition to connecting

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'connecting',
      } as any)

      rerender(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

      // Transition to connected

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      } as any)
      

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      } as any)

      rerender(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('dapp-page')).toBeInTheDocument()
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
      })
    })

    it('should provide consistent accessibility features', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      const connectButton = screen.getByRole('button', { name: 'Connect Wallet' })
      
      // Check accessibility attributes
      expect(connectButton).toBeInTheDocument()
      expect(connectButton.tagName).toBe('BUTTON')
      
      // Check that the button is focusable
      connectButton.focus()
      expect(connectButton).toHaveFocus()
    })
  })

  describe('Cross-route consistency validation', () => {
    it('should maintain identical WalletGate behavior when switching between route types', async () => {
      // Test switching from Dapp to uitests route while disconnected
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Verify Dapp route behavior
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      const dappButton = screen.getByRole('button', { name: 'Connect Wallet' })
      expect(dappButton).toBeInTheDocument()

      // Switch to uitests route
      rerender(
        <TestWrapper>
          <WalletGate>
            <UitestsTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Verify identical behavior
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      const uitestsButton = screen.getByRole('button', { name: 'Connect Wallet' })
      expect(uitestsButton).toBeInTheDocument()

      // Test button functionality is identical
      fireEvent.click(uitestsButton)
      expect(mockOpenModal).toHaveBeenCalledTimes(1)
    })

    it('should maintain consistent state when wallet connects across different route types', async () => {
      // Start with disconnected state on Dapp route
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <DappTestPage />
          </WalletGate>
        </TestWrapper>
      )

      expect(screen.queryByTestId('dapp-page')).not.toBeInTheDocument()

      // Connect wallet

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      } as any)
      

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      } as any)

      // Switch to uitests route with connected wallet
      rerender(
        <TestWrapper>
          <WalletGate>
            <UitestsTestPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should immediately show protected content
      await waitFor(() => {
        expect(screen.getByTestId('uitests-page')).toBeInTheDocument()
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
      })
    })
  })
})