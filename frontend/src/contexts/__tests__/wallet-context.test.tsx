import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { WalletContextProvider, useWallet } from '../wallet-context'
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
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
}))

const { useAppKitAccount, useAppKitProvider } = await import('@reown/appkit/react')
const { WalletManager } = await import('@/services/wallet/wallet-manager')

// Test component to access wallet context
function TestComponent() {
  const wallet = useWallet()
  return (
    <div>
      <div data-testid="account">{wallet.account || 'null'}</div>
      <div data-testid="isConnected">{wallet.isConnected.toString()}</div>
      <div data-testid="balance">{wallet.balance || 'null'}</div>
      <div data-testid="publicKey">{wallet.publicKey?.toString() || 'null'}</div>
      <div data-testid="anchorProvider">{wallet.anchorProvider ? 'present' : 'null'}</div>
      <div data-testid="signTransaction">{wallet.signTransaction ? 'available' : 'null'}</div>
      <div data-testid="signAllTransactions">{wallet.signAllTransactions ? 'available' : 'null'}</div>
    </div>
  )
}

describe('WalletContext', () => {
  const mockAccount = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
  const mockConnection = {
    getBalance: vi.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
  }
  const mockWalletProvider = {
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Anchor provider creation with different wallet states', () => {
    it('should create Anchor provider when wallet is connected with signing capabilities', async () => {
      // Mock connected wallet with signing capabilities
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      render(
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('account')).toHaveTextContent(mockAccount)
        expect(screen.getByTestId('isConnected')).toHaveTextContent('true')
        expect(screen.getByTestId('anchorProvider')).toHaveTextContent('present')
      })

      // Verify Anchor provider was created with correct parameters
      expect(anchor.AnchorProvider).toHaveBeenCalledWith(
        expect.any(Object), // connection
        expect.objectContaining({
          publicKey: expect.any(PublicKey),
          signTransaction: expect.any(Function),
          signAllTransactions: expect.any(Function),
        }),
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      )
    })

    it('should not create Anchor provider when wallet provider is null', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: null,
      })

      render(
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('account')).toHaveTextContent(mockAccount)
        expect(screen.getByTestId('isConnected')).toHaveTextContent('true')
        expect(screen.getByTestId('anchorProvider')).toHaveTextContent('null')
      })

      expect(anchor.AnchorProvider).not.toHaveBeenCalled()
    })

    it('should handle Anchor provider creation failure gracefully', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      // Mock Anchor provider constructor to throw error
      vi.mocked(anchor.AnchorProvider).mockImplementation(() => {
        throw new Error('Failed to create provider')
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('account')).toHaveTextContent(mockAccount)
        expect(screen.getByTestId('isConnected')).toHaveTextContent('true')
        expect(screen.getByTestId('anchorProvider')).toHaveTextContent('null')
      })

      expect(consoleSpy).toHaveBeenCalledWith('Failed to create Anchor provider:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('should create fallback signAllTransactions when wallet only supports signTransaction', async () => {
      const walletProviderWithoutBatch = {
        signTransaction: vi.fn().mockResolvedValue({} as Transaction),
      }

      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: walletProviderWithoutBatch,
      })

      render(
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('anchorProvider')).toHaveTextContent('present')
      })

      // Verify that the anchor wallet was created with a fallback signAllTransactions
      const anchorProviderCall = vi.mocked(anchor.AnchorProvider).mock.calls[0]
      const anchorWallet = anchorProviderCall[1]
      
      expect(anchorWallet.signAllTransactions).toBeDefined()
      expect(typeof anchorWallet.signAllTransactions).toBe('function')
    })
  })

  describe('Transaction signing method implementations', () => {
    beforeEach(() => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })
      
      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })
    })

    it('should sign single transaction successfully', async () => {
      const mockTransaction = {} as Transaction
      const mockSignedTransaction = {} as Transaction
      mockWalletProvider.signTransaction.mockResolvedValue(mockSignedTransaction)

      let walletContext: any
      function TestSignTransaction() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestSignTransaction />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeTruthy()
      })

      const result = await walletContext.signTransaction(mockTransaction)

      expect(mockWalletProvider.signTransaction).toHaveBeenCalledWith(mockTransaction)
      expect(result).toBe(mockSignedTransaction)
    })

    it('should sign multiple transactions successfully', async () => {
      const mockTransactions = [{} as Transaction, {} as Transaction]
      const mockSignedTransactions = [{} as Transaction, {} as Transaction]
      mockWalletProvider.signAllTransactions.mockResolvedValue(mockSignedTransactions)

      let walletContext: any
      function TestSignAllTransactions() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestSignAllTransactions />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signAllTransactions).toBeTruthy()
      })

      const result = await walletContext.signAllTransactions(mockTransactions)

      expect(mockWalletProvider.signAllTransactions).toHaveBeenCalledWith(mockTransactions)
      expect(result).toBe(mockSignedTransactions)
    })

    it('should fallback to individual signing when signAllTransactions is not available', async () => {
      const walletProviderWithoutBatch = {
        signTransaction: vi.fn().mockResolvedValue({} as Transaction),
      }

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: walletProviderWithoutBatch,
      })

      const mockTransactions = [{} as Transaction, {} as Transaction]

      let walletContext: any
      function TestFallbackSigning() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestFallbackSigning />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signAllTransactions).toBeTruthy()
      })

      await walletContext.signAllTransactions(mockTransactions)

      expect(walletProviderWithoutBatch.signTransaction).toHaveBeenCalledTimes(2)
      expect(walletProviderWithoutBatch.signTransaction).toHaveBeenNthCalledWith(1, mockTransactions[0])
      expect(walletProviderWithoutBatch.signTransaction).toHaveBeenNthCalledWith(2, mockTransactions[1])
    })

    it('should handle VersionedTransaction signing', async () => {
      const mockVersionedTransaction = {} as VersionedTransaction
      const mockSignedVersionedTransaction = {} as VersionedTransaction
      mockWalletProvider.signTransaction.mockResolvedValue(mockSignedVersionedTransaction)

      let walletContext: any
      function TestVersionedTransaction() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestVersionedTransaction />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeTruthy()
      })

      const result = await walletContext.signTransaction(mockVersionedTransaction)

      expect(mockWalletProvider.signTransaction).toHaveBeenCalledWith(mockVersionedTransaction)
      expect(result).toBe(mockSignedVersionedTransaction)
    })
  })

  describe('Error handling for smart contract operations', () => {
    beforeEach(() => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })
    })

    it('should throw error when wallet is not connected for transaction signing', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: false,
        address: null,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: null,
      })

      let walletContext: any
      function TestDisconnectedWallet() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestDisconnectedWallet />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeNull()
        expect(walletContext.signAllTransactions).toBeNull()
      })
    })

    it('should throw error when wallet provider does not support signing', async () => {
      const walletProviderWithoutSigning = {}

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: walletProviderWithoutSigning,
      })

      let walletContext: any
      function TestUnsupportedWallet() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestUnsupportedWallet />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeTruthy()
      })

      const mockTransaction = {} as Transaction

      await expect(walletContext.signTransaction(mockTransaction)).rejects.toThrow(
        'Wallet not connected or does not support transaction signing'
      )
    })

    it('should handle transaction signing errors and set lastError', async () => {
      const signingError = new Error('Transaction signing failed')
      mockWalletProvider.signTransaction.mockRejectedValue(signingError)

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      let walletContext: any
      function TestSigningError() {
        walletContext = useWallet()
        return <div data-testid="error">{walletContext.lastError?.message || 'null'}</div>
      }

      render(
        <WalletContextProvider>
          <TestSigningError />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeTruthy()
      })

      const mockTransaction = {} as Transaction

      await expect(walletContext.signTransaction(mockTransaction)).rejects.toThrow(signingError)

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Transaction signing failed')
      })
    })

    it('should handle batch transaction signing errors and set lastError', async () => {
      const signingError = new Error('Batch signing failed')
      mockWalletProvider.signAllTransactions.mockRejectedValue(signingError)

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      let walletContext: any
      function TestBatchSigningError() {
        walletContext = useWallet()
        return <div data-testid="error">{walletContext.lastError?.message || 'null'}</div>
      }

      render(
        <WalletContextProvider>
          <TestBatchSigningError />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signAllTransactions).toBeTruthy()
      })

      const mockTransactions = [{} as Transaction, {} as Transaction]

      await expect(walletContext.signAllTransactions(mockTransactions)).rejects.toThrow(signingError)

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Batch signing failed')
      })
    })

    it('should throw specific error when wallet does not support transaction signing', async () => {
      const walletProviderWithoutSignTransaction = {
        signAllTransactions: vi.fn(),
      }

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: walletProviderWithoutSignTransaction,
      })

      let walletContext: any
      function TestNoSignTransaction() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestNoSignTransaction />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeTruthy()
      })

      const mockTransaction = {} as Transaction

      await expect(walletContext.signTransaction(mockTransaction)).rejects.toThrow(
        'Wallet not connected or does not support transaction signing'
      )
    })

    it('should throw error for batch signing when wallet does not support any signing method', async () => {
      const walletProviderWithoutSigning = {}

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: walletProviderWithoutSigning,
      })

      let walletContext: any
      function TestNoSigning() {
        walletContext = useWallet()
        return <div>Test</div>
      }

      render(
        <WalletContextProvider>
          <TestNoSigning />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signAllTransactions).toBeTruthy()
      })

      const mockTransactions = [{} as Transaction]

      await expect(walletContext.signAllTransactions(mockTransactions)).rejects.toThrow(
        'Wallet does not support transaction signing'
      )
    })

    it('should clear error when clearError is called', async () => {
      const signingError = new Error('Test error')
      mockWalletProvider.signTransaction.mockRejectedValue(signingError)

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      let walletContext: unknown
      function TestClearError() {
        walletContext = useWallet()
        return (
          <div>
            <div data-testid="error">{walletContext.lastError?.message || 'null'}</div>
            <button onClick={walletContext.clearError} data-testid="clear-error">
              Clear Error
            </button>
          </div>
        )
      }

      render(
        <WalletContextProvider>
          <TestClearError />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(walletContext.signTransaction).toBeTruthy()
      })

      // Trigger an error
      const mockTransaction = {} as Transaction
      await expect(walletContext.signTransaction(mockTransaction)).rejects.toThrow()

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Test error')
      })

      // Clear the error
      act(() => {
        screen.getByTestId('clear-error').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('null')
      })
    })
  })

  describe('Wallet state management', () => {
    it('should update balance when account and provider are available', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      render(
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('balance')).toHaveTextContent('1')
        expect(mockConnection.getBalance).toHaveBeenCalledWith(expect.any(PublicKey))
      })
    })

    it('should set public key when wallet is connected', async () => {
      vi.mocked(useAppKitAccount).mockReturnValue({
        isConnected: true,
        address: mockAccount,
      })

      vi.mocked(useAppKitProvider).mockReturnValue({
        walletProvider: mockWalletProvider,
      })

      render(
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('publicKey')).toHaveTextContent(mockAccount)
      })
    })

    it('should provide fallback context when used outside provider', () => {
      render(<TestComponent />)

      expect(screen.getByTestId('account')).toHaveTextContent('null')
      expect(screen.getByTestId('isConnected')).toHaveTextContent('false')
      expect(screen.getByTestId('balance')).toHaveTextContent('null')
      expect(screen.getByTestId('publicKey')).toHaveTextContent('null')
      expect(screen.getByTestId('anchorProvider')).toHaveTextContent('null')
      expect(screen.getByTestId('signTransaction')).toHaveTextContent('null')
      expect(screen.getByTestId('signAllTransactions')).toHaveTextContent('null')
    })
  })
})