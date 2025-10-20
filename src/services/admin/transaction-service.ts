import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';

/**
 * Transaction Status
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'finalized' | 'failed' | 'timeout';

/**
 * Transaction Result
 */
export interface TransactionResult {
  signature: string;
  status: TransactionStatus;
  confirmations?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Transaction Confirmation Options
 */
export interface TransactionConfirmationOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  commitment?: anchor.web3.Commitment;
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Transaction Service for managing blockchain transactions
 */
export class TransactionService {
  private connection: Connection;
  private defaultRetryConfig: RetryConfig;

  constructor(connection: Connection) {
    this.connection = connection;
    this.defaultRetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      backoffMultiplier: 2,
    };
  }

  /**
   * Execute a transaction with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.warn(`Transaction attempt ${attempt} failed:`, lastError.message);
        
        // Don't retry on the last attempt
        if (attempt === config.maxAttempts) {
          break;
        }

        // Don't retry certain types of errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        console.log(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${config.maxAttempts})`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Transaction failed after all retry attempts');
  }

  /**
   * Confirm a transaction with polling
   */
  async confirmTransaction(
    signature: TransactionSignature,
    options?: TransactionConfirmationOptions
  ): Promise<TransactionResult> {
    const {
      maxRetries = 30,
      retryDelay = 2000,
      timeout = 60000,
      commitment = 'confirmed',
    } = options || {};

    const startTime = Date.now();
    const timeoutTime = startTime + timeout;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check if we've exceeded the timeout
        if (Date.now() > timeoutTime) {
          return {
            signature,
            status: 'timeout',
            error: 'Transaction confirmation timed out',
            timestamp: new Date(),
          };
        }

        // Get transaction status
        const status = await this.connection.getSignatureStatus(signature);
        
        if (status.value === null) {
          // Transaction not found yet, continue polling
          await this.sleep(retryDelay);
          continue;
        }

        if (status.value.err) {
          return {
            signature,
            status: 'failed',
            error: `Transaction failed: ${JSON.stringify(status.value.err)}`,
            timestamp: new Date(),
          };
        }

        // Check confirmation level
        const confirmations = status.value.confirmations || 0;
        
        if (commitment === 'finalized' && confirmations >= 32) {
          return {
            signature,
            status: 'finalized',
            confirmations,
            timestamp: new Date(),
          };
        }

        if (commitment === 'confirmed' && confirmations >= 1) {
          return {
            signature,
            status: 'confirmed',
            confirmations,
            timestamp: new Date(),
          };
        }

        if (commitment === 'processed' && status.value.confirmations !== null) {
          return {
            signature,
            status: 'confirmed',
            confirmations,
            timestamp: new Date(),
          };
        }

        // Continue polling
        await this.sleep(retryDelay);
      } catch (error) {
        console.warn(`Error checking transaction status (attempt ${attempt + 1}):`, error);
        
        if (attempt === maxRetries - 1) {
          return {
            signature,
            status: 'failed',
            error: `Failed to confirm transaction: ${error}`,
            timestamp: new Date(),
          };
        }

        await this.sleep(retryDelay);
      }
    }

    return {
      signature,
      status: 'timeout',
      error: 'Maximum retry attempts exceeded',
      timestamp: new Date(),
    };
  }

  /**
   * Execute transaction and wait for confirmation
   */
  async executeAndConfirm<T>(
    operation: () => Promise<string>,
    confirmationOptions?: TransactionConfirmationOptions,
    retryConfig?: Partial<RetryConfig>
  ): Promise<{ signature: string; result: TransactionResult }> {
    // Execute the transaction with retry logic
    const signature = await this.executeWithRetry(operation, retryConfig);
    
    // Confirm the transaction
    const result = await this.confirmTransaction(signature, confirmationOptions);
    
    return { signature, result };
  }

  /**
   * Batch execute multiple transactions
   */
  async executeBatch(
    operations: Array<() => Promise<string>>,
    options?: {
      sequential?: boolean;
      confirmationOptions?: TransactionConfirmationOptions;
      retryConfig?: Partial<RetryConfig>;
    }
  ): Promise<Array<{ signature: string; result: TransactionResult }>> {
    const { sequential = false, confirmationOptions, retryConfig } = options || {};

    if (sequential) {
      // Execute transactions sequentially
      const results: Array<{ signature: string; result: TransactionResult }> = [];
      
      for (const operation of operations) {
        try {
          const result = await this.executeAndConfirm(operation, confirmationOptions, retryConfig);
          results.push(result);
        } catch (error) {
          console.error('Batch transaction failed:', error);
          results.push({
            signature: '',
            result: {
              signature: '',
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date(),
            },
          });
        }
      }
      
      return results;
    } else {
      // Execute transactions in parallel
      const promises = operations.map(operation =>
        this.executeAndConfirm(operation, confirmationOptions, retryConfig).catch(error => ({
          signature: '',
          result: {
            signature: '',
            status: 'failed' as TransactionStatus,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          },
        }))
      );

      return await Promise.all(promises);
    }
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(signature: TransactionSignature) {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        return null;
      }

      return {
        signature,
        slot: transaction.slot,
        blockTime: transaction.blockTime ? new Date(transaction.blockTime * 1000) : null,
        fee: transaction.meta?.fee || 0,
        success: transaction.meta?.err === null,
        error: transaction.meta?.err ? JSON.stringify(transaction.meta.err) : null,
        computeUnitsConsumed: transaction.meta?.computeUnitsConsumed || 0,
        logs: transaction.meta?.logMessages || [],
      };
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return null;
    }
  }

  /**
   * Check if an error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'Unauthorized',
      'InvalidAmount',
      'InsufficientFunds',
      'SponsorNotRegistered',
      'InvalidPercent',
      'InvalidConfigSum',
      'InvalidMint',
      'InvalidRemainingAccounts',
      'User rejected',
      'Transaction cancelled',
      'Insufficient SOL balance',
    ];

    return nonRetryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.defaultRetryConfig = { ...this.defaultRetryConfig, ...config };
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.defaultRetryConfig };
  }
}

/**
 * Transaction Manager for coordinating multiple services
 */
export class TransactionManager {
  private transactionService: TransactionService;
  private pendingTransactions: Map<string, TransactionResult> = new Map();

  constructor(connection: Connection) {
    this.transactionService = new TransactionService(connection);
  }

  /**
   * Execute a managed transaction
   */
  async execute<T>(
    operation: () => Promise<string>,
    options?: {
      id?: string;
      confirmationOptions?: TransactionConfirmationOptions;
      retryConfig?: Partial<RetryConfig>;
      onStatusUpdate?: (status: TransactionResult) => void;
    }
  ): Promise<TransactionResult> {
    const { id, confirmationOptions, retryConfig, onStatusUpdate } = options || {};
    const transactionId = id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Mark as pending
      const pendingResult: TransactionResult = {
        signature: '',
        status: 'pending',
        timestamp: new Date(),
      };
      
      this.pendingTransactions.set(transactionId, pendingResult);
      onStatusUpdate?.(pendingResult);

      // Execute and confirm
      const { signature, result } = await this.transactionService.executeAndConfirm(
        operation,
        confirmationOptions,
        retryConfig
      );

      // Update result
      const finalResult = { ...result, signature };
      this.pendingTransactions.set(transactionId, finalResult);
      onStatusUpdate?.(finalResult);

      return finalResult;
    } catch (error) {
      const errorResult: TransactionResult = {
        signature: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
      
      this.pendingTransactions.set(transactionId, errorResult);
      onStatusUpdate?.(errorResult);
      
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(id: string): TransactionResult | null {
    return this.pendingTransactions.get(id) || null;
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions(): Map<string, TransactionResult> {
    return new Map(this.pendingTransactions);
  }

  /**
   * Clear completed transactions
   */
  clearCompletedTransactions(): void {
    for (const [id, result] of this.pendingTransactions.entries()) {
      if (result.status !== 'pending') {
        this.pendingTransactions.delete(id);
      }
    }
  }

  /**
   * Get transaction service
   */
  getTransactionService(): TransactionService {
    return this.transactionService;
  }
}

/**
 * Create transaction service instance
 */
export function createTransactionService(connection: Connection): TransactionService {
  return new TransactionService(connection);
}

/**
 * Create transaction manager instance
 */
export function createTransactionManager(connection: Connection): TransactionManager {
  return new TransactionManager(connection);
}