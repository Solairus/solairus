import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WalletContextProvider, useWallet } from '@/contexts/wallet-context'
import WalletGate from '@/components/WalletGate'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

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

vi.mock('@coral-xyz/anchor', () => ({
  AnchorProvider: vi.fn(),
  web3: {
    Keypair: {
      generate: vi.fn(() => ({
        publicKey: { toBase58: () => '11111111111111111111111111111112' },
      })),
    },
  },
  BN: vi.fn(),
}))

const { useAppKitAccount, useAppKitProvider } = await import('@reown/appkit/react')
const { WalletManager } = await import('@/services/wallet/wallet-manager')

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

// Mock components that simulate different page types
function MockDappPage() {
  const { isConnected, account, anchorProvider, signTransaction, publicKey } = useWallet()
  return (
    <div data-testid="mock-dapp-page">
      <h1>Mock Dapp Page</h1>
      <div data-testid="connection-status">{isConnected ? 'Connected' : 'Not Connected'}</div>
      <div data-testid="account-info">{account || 'No Account'}</div>
      <div data-testid="public-key">{publicKey?.toBase58() || 'No Public Key'}</div>
      <div data-testid="anchor-provider">{anchorProvider ? 'Available' : 'Not Available'}</div>
      <div data-testid="sign-transaction">{signTransaction ? 'Available' : 'Not Available'}</div>
    </div>
  )
}

function MockUitestsPage() {
  const { isConnected, account, anchorProvider, signTransaction, publicKey, signAllTransactions } = useWallet()
  
  const handleSmartContractAction = async () => {
    if (signTransaction) {
      try {
        const mockTx = {} as Transaction
        await signTransaction(mockTx)
        console.log('Smart contract action completed')
      } catch (error) {
        console.error('Smart contract action failed:', error)
      }
    }
  }

  return (
    <div data-testid="mock-uitests-page">
      <h1>Mock UI Tests Page</h1>
      <div data-testid="connection-status">{isConnected ? 'Connected' : 'Not Connected'}</div>
      <div data-testid="account-info">{account || 'No Account'}</div>
      <div data-testid="public-key">{publicKey?.toBase58() || 'No Public Key'}</div>
      <div data-testid="anchor-provider">{anchorProvider ? 'Available' : 'Not Available'}</div>
      <div data-testid="sign-transaction">{signTransaction ? 'Available' : 'Not Available'}</div>
      <div data-testid="sign-all-transactions">{signAllTransactions ? 'Available' : 'Not Available'}</div>
      <button 
        data-testid="mock-smart-contract-action"
        onClick={handleSmartContractAction}
      >
        Mock Smart Contract Action
      </button>
    </div>
  )
}

describe('End-to-End Wallet Integration Tests', () => {
  const mockAccount = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
  const mockConnection = {
    getBalance: vi.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
  }
  const mockWalletProvider = {
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
  }
  const mockOpenModal = vi.fn()
  const mockDisconnect = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(useAppKitAccount).mockReturnValue({
      isConnected: false,
      address: null,
      allAccounts: [],
      caipAddress: null,
      status: 'disconnected',
    })
    
    vi.mocked(useAppKitProvider).mockReturnValue({
      walletProvider: null,
      walletProviderType: 'injected',
    })
    
    vi.mocked(Connection).mockImplementation(() => mockConnection as Connection)
    vi.mocked(anchor.AnchorProvider).mockImplementation(() => ({} as anchor.AnchorProvider))
    
    // Mock clusterApiUrl
    const { clusterApiUrl } = await import('@solana/web3.js')
    vi.mocked(clusterApiUrl).mockReturnValue('https://api.devnet.solana.com')

    // Mock WalletManager
    vi.mocked(WalletManager.getInstance).mockReturnValue({
      disconnect: mockDisconnect,
      openConnectModal: mockOpenModal,
    })

    // Mock environment variables
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_ENABLE_WALLET_GUARD: 'true',
        VITE_SOLANA_CLUSTER: 'devnet',
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete wallet connection flow across page types', () => {
    it('should handle complete connection flow from Dapp pages', async () => {
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show wallet connection prompt initially
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()

      // Click connect button
      const connectButton = screen.getByRole('button', { name: 'Connect Wallet' })
      fireEvent.click(connectButton)
      expect(mockOpenModal).toHaveBeenCalledTimes(1)

      // Simulate successful connection
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      // Re-render to reflect connection state change
      rerender(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should now show protected content
      await waitFor(() => {
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-dapp-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
        expect(screen.getByTestId('account-info')).toHaveTextContent(mockAccount)
      })
    })

    it('should handle complete connection flow from uitests pages', async () => {
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <MockUitestsPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show wallet connection prompt initially
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

      // Simulate successful connection
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      // Re-render to reflect connection state change
      rerender(
        <TestWrapper>
          <WalletGate>
            <MockUitestsPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should now show uitests page content
      await waitFor(() => {
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-uitests-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
        expect(screen.getByTestId('account-info')).toHaveTextContent(mockAccount)
      })
    })

    it('should maintain connection state when switching between page types', async () => {
      // Start with connected wallet
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      // Start with Dapp page
      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show Dapp content without connection prompt
      await waitFor(() => {
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-dapp-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
      })

      // Switch to uitests page
      rerender(
        <TestWrapper>
          <WalletGate>
            <MockUitestsPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show uitests content without connection prompt
      await waitFor(() => {
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-uitests-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
      })
    })

    it('should handle disconnection flow across all page types', async () => {
      // Start with connected wallet
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show protected content initially
      await waitFor(() => {
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-dapp-page')).toBeInTheDocument()
      })

      // Simulate wallet disconnection
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'disconnected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: null,
        walletProviderType: 'injected',
      })

      rerender(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should immediately show connection prompt
      await waitFor(() => {
        expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
        expect(screen.queryByTestId('mock-dapp-page')).not.toBeInTheDocument()
      })
    })
  })

  describe('Smart contract interactions from different pages', () => {
    beforeEach(() => {
      // Setup connected wallet for smart contract tests
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })
    })

    it('should enable smart contract interactions from Dapp pages', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show connected state with smart contract capabilities
      await waitFor(() => {
        expect(screen.getByTestId('mock-dapp-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
        expect(screen.getByTestId('anchor-provider')).toHaveTextContent('Available')
        expect(screen.getByTestId('sign-transaction')).toHaveTextContent('Available')
      })
    })

    it('should enable smart contract interactions from uitests pages', async () => {
      render(
        <TestWrapper>
          <WalletGate>
            <MockUitestsPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show connected state with smart contract capabilities
      await waitFor(() => {
        expect(screen.getByTestId('mock-uitests-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
        expect(screen.getByTestId('anchor-provider')).toHaveTextContent('Available')
        expect(screen.getByTestId('sign-transaction')).toHaveTextContent('Available')
        expect(screen.getByTestId('sign-all-transactions')).toHaveTextContent('Available')
      })

      // Should have smart contract interaction button
      expect(screen.getByTestId('mock-smart-contract-action')).toBeInTheDocument()
    })

    it('should handle transaction signing from uitests pages', async () => {
      const mockTransaction = {} as Transaction
      const mockSignedTransaction = {} as Transaction
      mockWalletProvider.signTransaction.mockResolvedValue(mockSignedTransaction)

      render(
        <TestWrapper>
          <WalletGate>
            <MockUitestsPage />
          </WalletGate>
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('mock-uitests-page')).toBeInTheDocument()
      })

      // Click smart contract action button
      const actionButton = screen.getByTestId('mock-smart-contract-action')
      fireEvent.click(actionButton)

      // Should have attempted to sign transaction
      await waitFor(() => {
        expect(mockWalletProvider.signTransaction).toHaveBeenCalled()
      })
    })

    it('should provide consistent wallet context across all page types', async () => {
      const pageTypes = [MockDappPage, MockUitestsPage]

      for (const PageComponent of pageTypes) {
        const { unmount } = render(
          <TestWrapper>
            <WalletGate>
              <PageComponent />
            </WalletGate>
          </TestWrapper>
        )

        // All pages should have access to wallet context without connection prompts
        await waitFor(() => {
          expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
          expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
          expect(screen.getByTestId('anchor-provider')).toHaveTextContent('Available')
        })

        unmount()
      }
    })
  })

  describe('Error scenarios and recovery across the application', () => {
    it('should handle wallet connection errors consistently across pages', async () => {
      // Mock connection error
      mockOpenModal.mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const pageTypes = [MockDappPage, MockUitestsPage]

      for (const PageComponent of pageTypes) {
        const { unmount } = render(
          <TestWrapper>
            <WalletGate>
              <PageComponent />
            </WalletGate>
          </TestWrapper>
        )

        // Should show connection prompt
        expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

        // Click connect button - should not crash on error
        const connectButton = screen.getByRole('button', { name: 'Connect Wallet' })
        expect(() => fireEvent.click(connectButton)).not.toThrow()

        // Should still show connection prompt after error
        expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

        unmount()
      }
    })

    it('should handle transaction signing errors consistently', async () => {
      const signingError = new Error('Transaction signing failed')
      mockWalletProvider.signTransaction.mockRejectedValue(signingError)

      // Setup connected wallet
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      render(
        <TestWrapper>
          <WalletGate>
            <MockUitestsPage />
          </WalletGate>
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('mock-uitests-page')).toBeInTheDocument()
      })

      // Click smart contract action button
      const actionButton = screen.getByTestId('mock-smart-contract-action')
      fireEvent.click(actionButton)

      // Should handle signing error gracefully
      await waitFor(() => {
        expect(mockWalletProvider.signTransaction).toHaveBeenCalled()
      })
    })

    it('should handle error recovery flows across the application', async () => {
      // Start with connection error
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'disconnected',
      })

      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show connection prompt
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

      // Simulate successful recovery (connection)
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      rerender(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should recover and show protected content
      await waitFor(() => {
        expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-dapp-page')).toBeInTheDocument()
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
      })
    })

    it('should maintain consistent error messaging across all page types', async () => {
      // Test with connection error state
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'disconnected',
      })

      const pageTypes = [MockDappPage, MockUitestsPage]

      for (const PageComponent of pageTypes) {
        const { unmount } = render(
          <TestWrapper>
            <WalletGate>
              <PageComponent />
            </WalletGate>
          </TestWrapper>
        )

        // Should show consistent error messaging
        expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()
        expect(screen.getByText('Please connect your wallet to continue.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Cross-page consistency validation', () => {
    it('should propagate wallet state changes across all page types immediately', async () => {
      // Start disconnected
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
        allAccounts: [],
        caipAddress: null,
        status: 'disconnected',
      })

      const { rerender } = render(
        <TestWrapper>
          <WalletGate>
            <MockDappPage />
          </WalletGate>
        </TestWrapper>
      )

      // Should show connection prompt
      expect(screen.getByText('Connect Wallet to access dApp')).toBeInTheDocument()

      // Simulate connection
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      // Test immediate propagation to different page types
      const pageTypes = [MockDappPage, MockUitestsPage]

      for (const PageComponent of pageTypes) {
        rerender(
          <TestWrapper>
            <WalletGate>
              <PageComponent />
            </WalletGate>
          </TestWrapper>
        )

        // Should immediately show connected state
        await waitFor(() => {
          expect(screen.queryByText('Connect Wallet to access dApp')).not.toBeInTheDocument()
          expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
        })
      }
    })

    it('should maintain identical wallet capabilities across page types', async () => {
      // Setup connected state
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
        allAccounts: [{ address: mockAccount, type: 'eoa' }],
        caipAddress: `solana:${mockAccount}`,
        status: 'connected',
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
        walletProviderType: 'injected',
      })

      const pageTypes = [MockDappPage, MockUitestsPage]

      for (const PageComponent of pageTypes) {
        const { unmount } = render(
          <TestWrapper>
            <WalletGate>
              <PageComponent />
            </WalletGate>
          </TestWrapper>
        )

        // All pages should have identical wallet capabilities
        await waitFor(() => {
          expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected')
          expect(screen.getByTestId('account-info')).toHaveTextContent(mockAccount)
          expect(screen.getByTestId('anchor-provider')).toHaveTextContent('Available')
          expect(screen.getByTestId('sign-transaction')).toHaveTextContent('Available')
        })

        unmount()
      }
    })
  })
})