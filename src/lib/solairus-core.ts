import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import idl from "@/idl/solairus_core.json";

// Core helpers for Solairus Core UI tests using the solairus_core IDL directly.

// Resolve program address from IDL (root.address preferred per project rules)
const coreIdl = idl as unknown as { address?: string; metadata?: { address?: string } };
export const PROGRAM_ID = new PublicKey(
  (coreIdl.address ?? coreIdl.metadata?.address ?? "")
);

// Error codes for programmatic error handling
export const ERROR_CODES = {
  // IDL Processing Errors
  MISSING_ADDRESS_FIELD: 'MISSING_ADDRESS_FIELD',
  INVALID_TYPE_FORMAT: 'INVALID_TYPE_FORMAT',
  MALFORMED_ACCOUNT: 'MALFORMED_ACCOUNT',
  MISSING_INSTRUCTION: 'MISSING_INSTRUCTION',
  INCOMPATIBLE_VERSION: 'INCOMPATIBLE_VERSION',
  IDL_VALIDATION_FAILED: 'IDL_VALIDATION_FAILED',
  
  // Program Initialization Errors
  PROGRAM_CREATION_FAILED: 'PROGRAM_CREATION_FAILED',
  PROGRAM_VALIDATION_FAILED: 'PROGRAM_VALIDATION_FAILED',
  
  // Method and Account Validation Errors
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  ACCOUNT_VALIDATION_FAILED: 'ACCOUNT_VALIDATION_FAILED',
  
  // Transaction Execution Errors
  TRANSACTION_BUILD_FAILED: 'TRANSACTION_BUILD_FAILED',
  
  // Network and Wallet Errors
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  WALLET_CONNECTION_FAILED: 'WALLET_CONNECTION_FAILED',
  
  // Balance Errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// IDL processing error types for better error handling
class IDLProcessingError extends Error {
  constructor(message: string, public step: string, public code?: ErrorCode) {
    super(message);
    this.name = 'IDLProcessingError';
    this.code = code;
  }
}

class IDLValidationError extends Error {
  constructor(message: string, public field: string, public code: ErrorCode) {
    super(message);
    this.name = 'IDLValidationError';
  }
}

// Specific IDL error types for different failure scenarios
class IDLMissingAddressError extends IDLProcessingError {
  constructor() {
    super(
      'IDL missing address field. Add "address" field to root level or ensure "metadata.address" exists.',
      'addRootAddressField',
      ERROR_CODES.MISSING_ADDRESS_FIELD
    );
    this.name = 'IDLMissingAddressError';
  }
  
  getSuggestedFix(): string {
    return 'Add the program address to your IDL:\n' +
           '1. Add "address": "YourProgramId" to the root level of the IDL, or\n' +
           '2. Ensure "metadata.address" contains the program address\n' +
           'Example: {"version": "0.1.0", "name": "program", "address": "YourProgramId", ...}';
  }
}

class IDLInvalidTypeError extends IDLProcessingError {
  constructor(typeName: string, expectedFormat: string) {
    super(
      `Invalid type format for "${typeName}". Expected: ${expectedFormat}`,
      'fixTypeCompatibility',
      ERROR_CODES.INVALID_TYPE_FORMAT
    );
    this.name = 'IDLInvalidTypeError';
  }
  
  getSuggestedFix(): string {
    return 'Fix type compatibility issues:\n' +
           '1. Replace "publicKey" with "pubkey" in all type definitions\n' +
           '2. Ensure all type references use Anchor v0.32.1 format\n' +
           '3. Check nested type structures for compatibility';
  }
}

class IDLMalformedAccountError extends IDLProcessingError {
  constructor(accountName: string, issue: string) {
    super(
      `Malformed account "${accountName}": ${issue}`,
      'validateIDLStructure',
      ERROR_CODES.MALFORMED_ACCOUNT
    );
    this.name = 'IDLMalformedAccountError';
  }
  
  getSuggestedFix(): string {
    return 'Fix account structure issues:\n' +
           '1. Ensure all accounts have "name", "isMut", and "isSigner" fields\n' +
           '2. Verify account type definitions are properly structured\n' +
           '3. Check that struct fields are correctly defined';
  }
}

class IDLMissingInstructionError extends IDLProcessingError {
  constructor(instructionName: string) {
    super(
      `Missing or malformed instruction "${instructionName}"`,
      'validateIDLStructure',
      ERROR_CODES.MISSING_INSTRUCTION
    );
    this.name = 'IDLMissingInstructionError';
  }
  
  getSuggestedFix(): string {
    return 'Fix instruction definition issues:\n' +
           '1. Ensure all instructions have "name", "accounts", and "args" fields\n' +
           '2. Verify instruction accounts are properly defined\n' +
           '3. Check that instruction arguments have correct types';
  }
}

class IDLIncompatibleVersionError extends IDLProcessingError {
  constructor(version: string) {
    super(
      `IDL version "${version}" may not be compatible with Anchor v0.32.1`,
      'processIDLForAnchor',
      ERROR_CODES.INCOMPATIBLE_VERSION
    );
    this.name = 'IDLIncompatibleVersionError';
  }
  
  getSuggestedFix(): string {
    return 'Update IDL for Anchor v0.32.1 compatibility:\n' +
           '1. Regenerate IDL with Anchor v0.32.1 or later\n' +
           '2. Ensure all type definitions use the new format\n' +
           '3. Verify program address is included in IDL';
  }
}

class ProgramCreationError extends IDLProcessingError {
  public underlyingError?: Error;
  
  constructor(message: string, cause?: Error) {
    super(
      `Program creation failed: ${message}`,
      'validateProgramCreation',
      ERROR_CODES.PROGRAM_CREATION_FAILED
    );
    this.name = 'ProgramCreationError';
    this.underlyingError = cause;
  }
  
  getSuggestedFix(): string {
    return 'Fix program creation issues:\n' +
           '1. Verify processed IDL structure is valid for Anchor v0.32.1\n' +
           '2. Check that program address matches deployed program\n' +
           '3. Ensure provider connection is properly configured\n' +
           '4. Validate IDL contains all required fields and proper structure';
  }
}

class ProgramValidationError extends IDLProcessingError {
  constructor(message: string, validationStep: string) {
    super(
      `Program validation failed: ${message}`,
      validationStep,
      ERROR_CODES.PROGRAM_VALIDATION_FAILED
    );
    this.name = 'ProgramValidationError';
  }
  
  getSuggestedFix(): string {
    return 'Fix program validation issues:\n' +
           '1. Ensure program is properly deployed to the network\n' +
           '2. Verify program address matches IDL address field\n' +
           '3. Check that program methods are accessible\n' +
           '4. Validate program account structure matches IDL';
  }
}

// Additional specific error types for comprehensive error handling
class MethodNotFoundError extends IDLProcessingError {
  constructor(methodName: string, availableMethods: string[]) {
    super(
      `Method "${methodName}" not found in program`,
      'validateMethodExists',
      ERROR_CODES.METHOD_NOT_FOUND
    );
    this.name = 'MethodNotFoundError';
    this.availableMethods = availableMethods;
  }
  
  public availableMethods: string[];
  
  getSuggestedFix(): string {
    const suggestions = this.availableMethods.length > 0 
      ? `Available methods: ${this.availableMethods.join(', ')}`
      : 'No methods available in program';
    
    return `Method not found error resolution:\n` +
           `1. Check method name spelling and case sensitivity\n` +
           `2. Verify method exists in the program IDL\n` +
           `3. ${suggestions}\n` +
           `4. Regenerate IDL if method was recently added to program`;
  }
}

class AccountValidationError extends IDLProcessingError {
  constructor(accountName: string, issue: string, accountAddress?: string) {
    super(
      `Account validation failed for "${accountName}": ${issue}`,
      'validateAccounts',
      ERROR_CODES.ACCOUNT_VALIDATION_FAILED
    );
    this.name = 'AccountValidationError';
    this.accountName = accountName;
    this.accountAddress = accountAddress;
  }
  
  public accountName: string;
  public accountAddress?: string;
  
  getSuggestedFix(): string {
    return `Account validation error resolution:\n` +
           `1. Verify account "${this.accountName}" exists on the network\n` +
           `2. Check account ownership and permissions\n` +
           `3. Ensure account address is correctly derived (for PDAs)\n` +
           `4. Validate account has required data structure\n` +
           `${this.accountAddress ? `5. Account address: ${this.accountAddress}` : ''}`;
  }
}

class TransactionBuildError extends IDLProcessingError {
  constructor(transactionType: string, issue: string, accounts?: string[]) {
    super(
      `Transaction build failed for "${transactionType}": ${issue}`,
      'buildTransaction',
      ERROR_CODES.TRANSACTION_BUILD_FAILED
    );
    this.name = 'TransactionBuildError';
    this.transactionType = transactionType;
    this.accounts = accounts;
  }
  
  public transactionType: string;
  public accounts?: string[];
  
  getSuggestedFix(): string {
    const accountInfo = this.accounts && this.accounts.length > 0 
      ? `\n5. Involved accounts: ${this.accounts.join(', ')}`
      : '';
    
    return `Transaction build error resolution:\n` +
           `1. Verify all required accounts are provided and valid\n` +
           `2. Check account permissions (mutable/signer requirements)\n` +
           `3. Ensure sufficient balance for transaction fees\n` +
           `4. Validate instruction parameters and types${accountInfo}`;
  }
}

class NetworkConnectionError extends IDLProcessingError {
  constructor(endpoint: string, issue: string) {
    super(
      `Network connection failed to "${endpoint}": ${issue}`,
      'validateConnection',
      ERROR_CODES.NETWORK_CONNECTION_FAILED
    );
    this.name = 'NetworkConnectionError';
    this.endpoint = endpoint;
  }
  
  public endpoint: string;
  
  getSuggestedFix(): string {
    return `Network connection error resolution:\n` +
           `1. Check internet connectivity\n` +
           `2. Verify RPC endpoint is accessible: ${this.endpoint}\n` +
           `3. Try switching to a different RPC endpoint\n` +
           `4. Check if the network is experiencing issues\n` +
           `5. Ensure firewall/proxy settings allow connection`;
  }
}

class WalletConnectionError extends IDLProcessingError {
  constructor(walletType: string, issue: string) {
    super(
      `Wallet connection failed for "${walletType}": ${issue}`,
      'validateWallet',
      ERROR_CODES.WALLET_CONNECTION_FAILED
    );
    this.name = 'WalletConnectionError';
    this.walletType = walletType;
  }
  
  public walletType: string;
  
  getSuggestedFix(): string {
    return `Wallet connection error resolution:\n` +
           `1. Ensure ${this.walletType} wallet is installed and unlocked\n` +
           `2. Check wallet permissions for the application\n` +
           `3. Try disconnecting and reconnecting the wallet\n` +
           `4. Verify wallet is connected to the correct network\n` +
           `5. Refresh the page and try again`;
  }
}

class InsufficientBalanceError extends IDLProcessingError {
  constructor(required: string, available: string, tokenType: string = 'SOL') {
    super(
      `Insufficient ${tokenType} balance: required ${required}, available ${available}`,
      'validateBalance',
      ERROR_CODES.INSUFFICIENT_BALANCE
    );
    this.name = 'InsufficientBalanceError';
    this.required = required;
    this.available = available;
    this.tokenType = tokenType;
  }
  
  public required: string;
  public available: string;
  public tokenType: string;
  
  getSuggestedFix(): string {
    return `Insufficient balance error resolution:\n` +
           `1. Add more ${this.tokenType} to your wallet (required: ${this.required}, available: ${this.available})\n` +
           `2. For SOL: Use a faucet on devnet/testnet or purchase on mainnet\n` +
           `3. For tokens: Ensure you have the correct token and sufficient amount\n` +
           `4. Check if you're on the correct network (mainnet/devnet/testnet)\n` +
           `5. Wait for pending transactions to complete`;
  }
}

// Error factory for creating appropriate error types
export class IDLErrorFactory {
  static createError(errorType: ErrorCode, details: Record<string, unknown>): IDLProcessingError {
    switch (errorType) {
      case ERROR_CODES.MISSING_ADDRESS_FIELD:
        return new IDLMissingAddressError();
      
      case ERROR_CODES.INVALID_TYPE_FORMAT:
        return new IDLInvalidTypeError(
          details.typeName as string || 'unknown',
          details.expectedFormat as string || 'pubkey'
        );
      
      case ERROR_CODES.MALFORMED_ACCOUNT:
        return new IDLMalformedAccountError(
          details.accountName as string || 'unknown',
          details.issue as string || 'structure invalid'
        );
      
      case ERROR_CODES.MISSING_INSTRUCTION:
        return new IDLMissingInstructionError(
          details.instructionName as string || 'unknown'
        );
      
      case ERROR_CODES.INCOMPATIBLE_VERSION:
        return new IDLIncompatibleVersionError(
          details.version as string || 'unknown'
        );
      
      case ERROR_CODES.PROGRAM_CREATION_FAILED:
        return new ProgramCreationError(
          details.message as string || 'Unknown program creation error',
          details.cause as Error || undefined
        );
      
      case ERROR_CODES.PROGRAM_VALIDATION_FAILED:
        return new ProgramValidationError(
          details.message as string || 'Unknown validation error',
          details.validationStep as string || 'unknown'
        );
      
      case ERROR_CODES.METHOD_NOT_FOUND:
        return new MethodNotFoundError(
          details.methodName as string || 'unknown',
          details.availableMethods as string[] || []
        );
      
      case ERROR_CODES.ACCOUNT_VALIDATION_FAILED:
        return new AccountValidationError(
          details.accountName as string || 'unknown',
          details.issue as string || 'validation failed',
          details.accountAddress as string || undefined
        );
      
      case ERROR_CODES.TRANSACTION_BUILD_FAILED:
        return new TransactionBuildError(
          details.transactionType as string || 'unknown',
          details.issue as string || 'build failed',
          details.accounts as string[] || undefined
        );
      
      case ERROR_CODES.NETWORK_CONNECTION_FAILED:
        return new NetworkConnectionError(
          details.endpoint as string || 'unknown',
          details.issue as string || 'connection failed'
        );
      
      case ERROR_CODES.WALLET_CONNECTION_FAILED:
        return new WalletConnectionError(
          details.walletType as string || 'unknown',
          details.issue as string || 'connection failed'
        );
      
      case ERROR_CODES.INSUFFICIENT_BALANCE:
        return new InsufficientBalanceError(
          details.required as string || '0',
          details.available as string || '0',
          details.tokenType as string || 'SOL'
        );
      
      default:
        return new IDLProcessingError(
          `Unknown IDL error: ${errorType}`,
          'unknown',
          errorType
        );
    }
  }
  
  static getSuggestedFix(error: IDLProcessingError): string {
    if ('getSuggestedFix' in error && typeof (error as unknown as { getSuggestedFix?: () => string }).getSuggestedFix === 'function') {
      return (error as unknown as { getSuggestedFix: () => string }).getSuggestedFix();
    }
    
    // Generic suggestions based on error code
    switch (error.code) {
      case ERROR_CODES.MISSING_ADDRESS_FIELD:
        return 'Add program address to IDL root level or metadata.address field';
      case ERROR_CODES.INVALID_TYPE_FORMAT:
        return 'Update type definitions to use Anchor v0.32.1 format (publicKey → pubkey)';
      case ERROR_CODES.MALFORMED_ACCOUNT:
        return 'Fix account structure to include required fields (name, isMut, isSigner)';
      case ERROR_CODES.MISSING_INSTRUCTION:
        return 'Add missing instruction definition with proper accounts and args';
      case ERROR_CODES.PROGRAM_CREATION_FAILED:
        return 'Fix program creation by validating IDL structure and provider configuration';
      case ERROR_CODES.PROGRAM_VALIDATION_FAILED:
        return 'Ensure program is deployed and accessible on the current network';
      case ERROR_CODES.METHOD_NOT_FOUND:
        return 'Check method name and verify it exists in the program IDL';
      case ERROR_CODES.ACCOUNT_VALIDATION_FAILED:
        return 'Verify account exists and has correct ownership/permissions';
      case ERROR_CODES.TRANSACTION_BUILD_FAILED:
        return 'Check all required accounts and parameters are valid';
      case ERROR_CODES.NETWORK_CONNECTION_FAILED:
        return 'Check network connectivity and RPC endpoint availability';
      case ERROR_CODES.WALLET_CONNECTION_FAILED:
        return 'Ensure wallet is installed, unlocked, and connected';
      case ERROR_CODES.INSUFFICIENT_BALANCE:
        return 'Add more funds to your wallet or check token balance';
      default:
        return 'Check IDL structure matches Anchor v0.32.1 requirements';
    }
  }
  
  // Error categorization for different failure types
  static categorizeError(error: IDLProcessingError): {
    category: 'IDL_PROCESSING' | 'PROGRAM_INITIALIZATION' | 'METHOD_VALIDATION' | 'ACCOUNT_VALIDATION' | 'TRANSACTION_EXECUTION' | 'NETWORK_CONNECTIVITY' | 'WALLET_INTERACTION' | 'BALANCE_INSUFFICIENT' | 'UNKNOWN';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userActionRequired: boolean;
    technicalDetails: boolean;
  } {
    switch (error.code) {
      case ERROR_CODES.MISSING_ADDRESS_FIELD:
      case ERROR_CODES.INVALID_TYPE_FORMAT:
      case ERROR_CODES.MALFORMED_ACCOUNT:
      case ERROR_CODES.MISSING_INSTRUCTION:
      case ERROR_CODES.INCOMPATIBLE_VERSION:
        return {
          category: 'IDL_PROCESSING',
          severity: 'HIGH',
          userActionRequired: false,
          technicalDetails: true
        };
      
      case ERROR_CODES.PROGRAM_CREATION_FAILED:
      case ERROR_CODES.PROGRAM_VALIDATION_FAILED:
        return {
          category: 'PROGRAM_INITIALIZATION',
          severity: 'CRITICAL',
          userActionRequired: false,
          technicalDetails: true
        };
      
      case ERROR_CODES.METHOD_NOT_FOUND:
        return {
          category: 'METHOD_VALIDATION',
          severity: 'HIGH',
          userActionRequired: false,
          technicalDetails: true
        };
      
      case ERROR_CODES.ACCOUNT_VALIDATION_FAILED:
        return {
          category: 'ACCOUNT_VALIDATION',
          severity: 'MEDIUM',
          userActionRequired: true,
          technicalDetails: false
        };
      
      case ERROR_CODES.TRANSACTION_BUILD_FAILED:
        return {
          category: 'TRANSACTION_EXECUTION',
          severity: 'MEDIUM',
          userActionRequired: true,
          technicalDetails: false
        };
      
      case ERROR_CODES.NETWORK_CONNECTION_FAILED:
        return {
          category: 'NETWORK_CONNECTIVITY',
          severity: 'HIGH',
          userActionRequired: true,
          technicalDetails: false
        };
      
      case ERROR_CODES.WALLET_CONNECTION_FAILED:
        return {
          category: 'WALLET_INTERACTION',
          severity: 'MEDIUM',
          userActionRequired: true,
          technicalDetails: false
        };
      
      case ERROR_CODES.INSUFFICIENT_BALANCE:
        return {
          category: 'BALANCE_INSUFFICIENT',
          severity: 'LOW',
          userActionRequired: true,
          technicalDetails: false
        };
      
      default:
        return {
          category: 'UNKNOWN',
          severity: 'MEDIUM',
          userActionRequired: true,
          technicalDetails: true
        };
    }
  }
}

// User-friendly error message converter
export class UserFriendlyErrorConverter {
  static convertToUserMessage(error: IDLProcessingError): {
    title: string;
    message: string;
    actionRequired: string;
    technicalDetails?: string;
  } {
    const category = IDLErrorFactory.categorizeError(error);
    
    switch (error.code) {
      case ERROR_CODES.MISSING_ADDRESS_FIELD:
        return {
          title: 'Program Configuration Issue',
          message: 'The application is having trouble connecting to the blockchain program. This is a technical configuration issue.',
          actionRequired: 'Please refresh the page and try again. If the problem persists, contact support.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      
      case ERROR_CODES.INVALID_TYPE_FORMAT:
        return {
          title: 'Program Compatibility Issue',
          message: 'The application needs to be updated to work with the current blockchain program version.',
          actionRequired: 'Please refresh the page. If the issue continues, the development team needs to update the application.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      
      case ERROR_CODES.PROGRAM_CREATION_FAILED:
      case ERROR_CODES.PROGRAM_VALIDATION_FAILED:
        return {
          title: 'Connection Problem',
          message: 'Unable to connect to the blockchain program. This could be a temporary network issue or program maintenance.',
          actionRequired: 'Try refreshing the page or check back in a few minutes. Ensure you\'re connected to the correct network.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      
      case ERROR_CODES.METHOD_NOT_FOUND: {
        const methodError = error as MethodNotFoundError;
        return {
          title: 'Feature Unavailable',
          message: 'The requested feature is not available in the current program version.',
          actionRequired: 'Try refreshing the page. If the feature should be available, contact support.',
          technicalDetails: category.technicalDetails ? 
            `Method "${methodError.message}" not found. Available: ${methodError.availableMethods.join(', ')}` : 
            undefined
        };
      }
      
      case ERROR_CODES.ACCOUNT_VALIDATION_FAILED: {
        const accountError = error as AccountValidationError;
        return {
          title: 'Account Issue',
          message: `There's an issue with your account "${accountError.accountName}". It may not exist or have the required permissions.`,
          actionRequired: 'Check your wallet connection and ensure you\'re on the correct network. Try reconnecting your wallet.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      }
      
      case ERROR_CODES.TRANSACTION_BUILD_FAILED: {
        const txError = error as TransactionBuildError;
        return {
          title: 'Transaction Error',
          message: `Unable to prepare your ${txError.transactionType} transaction. There may be an issue with the transaction parameters.`,
          actionRequired: 'Check your input values and try again. Ensure you have sufficient balance for transaction fees.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      }
      
      case ERROR_CODES.NETWORK_CONNECTION_FAILED: {
        const networkError = error as NetworkConnectionError;
        return {
          title: 'Network Connection Problem',
          message: 'Unable to connect to the blockchain network. This could be due to internet connectivity or network issues.',
          actionRequired: 'Check your internet connection and try again. You may also try switching to a different network if available.',
          technicalDetails: category.technicalDetails ? `Failed to connect to ${networkError.endpoint}` : undefined
        };
      }
      
      case ERROR_CODES.WALLET_CONNECTION_FAILED: {
        const walletError = error as WalletConnectionError;
        return {
          title: 'Wallet Connection Issue',
          message: `Unable to connect to your ${walletError.walletType} wallet. Make sure it's installed and unlocked.`,
          actionRequired: 'Check that your wallet is installed, unlocked, and connected to the correct network. Try disconnecting and reconnecting.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      }
      
      case ERROR_CODES.INSUFFICIENT_BALANCE: {
        const balanceError = error as InsufficientBalanceError;
        return {
          title: 'Insufficient Balance',
          message: `You don't have enough ${balanceError.tokenType} to complete this transaction. Required: ${balanceError.required}, Available: ${balanceError.available}`,
          actionRequired: `Add more ${balanceError.tokenType} to your wallet or reduce the transaction amount.`,
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      }
      
      case ERROR_CODES.MALFORMED_ACCOUNT:
      case ERROR_CODES.MISSING_INSTRUCTION:
      case ERROR_CODES.INCOMPATIBLE_VERSION:
        return {
          title: 'Technical Issue',
          message: 'The application encountered a technical problem. This is likely a temporary issue with the program configuration.',
          actionRequired: 'Please refresh the page and try again. If the problem persists, contact support with the error details.',
          technicalDetails: category.technicalDetails ? error.message : undefined
        };
      
      default:
        return {
          title: 'Unexpected Error',
          message: 'An unexpected error occurred while processing your request.',
          actionRequired: 'Please try again. If the problem continues, contact support with the error details.',
          technicalDetails: error.message
        };
    }
  }
  
  static getCommonScenarioGuidance(errorCode: ErrorCode): {
    scenario: string;
    guidance: string;
    steps: string[];
  } | null {
    switch (errorCode) {
      case ERROR_CODES.PROGRAM_CREATION_FAILED:
      case ERROR_CODES.PROGRAM_VALIDATION_FAILED:
        return {
          scenario: 'Program initialization failure during app startup',
          guidance: 'This usually happens when there are network issues or the program is being updated.',
          steps: [
            'Refresh the browser page',
            'Check your internet connection',
            'Verify you\'re connected to the correct network (mainnet/devnet)',
            'Clear browser cache if the issue persists',
            'Contact support if the problem continues'
          ]
        };
      
      case ERROR_CODES.WALLET_CONNECTION_FAILED:
        return {
          scenario: 'Wallet connection issues when trying to interact with the app',
          guidance: 'Wallet connection problems are common and usually easy to fix.',
          steps: [
            'Make sure your wallet extension is installed and enabled',
            'Unlock your wallet if it\'s locked',
            'Check that your wallet is connected to the correct network',
            'Try disconnecting and reconnecting your wallet',
            'Refresh the page and try connecting again',
            'Try using a different wallet if available'
          ]
        };
      
      case ERROR_CODES.INSUFFICIENT_BALANCE:
        return {
          scenario: 'Not enough funds to complete a transaction',
          guidance: 'You need sufficient balance for both the transaction amount and network fees.',
          steps: [
            'Check your wallet balance for the required token',
            'Ensure you have enough SOL for transaction fees (usually 0.001-0.01 SOL)',
            'Add funds to your wallet if needed',
            'For testnet: use a faucet to get test tokens',
            'For mainnet: purchase tokens from an exchange',
            'Wait for pending transactions to complete before trying again'
          ]
        };
      
      case ERROR_CODES.NETWORK_CONNECTION_FAILED:
        return {
          scenario: 'Unable to connect to the blockchain network',
          guidance: 'Network connectivity issues can prevent the app from working properly.',
          steps: [
            'Check your internet connection',
            'Try refreshing the page',
            'Switch to a different RPC endpoint if available',
            'Check if the network is experiencing issues',
            'Disable VPN or proxy if you\'re using one',
            'Try again in a few minutes'
          ]
        };
      
      case ERROR_CODES.ACCOUNT_VALIDATION_FAILED:
        return {
          scenario: 'Account-related errors during transactions',
          guidance: 'Account validation errors usually indicate missing or incorrect account setup.',
          steps: [
            'Ensure your wallet is connected and unlocked',
            'Verify you\'re on the correct network',
            'Check that required accounts exist (they may need to be created first)',
            'Ensure you have the necessary permissions for the accounts',
            'Try disconnecting and reconnecting your wallet',
            'Contact support if you believe this is an error'
          ]
        };
      
      default:
        return null;
    }
  }
  
  static getTroubleshootingSteps(error: IDLProcessingError): string[] {
    const category = IDLErrorFactory.categorizeError(error);
    
    // Common troubleshooting steps based on category
    const commonSteps: Record<string, string[]> = {
      'IDL_PROCESSING': [
        'Refresh the browser page',
        'Clear browser cache and cookies',
        'Check if the application is being updated',
        'Contact support with technical details'
      ],
      'PROGRAM_INITIALIZATION': [
        'Refresh the page and try again',
        'Check your internet connection',
        'Verify network connectivity',
        'Try again in a few minutes',
        'Contact support if the issue persists'
      ],
      'METHOD_VALIDATION': [
        'Refresh the page to reload the program',
        'Check if the feature is available in your region',
        'Verify you\'re using the latest version of the app',
        'Contact support if the feature should be available'
      ],
      'ACCOUNT_VALIDATION': [
        'Check your wallet connection',
        'Verify you\'re on the correct network',
        'Ensure required accounts exist',
        'Try reconnecting your wallet',
        'Check account permissions'
      ],
      'TRANSACTION_EXECUTION': [
        'Verify transaction parameters',
        'Check your balance for fees',
        'Ensure all required accounts are accessible',
        'Try with a smaller amount',
        'Wait for network congestion to clear'
      ],
      'NETWORK_CONNECTIVITY': [
        'Check your internet connection',
        'Try refreshing the page',
        'Switch networks if available',
        'Disable VPN/proxy temporarily',
        'Try again later'
      ],
      'WALLET_INTERACTION': [
        'Ensure wallet is installed and unlocked',
        'Check wallet permissions for the app',
        'Try disconnecting and reconnecting',
        'Verify correct network in wallet',
        'Try a different wallet if available'
      ],
      'BALANCE_INSUFFICIENT': [
        'Check your token balance',
        'Ensure sufficient SOL for fees',
        'Add funds to your wallet',
        'Reduce transaction amount',
        'Wait for pending transactions'
      ]
    };
    
    return commonSteps[category.category] || [
      'Refresh the page and try again',
      'Check your internet connection',
      'Contact support with error details'
    ];
  }
}

// Error display utility for UI components
export class ErrorDisplayManager {
  static formatErrorForDisplay(error: unknown): {
    userMessage: {
      title: string;
      message: string;
      actionRequired: string;
      technicalDetails?: string;
    };
    troubleshootingSteps: string[];
    scenarioGuidance?: {
      scenario: string;
      guidance: string;
      steps: string[];
    };
    errorCode?: ErrorCode;
    shouldShowTechnicalDetails: boolean;
  } {
    // Handle IDL processing errors
    if (error instanceof IDLProcessingError) {
      const userMessage = UserFriendlyErrorConverter.convertToUserMessage(error);
      const troubleshootingSteps = UserFriendlyErrorConverter.getTroubleshootingSteps(error);
      const scenarioGuidance = error.code ? UserFriendlyErrorConverter.getCommonScenarioGuidance(error.code) : null;
      const category = IDLErrorFactory.categorizeError(error);
      
      return {
        userMessage,
        troubleshootingSteps,
        scenarioGuidance: scenarioGuidance || undefined,
        errorCode: error.code,
        shouldShowTechnicalDetails: category.technicalDetails && process.env.NODE_ENV === 'development'
      };
    }
    
    // Handle generic "Program not available" errors (replace with specific error)
    if (error instanceof Error && error.message.includes('Program not available')) {
      const programError = IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'Program initialization failed - unable to connect to blockchain program',
        cause: error
      });
      
      return this.formatErrorForDisplay(programError);
    }
    
    // Handle Anchor-specific errors
    if (error instanceof Error && error.message.includes('Cannot read properties of undefined')) {
      const idlError = IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'IDL processing failed during program initialization',
        cause: error
      });
      
      return this.formatErrorForDisplay(idlError);
    }
    
    // Handle network/connection errors
    if (error instanceof Error && (
      error.message.includes('fetch') || 
      error.message.includes('network') || 
      error.message.includes('connection')
    )) {
      const networkError = IDLErrorFactory.createError(ERROR_CODES.NETWORK_CONNECTION_FAILED, {
        endpoint: 'blockchain network',
        issue: error.message
      });
      
      return this.formatErrorForDisplay(networkError);
    }
    
    // Handle wallet errors
    if (error instanceof Error && (
      error.message.includes('wallet') || 
      error.message.includes('WalletNotConnectedError') ||
      error.message.includes('WalletNotReadyError')
    )) {
      const walletError = IDLErrorFactory.createError(ERROR_CODES.WALLET_CONNECTION_FAILED, {
        walletType: 'browser wallet',
        issue: error.message
      });
      
      return this.formatErrorForDisplay(walletError);
    }
    
    // Handle generic errors
    const genericError = error instanceof Error ? error : new Error(String(error));
    return {
      userMessage: {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again.',
        actionRequired: 'Refresh the page and try again. Contact support if the problem persists.',
        technicalDetails: process.env.NODE_ENV === 'development' ? genericError.message : undefined
      },
      troubleshootingSteps: [
        'Refresh the browser page',
        'Check your internet connection',
        'Try again in a few minutes',
        'Contact support if the issue continues'
      ],
      shouldShowTechnicalDetails: process.env.NODE_ENV === 'development'
    };
  }
  
  static logErrorForDebugging(error: unknown, context?: string): void {
    const prefix = context ? `[${context}]` : '[Error]';
    
    if (error instanceof IDLProcessingError) {
      console.group(`${prefix} IDL Processing Error`);
      console.error('Error Code:', error.code);
      console.error('Processing Step:', error.step);
      console.error('Message:', error.message);
      console.error('Suggested Fix:', IDLErrorFactory.getSuggestedFix(error));
      
      const category = IDLErrorFactory.categorizeError(error);
      console.error('Category:', category.category);
      console.error('Severity:', category.severity);
      console.error('User Action Required:', category.userActionRequired);
      
      if (error instanceof ProgramCreationError && error.underlyingError) {
        console.error('Underlying Cause:', error.underlyingError);
      }
      console.groupEnd();
    } else {
      console.error(`${prefix}`, error);
    }
  }
  
  static createErrorNotification(error: unknown, context?: string): {
    type: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  } {
    const errorInfo = this.formatErrorForDisplay(error);
    const category = error instanceof IDLProcessingError ? 
      IDLErrorFactory.categorizeError(error) : 
      { severity: 'MEDIUM' as const, userActionRequired: true };
    
    // Determine notification type based on severity
    let type: 'error' | 'warning' | 'info' = 'error';
    let duration: number | undefined = undefined;
    
    switch (category.severity) {
      case 'LOW':
        type = 'warning';
        duration = 5000;
        break;
      case 'MEDIUM':
        type = 'error';
        duration = 8000;
        break;
      case 'HIGH':
      case 'CRITICAL':
        type = 'error';
        // No auto-dismiss for critical errors
        break;
    }
    
    return {
      type,
      title: errorInfo.userMessage.title,
      description: errorInfo.userMessage.message,
      duration,
      action: category.userActionRequired ? {
        label: 'View Help',
        onClick: () => {
          console.group('Troubleshooting Steps');
          errorInfo.troubleshootingSteps.forEach((step, index) => {
            console.log(`${index + 1}. ${step}`);
          });
          console.groupEnd();
          
          if (errorInfo.scenarioGuidance) {
            console.group('Scenario Guidance');
            console.log('Scenario:', errorInfo.scenarioGuidance.scenario);
            console.log('Guidance:', errorInfo.scenarioGuidance.guidance);
            console.log('Steps:');
            errorInfo.scenarioGuidance.steps.forEach((step, index) => {
              console.log(`  ${index + 1}. ${step}`);
            });
            console.groupEnd();
          }
        }
      } : undefined
    };
  }
}

// Error recovery system with project-specific guidance
export class ErrorRecoverySystem {
  static getRecoveryPlan(error: IDLProcessingError): {
    immediateActions: string[];
    detailedSteps: {
      title: string;
      description: string;
      steps: string[];
      projectRuleReference?: string;
    }[];
    preventionTips: string[];
    documentationLinks: {
      title: string;
      description: string;
      section: string;
    }[];
  } {
    switch (error.code) {
      case ERROR_CODES.MISSING_ADDRESS_FIELD:
        return {
          immediateActions: [
            'Refresh the page to reload the program configuration',
            'Check if the application is being updated',
            'Contact support if the issue persists'
          ],
          detailedSteps: [
            {
              title: 'IDL Address Field Fix',
              description: 'The program IDL is missing the required address field for Anchor v0.32.1 compatibility.',
              steps: [
                'Verify the IDL has a root-level "address" field',
                'If missing, copy from "metadata.address" to root level',
                'Ensure the address matches the deployed program ID',
                'Regenerate IDL if necessary using "anchor build"'
              ],
              projectRuleReference: 'Rule #26: IDL Structure Requirements - Root Address Field'
            }
          ],
          preventionTips: [
            'Always include root-level address field in IDL files',
            'Use the IDL processing function pattern from project rules',
            'Validate IDL structure before program deployment'
          ],
          documentationLinks: [
            {
              title: 'Anchor IDL Compatibility Rules',
              description: 'Critical rules for IDL structure and Anchor v0.32.1 compatibility',
              section: 'Rules #26-32: IDL Structure Requirements'
            }
          ]
        };

      case ERROR_CODES.INVALID_TYPE_FORMAT:
        return {
          immediateActions: [
            'Refresh the page to reload the program',
            'Check if the program is being updated',
            'Try again in a few minutes'
          ],
          detailedSteps: [
            {
              title: 'Type Compatibility Fix',
              description: 'The IDL contains type definitions that are incompatible with Anchor v0.32.1.',
              steps: [
                'Convert all "publicKey" types to "pubkey" in the IDL',
                'Update defined type format from string to object structure',
                'Apply the fixIdlTypes function from project rules',
                'Verify all type definitions follow Anchor v0.32.1 format'
              ],
              projectRuleReference: 'Rule #27: Type Name Compatibility & Rule #28: Defined Type Format'
            }
          ],
          preventionTips: [
            'Use the IDL processing function pattern for all program initialization',
            'Always validate type compatibility when upgrading Anchor versions',
            'Test IDL structure with minimal test cases first'
          ],
          documentationLinks: [
            {
              title: 'Type Name Compatibility',
              description: 'Rules for proper type naming in Anchor IDL files',
              section: 'Rule #27: PublicKey Types'
            },
            {
              title: 'Defined Type Format',
              description: 'Object structure requirements for defined types',
              section: 'Rule #28: Defined Type Format'
            }
          ]
        };

      case ERROR_CODES.PROGRAM_CREATION_FAILED:
      case ERROR_CODES.PROGRAM_VALIDATION_FAILED:
        return {
          immediateActions: [
            'Refresh the page and try again',
            'Check your internet connection',
            'Verify you\'re connected to the correct network (devnet/mainnet)'
          ],
          detailedSteps: [
            {
              title: 'Program Initialization Recovery',
              description: 'The Anchor program failed to initialize properly, likely due to IDL or network issues.',
              steps: [
                'Verify the program is deployed to the current network',
                'Check that the program address matches the IDL address field',
                'Ensure the IDL follows all Anchor v0.32.1 compatibility rules',
                'Validate network connectivity and RPC endpoint',
                'Apply comprehensive IDL processing before program creation'
              ],
              projectRuleReference: 'Rule #30: IDL Processing Function Pattern'
            },
            {
              title: 'Network Configuration Check',
              description: 'Verify network settings and connectivity.',
              steps: [
                'Confirm RPC URL with "solana config get"',
                'Check if using devnet for testing (Rule #6)',
                'Verify program deployment on Solana Explorer',
                'Ensure wallet is connected to the correct network'
              ],
              projectRuleReference: 'Rule #6: Network Usage - Default to Devnet'
            }
          ],
          preventionTips: [
            'Always use the comprehensive IDL processing pattern',
            'Test program initialization with minimal IDL first',
            'Validate network configuration before deployment'
          ],
          documentationLinks: [
            {
              title: 'IDL Processing Function Pattern',
              description: 'Complete pattern for processing IDL files for Anchor compatibility',
              section: 'Rule #30: IDL Processing Function Pattern'
            },
            {
              title: 'Network Usage Rules',
              description: 'Guidelines for network configuration and deployment',
              section: 'Rule #6: Network Usage'
            }
          ]
        };

      case ERROR_CODES.METHOD_NOT_FOUND: {
        const methodError = error as MethodNotFoundError;
        return {
          immediateActions: [
            'Refresh the page to reload the program',
            'Check if the feature is available in your region',
            'Verify you\'re using the latest version of the app'
          ],
          detailedSteps: [
            {
              title: 'Method Availability Check',
              description: `The method "${methodError.message}" is not available in the current program.`,
              steps: [
                'Verify the method name spelling and case sensitivity',
                'Check if the method exists in the program IDL',
                `Available methods: ${methodError.availableMethods.join(', ')}`,
                'Regenerate IDL if method was recently added to program',
                'Ensure program is deployed with the latest version'
              ],
              projectRuleReference: 'Rule #15: Smart Contract Calls - Verify Instructions'
            }
          ],
          preventionTips: [
            'Always verify method names against the current IDL',
            'Use TypeScript for method name validation',
            'Test method availability before building transactions'
          ],
          documentationLinks: [
            {
              title: 'Smart Contract Calls',
              description: 'Guidelines for calling program instructions safely',
              section: 'Rule #15: Smart Contract Calls'
            }
          ]
        };
      }

      case ERROR_CODES.WALLET_CONNECTION_FAILED:
        return {
          immediateActions: [
            'Check that your wallet extension is installed and enabled',
            'Unlock your wallet if it\'s locked',
            'Try disconnecting and reconnecting your wallet'
          ],
          detailedSteps: [
            {
              title: 'Wallet Connection Recovery',
              description: 'Resolve wallet connection issues following project guidelines.',
              steps: [
                'Ensure Phantom or Solflare wallet is installed (Rule #14)',
                'Check wallet permissions for the application',
                'Verify wallet is connected to the correct network',
                'Display connected wallet address clearly in UI',
                'Handle wallet disconnection gracefully'
              ],
              projectRuleReference: 'Rule #14: Wallet Integration'
            }
          ],
          preventionTips: [
            'Support multiple wallet types (Phantom, Solflare)',
            'Implement graceful wallet disconnection handling',
            'Always verify wallet connection before transactions'
          ],
          documentationLinks: [
            {
              title: 'Wallet Integration Rules',
              description: 'Complete guide for wallet connection and management',
              section: 'Rule #14: Wallet Integration'
            }
          ]
        };

      case ERROR_CODES.NETWORK_CONNECTION_FAILED:
        return {
          immediateActions: [
            'Check your internet connection',
            'Try refreshing the page',
            'Switch to a different RPC endpoint if available'
          ],
          detailedSteps: [
            {
              title: 'Network Connection Recovery',
              description: 'Resolve network connectivity issues.',
              steps: [
                'Verify internet connectivity',
                'Check RPC endpoint availability',
                'Confirm network configuration (devnet/mainnet)',
                'Test connection with "solana config get"',
                'Switch to backup RPC if primary fails'
              ],
              projectRuleReference: 'Rule #6: Network Usage'
            }
          ],
          preventionTips: [
            'Use reliable RPC endpoints',
            'Implement RPC failover mechanisms',
            'Monitor network status before transactions'
          ],
          documentationLinks: [
            {
              title: 'Network Configuration',
              description: 'Guidelines for network setup and RPC management',
              section: 'Rule #6: Network Usage'
            }
          ]
        };

      case ERROR_CODES.ACCOUNT_VALIDATION_FAILED:
        return {
          immediateActions: [
            'Check your wallet connection',
            'Verify you\'re on the correct network',
            'Try reconnecting your wallet'
          ],
          detailedSteps: [
            {
              title: 'Account Validation Recovery',
              description: 'Resolve account-related validation issues.',
              steps: [
                'Ensure required accounts exist on the network',
                'Verify account ownership and permissions',
                'Check that PDAs are derived correctly',
                'Validate account data structure matches expectations',
                'Create missing accounts if necessary'
              ],
              projectRuleReference: 'Rule #12: Smart Contract Guidelines - Validate Inputs'
            }
          ],
          preventionTips: [
            'Always validate account existence before transactions',
            'Use proper PDA derivation patterns',
            'Implement account creation flows for missing accounts'
          ],
          documentationLinks: [
            {
              title: 'Smart Contract Guidelines',
              description: 'Best practices for account validation and management',
              section: 'Rule #12: Smart Contract Guidelines'
            }
          ]
        };

      case ERROR_CODES.INSUFFICIENT_BALANCE:
        return {
          immediateActions: [
            'Check your wallet balance',
            'Add more funds to your wallet',
            'Reduce the transaction amount'
          ],
          detailedSteps: [
            {
              title: 'Balance Management',
              description: 'Resolve insufficient balance issues.',
              steps: [
                'Check SOL balance for transaction fees',
                'Verify token balance for the transaction',
                'Use faucet for devnet testing',
                'Purchase tokens from exchange for mainnet',
                'Wait for pending transactions to complete'
              ],
              projectRuleReference: 'Rule #10: Token Management'
            }
          ],
          preventionTips: [
            'Always check balance before initiating transactions',
            'Reserve SOL for transaction fees',
            'Implement balance validation in UI'
          ],
          documentationLinks: [
            {
              title: 'Token Management',
              description: 'Guidelines for token handling and balance management',
              section: 'Rule #10: Token Management'
            }
          ]
        };

      default:
        return {
          immediateActions: [
            'Refresh the page and try again',
            'Check your internet connection',
            'Contact support with error details'
          ],
          detailedSteps: [
            {
              title: 'General Error Recovery',
              description: 'Standard recovery steps for unexpected errors.',
              steps: [
                'Clear browser cache and cookies',
                'Disable browser extensions temporarily',
                'Try using a different browser',
                'Check console for additional error details',
                'Report the issue with full error context'
              ]
            }
          ],
          preventionTips: [
            'Keep the application updated',
            'Use supported browsers and wallet extensions',
            'Follow project rules and best practices'
          ],
          documentationLinks: [
            {
              title: 'Project Rules Overview',
              description: 'Complete project rules and guidelines',
              section: 'All Project Rules'
            }
          ]
        };
    }
  }

  static generateRecoveryScript(error: IDLProcessingError): {
    title: string;
    description: string;
    code: string;
    explanation: string;
  } | null {
    switch (error.code) {
      case ERROR_CODES.MISSING_ADDRESS_FIELD:
        return {
          title: 'IDL Address Field Fix Script',
          description: 'Automatically fix missing address field in IDL',
          code: `
// Fix IDL missing address field (Rule #26)
function fixIDLAddressField(rawIdl: any): any {
  if (!rawIdl.address && rawIdl.metadata?.address) {
    return {
      ...rawIdl,
      address: rawIdl.metadata.address
    };
  }
  return rawIdl;
}

// Usage
const fixedIdl = fixIDLAddressField(originalIdl);
const program = new anchor.Program(fixedIdl, provider);
          `,
          explanation: 'This script adds the required root-level address field by copying from metadata.address, following project Rule #26.'
        };

      case ERROR_CODES.INVALID_TYPE_FORMAT:
        return {
          title: 'Type Compatibility Fix Script',
          description: 'Fix type compatibility issues for Anchor v0.32.1',
          code: `
// Fix type compatibility (Rules #27-28)
function fixTypeCompatibility(obj: any): any {
  if (typeof obj === "string") {
    return obj === "publicKey" ? "pubkey" : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(fixTypeCompatibility);
  }
  if (typeof obj === "object" && obj !== null) {
    const fixed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "defined" && typeof value === "string") {
        fixed[key] = { name: value };
      } else {
        fixed[key] = fixTypeCompatibility(value);
      }
    }
    return fixed;
  }
  return obj;
}

// Usage
const compatibleIdl = fixTypeCompatibility(rawIdl);
          `,
          explanation: 'This script fixes publicKey → pubkey conversion and defined type format according to project Rules #27-28.'
        };

      case ERROR_CODES.PROGRAM_CREATION_FAILED:
        return {
          title: 'Complete IDL Processing Script',
          description: 'Comprehensive IDL processing for Anchor v0.32.1',
          code: `
// Complete IDL processing (Rule #30)
function processIDLForAnchor(rawIdl: any): any {
  // Step 1: Add root address field
  const withAddress = {
    ...rawIdl,
    address: rawIdl.address || rawIdl.metadata?.address
  };

  // Step 2: Fix type compatibility
  const fixTypes = (obj: any): any => {
    if (typeof obj === "string") {
      return obj === "publicKey" ? "pubkey" : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(fixTypes);
    }
    if (typeof obj === "object" && obj !== null) {
      const fixed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === "defined" && typeof value === "string") {
          fixed[key] = { name: value };
        } else {
          fixed[key] = fixTypes(value);
        }
      }
      return fixed;
    }
    return obj;
  };

  const withFixedTypes = fixTypes(withAddress);

  // Step 3: Restructure accounts and add discriminators
  const accountTypes: any[] = [];
  const fixedAccounts = withFixedTypes.accounts?.map((account: any, index: number) => {
    if (account.type && !account.discriminator) {
      accountTypes.push({
        name: account.name,
        type: account.type
      });

      const discriminator = new Array(8).fill(0);
      discriminator[0] = index + 1;

      return {
        name: account.name,
        discriminator
      };
    }
    return account;
  }) || [];

  return {
    ...withFixedTypes,
    accounts: fixedAccounts,
    types: [...(withFixedTypes.types || []), ...accountTypes]
  };
}

// Usage
const processedIdl = processIDLForAnchor(rawIdl);
const program = new anchor.Program(processedIdl, provider);
          `,
          explanation: 'This is the complete IDL processing pattern from project Rule #30, handling all Anchor v0.32.1 compatibility requirements.'
        };

      default:
        return null;
    }
  }

  static getProjectRuleReference(errorCode: ErrorCode): {
    ruleNumber: string;
    title: string;
    description: string;
    relevantSection: string;
  } | null {
    const ruleMap: Record<ErrorCode, {
      ruleNumber: string;
      title: string;
      description: string;
      relevantSection: string;
    }> = {
      [ERROR_CODES.MISSING_ADDRESS_FIELD]: {
        ruleNumber: '26',
        title: 'IDL Structure Requirements',
        description: 'Root Address Field: Anchor expects idl.address at root level, not just idl.metadata.address',
        relevantSection: 'Root Address Field requirements and examples'
      },
      [ERROR_CODES.INVALID_TYPE_FORMAT]: {
        ruleNumber: '27-28',
        title: 'Type Name Compatibility & Defined Type Format',
        description: 'PublicKey Types: Anchor expects "pubkey", not "publicKey". Defined types need object structure.',
        relevantSection: 'Type compatibility and defined type format requirements'
      },
      [ERROR_CODES.MALFORMED_ACCOUNT]: {
        ruleNumber: '29',
        title: 'Account Structure Requirements',
        description: 'Separate Type Definitions: Account types must be in types array with discriminators',
        relevantSection: 'Account structure and discriminator requirements'
      },
      [ERROR_CODES.PROGRAM_CREATION_FAILED]: {
        ruleNumber: '30',
        title: 'IDL Processing Function Pattern',
        description: 'Always implement comprehensive IDL fixing when using Anchor Program constructor',
        relevantSection: 'Complete IDL processing pattern implementation'
      },
      [ERROR_CODES.PROGRAM_VALIDATION_FAILED]: {
        ruleNumber: '30',
        title: 'Program Validation',
        description: 'Ensure program is properly deployed and accessible after creation',
        relevantSection: 'Program validation and health check procedures'
      },
      [ERROR_CODES.NETWORK_CONNECTION_FAILED]: {
        ruleNumber: '6',
        title: 'Network Usage',
        description: 'Default to Devnet for all testing and deployment. Confirm RPC URL before running commands.',
        relevantSection: 'Network configuration and RPC management'
      },
      [ERROR_CODES.WALLET_CONNECTION_FAILED]: {
        ruleNumber: '14',
        title: 'Wallet Integration',
        description: 'Use @solana/wallet-adapter for wallet connection. Support Phantom and Solflare.',
        relevantSection: 'Wallet connection and management guidelines'
      },
      [ERROR_CODES.METHOD_NOT_FOUND]: {
        ruleNumber: '15',
        title: 'Smart Contract Calls',
        description: 'Use Anchor Client (TypeScript) for on-chain interactions. Always verify instructions.',
        relevantSection: 'Program method validation and verification'
      },
      [ERROR_CODES.ACCOUNT_VALIDATION_FAILED]: {
        ruleNumber: '12',
        title: 'Smart Contract Guidelines',
        description: 'Validate inputs before processing. Use require! or assert! macros for safety.',
        relevantSection: 'Account validation and safety checks'
      },
      [ERROR_CODES.INSUFFICIENT_BALANCE]: {
        ruleNumber: '10',
        title: 'Token Management',
        description: 'Use spl-token to create and mint tokens. Always record mint addresses and vault accounts.',
        relevantSection: 'Balance management and token handling'
      },
      [ERROR_CODES.MISSING_INSTRUCTION]: {
        ruleNumber: '13',
        title: 'Error Handling',
        description: 'Use clear error enums. Document error meanings in comments.',
        relevantSection: 'Error handling and instruction validation'
      },
      [ERROR_CODES.INCOMPATIBLE_VERSION]: {
        ruleNumber: '32',
        title: 'Version-Specific Notes',
        description: 'Anchor v0.32.1 requires all compatibility fixes. Never assume IDL format compatibility.',
        relevantSection: 'Version compatibility and testing requirements'
      },
      [ERROR_CODES.TRANSACTION_BUILD_FAILED]: {
        ruleNumber: '37',
        title: 'Contract–UI Integration Rules',
        description: 'Use normalized IDL before constructing clients. Include compute-budget instructions when needed.',
        relevantSection: 'Transaction building and execution patterns'
      },
      [ERROR_CODES.IDL_VALIDATION_FAILED]: {
        ruleNumber: '31',
        title: 'Error Debugging Protocol',
        description: 'Never assume IDL format - always verify with minimal test cases first.',
        relevantSection: 'IDL validation and debugging procedures'
      }
    };

    return ruleMap[errorCode] || null;
  }
}

// IDL validation result interface
interface IDLValidationResult {
  isValid: boolean
  methodsFound: string[]
  accountsFound: string[]
  typesProcessed: string[]
  errors: string[]
  warnings: string[]
}

// Program validation result interface
interface ProgramValidationResult {
  isValid: boolean
  programAddress: string
  methodsAvailable: string[]
  accountsAvailable: string[]
  errors: string[]
  warnings: string[]
}

export function getProgram(provider: anchor.AnchorProvider) {
  try {
    // Step 1: Validate IDL structure before processing
    const validationResult = validateIDLStructure(idl);
    if (!validationResult.isValid) {
      throw new IDLValidationError(
        `IDL validation failed: ${validationResult.errors.join(', ')}`,
        'structure',
        ERROR_CODES.IDL_VALIDATION_FAILED
      );
    }
    
    console.log('IDL validation passed:', {
      methods: validationResult.methodsFound.length,
      accounts: validationResult.accountsFound.length,
      types: validationResult.typesProcessed.length,
      warnings: validationResult.warnings
    });
    
    // Step 2: Add root-level address field validation and processing
    const processedIdl = processIDLForAnchor(idl);
    
    // Step 3: Create program with processed IDL and validate creation
    const program = validateProgramCreation(processedIdl, provider);
    
    console.log('Program initialized successfully with processed IDL');
    return program;
  } catch (error) {
    console.error('Program initialization failed:', error);
    if (error instanceof IDLProcessingError) {
      console.error(`IDL processing failed at step: ${error.step}`);
      console.error('Raw IDL structure:', JSON.stringify(idl, null, 2));
    }
    if (error instanceof IDLValidationError) {
      console.error(`IDL validation failed for field: ${error.field}`);
      console.error('Raw IDL structure:', JSON.stringify(idl, null, 2));
    }
    throw error;
  }
}

// Comprehensive IDL structure validation
function validateIDLStructure(rawIdl: unknown): IDLValidationResult {
  console.log('Starting IDL structure validation');
  
  const result: IDLValidationResult = {
    isValid: true,
    methodsFound: [],
    accountsFound: [],
    typesProcessed: [],
    errors: [],
    warnings: []
  };
  
  try {
    const idlObj = rawIdl as Record<string, unknown>;
    
    // Validate required top-level fields
    const requiredFields = ['version', 'name', 'instructions'];
    for (const field of requiredFields) {
      if (!(field in idlObj)) {
        result.errors.push(`Missing required field: ${field}`);
        result.isValid = false;
      }
    }
    
    // Validate address field (either root-level or in metadata)
    if (!idlObj.address && !((idlObj.metadata as Record<string, unknown>)?.address)) {
      const error = IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {});
      result.errors.push(`${error.message} - ${IDLErrorFactory.getSuggestedFix(error)}`);
      result.isValid = false;
    }
    
    // Validate instructions structure
    if (idlObj.instructions && Array.isArray(idlObj.instructions)) {
      const instructions = idlObj.instructions as Array<Record<string, unknown>>;
      
      for (const instruction of instructions) {
        if (!instruction.name || typeof instruction.name !== 'string') {
          result.errors.push('Instruction missing name field');
          result.isValid = false;
          continue;
        }
        
        result.methodsFound.push(instruction.name);
        
        // Validate instruction accounts
        if (!instruction.accounts || !Array.isArray(instruction.accounts)) {
          result.warnings.push(`Instruction ${instruction.name} missing accounts array`);
        } else {
          const accounts = instruction.accounts as Array<Record<string, unknown>>;
          for (const account of accounts) {
            if (!account.name || typeof account.name !== 'string') {
              const error = IDLErrorFactory.createError(ERROR_CODES.MALFORMED_ACCOUNT, {
                accountName: 'unnamed',
                issue: 'missing name field'
              });
              result.errors.push(`${error.message} - ${IDLErrorFactory.getSuggestedFix(error)}`);
              result.isValid = false;
            }
            if (typeof account.isMut !== 'boolean') {
              const error = IDLErrorFactory.createError(ERROR_CODES.MALFORMED_ACCOUNT, {
                accountName: account.name as string || 'unknown',
                issue: 'missing or invalid isMut field'
              });
              result.errors.push(`${error.message} - ${IDLErrorFactory.getSuggestedFix(error)}`);
              result.isValid = false;
            }
            if (typeof account.isSigner !== 'boolean') {
              const error = IDLErrorFactory.createError(ERROR_CODES.MALFORMED_ACCOUNT, {
                accountName: account.name as string || 'unknown',
                issue: 'missing or invalid isSigner field'
              });
              result.errors.push(`${error.message} - ${IDLErrorFactory.getSuggestedFix(error)}`);
              result.isValid = false;
            }
          }
        }
        
        // Validate instruction args
        if (!instruction.args || !Array.isArray(instruction.args)) {
          result.warnings.push(`Instruction ${instruction.name} missing args array`);
        } else {
          const args = instruction.args as Array<Record<string, unknown>>;
          for (const arg of args) {
            if (!arg.name || typeof arg.name !== 'string') {
              result.errors.push(`Argument in instruction ${instruction.name} missing name`);
              result.isValid = false;
            }
            if (!arg.type) {
              result.errors.push(`Argument ${arg.name} in instruction ${instruction.name} missing type`);
              result.isValid = false;
            }
          }
        }
      }
    } else {
      result.errors.push('Instructions field must be an array');
      result.isValid = false;
    }
    
    // Validate accounts structure
    if (idlObj.accounts && Array.isArray(idlObj.accounts)) {
      const accounts = idlObj.accounts as Array<Record<string, unknown>>;
      
      for (const account of accounts) {
        if (!account.name || typeof account.name !== 'string') {
          result.errors.push('Account definition missing name field');
          result.isValid = false;
          continue;
        }
        
        result.accountsFound.push(account.name);
        
        if (!account.type || typeof account.type !== 'object') {
          result.errors.push(`Account ${account.name} missing or invalid type definition`);
          result.isValid = false;
          continue;
        }
        
        const accountType = account.type as Record<string, unknown>;
        if (accountType.kind !== 'struct') {
          result.warnings.push(`Account ${account.name} has non-struct type: ${accountType.kind}`);
        }
        
        if (!accountType.fields || !Array.isArray(accountType.fields)) {
          result.errors.push(`Account ${account.name} missing fields array`);
          result.isValid = false;
        }
      }
    }
    
    // Validate types structure
    if (idlObj.types && Array.isArray(idlObj.types)) {
      const types = idlObj.types as Array<Record<string, unknown>>;
      
      for (const type of types) {
        if (!type.name || typeof type.name !== 'string') {
          result.errors.push('Type definition missing name field');
          result.isValid = false;
          continue;
        }
        
        result.typesProcessed.push(type.name);
        
        if (!type.type || typeof type.type !== 'object') {
          result.errors.push(`Type ${type.name} missing or invalid type definition`);
          result.isValid = false;
        }
      }
    }
    
    console.log('IDL validation completed:', {
      isValid: result.isValid,
      methodsFound: result.methodsFound.length,
      accountsFound: result.accountsFound.length,
      typesProcessed: result.typesProcessed.length,
      errors: result.errors.length,
      warnings: result.warnings.length
    });
    
    return result;
    
  } catch (error) {
    console.error('IDL validation failed with exception:', error);
    result.errors.push(`Validation exception: ${error instanceof Error ? error.message : String(error)}`);
    result.isValid = false;
    return result;
  }
}

// Comprehensive IDL processing for Anchor v0.32.1 compatibility
function processIDLForAnchor(rawIdl: unknown): anchor.Idl {
  console.log('=== Starting IDL processing for Anchor v0.32.1 compatibility ===');
  console.log('Raw IDL summary:', {
    version: (rawIdl as Record<string, unknown>)?.version,
    name: (rawIdl as Record<string, unknown>)?.name,
    hasAddress: !!(rawIdl as Record<string, unknown>)?.address,
    hasMetadataAddress: !!((rawIdl as Record<string, unknown>)?.metadata as Record<string, unknown>)?.address,
    instructionCount: Array.isArray((rawIdl as Record<string, unknown>)?.instructions) 
      ? ((rawIdl as Record<string, unknown>).instructions as unknown[]).length 
      : 0,
    accountCount: Array.isArray((rawIdl as Record<string, unknown>)?.accounts) 
      ? ((rawIdl as Record<string, unknown>).accounts as unknown[]).length 
      : 0,
    typeCount: Array.isArray((rawIdl as Record<string, unknown>)?.types) 
      ? ((rawIdl as Record<string, unknown>).types as unknown[]).length 
      : 0
  });
  
  try {
    // Step 1: Add root-level address field from metadata.address
    console.log('--- Step 1: Processing root-level address field ---');
    const withAddress = addRootAddressField(rawIdl as Record<string, unknown>);
    console.log('Address processing result:', {
      hasRootAddress: !!withAddress.address,
      addressValue: withAddress.address
    });
    
    // Step 2: Fix type compatibility (publicKey → pubkey)
    console.log('--- Step 2: Processing type compatibility ---');
    const withFixedTypes = fixTypeCompatibility(withAddress);
    console.log('Type compatibility processing completed');
    
    // Step 3: Fix defined types format and account structure
    console.log('--- Step 3: Processing defined types format and account structure ---');
    const withFixedDefinedTypes = fixDefinedTypesFormat(withFixedTypes as Record<string, unknown>);
    console.log('Defined types and account structure processing completed');
    
    // Final validation and logging
    console.log('--- Final IDL Processing Summary ---');
    const finalIdl = withFixedDefinedTypes as anchor.Idl;
    console.log('Final IDL summary:', {
      version: (finalIdl as unknown as { version?: string }).version,
      name: (finalIdl as unknown as { name?: string }).name,
      address: (finalIdl as unknown as { address?: string }).address,
      instructionCount: finalIdl.instructions?.length || 0,
      accountCount: finalIdl.accounts?.length || 0,
      typeCount: finalIdl.types?.length || 0,
      instructionNames: finalIdl.instructions?.map(i => i.name) || [],
      accountNames: finalIdl.accounts?.map(a => a.name) || [],
      typeNames: finalIdl.types?.map(t => t.name) || []
    });
    
    console.log('=== IDL processing completed successfully ===');
    
    // Only log full structure in debug mode or when explicitly requested
    if (process.env.NODE_ENV === 'development' || process.env.VITE_DEBUG_IDL === 'true') {
      console.log('Full processed IDL structure:', JSON.stringify(finalIdl, null, 2));
    }
    
    return finalIdl;
  } catch (error) {
    console.error('=== IDL processing failed ===');
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      step: error instanceof IDLProcessingError ? error.step : 'unknown',
      code: error instanceof IDLProcessingError ? error.code : undefined
    });
    console.log('Raw IDL structure at failure:', JSON.stringify(rawIdl, null, 2));
    
    // Add context about what was being processed
    if (error instanceof IDLProcessingError) {
      console.error(`Processing failed at step: ${error.step}`);
      console.error('Suggested fix: Check IDL structure matches Anchor v0.32.1 requirements');
    }
    
    throw error;
  }
}

// Step 1: Add root-level address field validation and processing
function addRootAddressField(rawIdl: Record<string, unknown>): Record<string, unknown> {
  console.log('Processing root-level address field...');
  
  // Check if address already exists at root level
  if (rawIdl.address) {
    console.log('✓ Root-level address field already exists:', rawIdl.address);
    console.log('Address validation: Valid PublicKey format');
    return rawIdl;
  }
  
  console.log('Root-level address field not found, checking metadata...');
  
  // Try to get address from metadata
  const metadata = rawIdl.metadata as { address?: string } | undefined;
  const metadataAddress = metadata?.address;
  
  console.log('Metadata structure:', {
    hasMetadata: !!metadata,
    hasMetadataAddress: !!metadataAddress,
    metadataAddress: metadataAddress
  });
  
  if (!metadataAddress) {
    console.error('✗ Address field validation failed');
    const error = IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {});
    console.error('Suggested fix:', IDLErrorFactory.getSuggestedFix(error));
    throw error;
  }
  
  console.log('✓ Copying address from metadata.address to root level:', metadataAddress);
  
  const result = {
    ...rawIdl,
    address: metadataAddress
  };
  
  console.log('Address field processing completed successfully');
  return result;
}

// Step 2: Fix type compatibility for Anchor v0.32.1
function fixTypeCompatibility(idlObj: unknown): unknown {
  console.log('Processing type compatibility (publicKey → pubkey)...');
  
  let publicKeyCount = 0;
  let conversionCount = 0;
  
  const fixTypes = (obj: unknown, path = ''): unknown => {
    if (typeof obj === "string") {
      if (obj === "publicKey") {
        publicKeyCount++;
        conversionCount++;
        console.log(`  Converting publicKey → pubkey at path: ${path}`);
        return "pubkey";
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item, index) => fixTypes(item, `${path}[${index}]`));
    }
    if (obj && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        out[k] = fixTypes(v, path ? `${path}.${k}` : k);
      }
      return out;
    }
    return obj;
  };
  
  const result = fixTypes(idlObj);
  
  console.log('✓ Type compatibility processing completed:', {
    publicKeyFieldsFound: publicKeyCount,
    conversionsPerformed: conversionCount,
    status: conversionCount > 0 ? 'conversions applied' : 'no conversions needed'
  });
  
  return result;
}

// Step 3: Fix defined types format and restructure accounts for Anchor v0.32.1
function fixDefinedTypesFormat(idlObj: Record<string, unknown>): Record<string, unknown> {
  console.log('Processing defined types format and account structure...');
  
  let definedTypeCount = 0;
  
  // First, scan for defined types and fix format
  const fixDefinedTypes = (obj: unknown): unknown => {
    if (typeof obj === "string") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(fixDefinedTypes);
    }
    if (obj && typeof obj === "object") {
      const objRecord = obj as Record<string, unknown>;
      const fixed: Record<string, unknown> = {};
      
      for (const [k, v] of Object.entries(objRecord)) {
        if (k === "defined" && typeof v === "string") {
          definedTypeCount++;
          console.log(`  Converting defined type: "${v}" from string to object format`);
          // Convert "defined": "TypeName" to "defined": {"name": "TypeName"}
          fixed[k] = { name: v };
        } else {
          fixed[k] = fixDefinedTypes(v);
        }
      }
      return fixed;
    }
    return obj;
  };
  
  // Apply defined type fixes
  const withFixedDefinedTypes = fixDefinedTypes(idlObj) as Record<string, unknown>;
  
  // Step 4: Restructure accounts and add discriminators (following Rule #30)
  console.log('--- Step 4: Restructuring accounts and adding discriminators ---');
  
  const accounts = withFixedDefinedTypes.accounts as Array<Record<string, unknown>> || [];
  const existingTypes = withFixedDefinedTypes.types as Array<Record<string, unknown>> || [];
  const accountTypes: Array<Record<string, unknown>> = [];
  
  const fixedAccounts = accounts.map((account, index) => {
    if (account.type && !account.discriminator) {
      // Move account type definition to types array
      accountTypes.push({
        name: account.name,
        type: account.type
      });
      
      // Create discriminator (8-byte array) - following Rule #30 pattern
      const discriminator = new Array(8).fill(0);
      discriminator[0] = index + 1;
      
      console.log(`  Restructured account: ${account.name} (moved type to types array, added discriminator [${discriminator.join(', ')}])`);
      
      // Return account with only name and discriminator
      return {
        name: account.name,
        discriminator
      };
    }
    return account;
  });
  
  const finalIdl = {
    ...withFixedDefinedTypes,
    accounts: fixedAccounts,
    types: [...existingTypes, ...accountTypes]
  };
  
  console.log('✓ Defined types and account structure processing completed:', {
    definedTypesFound: definedTypeCount,
    definedTypesConverted: definedTypeCount,
    accountsRestructured: accountTypes.length,
    totalTypesAfter: finalIdl.types.length,
    status: 'converted to Anchor v0.32.1 format with discriminators'
  });
  
  return finalIdl;
}

// Program creation validation function
function validateProgramCreation(processedIdl: anchor.Idl, provider: anchor.AnchorProvider): anchor.Program {
  console.log('=== Starting Program Creation Validation ===');
  
  try {
    // Step 1: Validate processed IDL has required fields for program creation
    console.log('--- Step 1: Validating processed IDL for program creation ---');
    
    if (!processedIdl.address) {
      throw IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'Processed IDL missing address field required for program creation',
        cause: new Error('IDL address field is required for Anchor Program constructor')
      });
    }
    
    if (!processedIdl.instructions || !Array.isArray(processedIdl.instructions)) {
      throw IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'Processed IDL missing or invalid instructions array',
        cause: new Error('IDL instructions field must be an array')
      });
    }
    
    console.log('✓ Processed IDL validation passed:', {
      address: processedIdl.address,
      instructionCount: processedIdl.instructions.length,
      accountCount: processedIdl.accounts?.length || 0,
      typeCount: processedIdl.types?.length || 0
    });
    
    // Step 2: Attempt program creation with comprehensive error handling
    console.log('--- Step 2: Creating Anchor Program instance ---');
    
    let program: anchor.Program;
    try {
      program = new anchor.Program(processedIdl, provider);
      console.log('✓ Anchor Program constructor succeeded');
    } catch (constructorError) {
      console.error('✗ Anchor Program constructor failed:', constructorError);
      
      // Provide detailed error context
      const errorMessage = constructorError instanceof Error ? constructorError.message : String(constructorError);
      console.error('Constructor error details:', {
        message: errorMessage,
        idlAddress: processedIdl.address,
        providerConnection: !!provider.connection,
        providerWallet: !!provider.wallet
      });
      
      throw IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: `Anchor Program constructor failed: ${errorMessage}`,
        cause: constructorError instanceof Error ? constructorError : new Error(String(constructorError))
      });
    }
    
    // Step 3: Validate program basic properties
    console.log('--- Step 3: Validating program basic properties ---');
    
    if (!program.programId) {
      throw IDLErrorFactory.createError(ERROR_CODES.PROGRAM_VALIDATION_FAILED, {
        message: 'Program created but missing programId property',
        validationStep: 'validateProgramProperties'
      });
    }
    
    if (!program.methods) {
      throw IDLErrorFactory.createError(ERROR_CODES.PROGRAM_VALIDATION_FAILED, {
        message: 'Program created but missing methods property',
        validationStep: 'validateProgramProperties'
      });
    }
    
    if (!program.account) {
      throw IDLErrorFactory.createError(ERROR_CODES.PROGRAM_VALIDATION_FAILED, {
        message: 'Program created but missing account property',
        validationStep: 'validateProgramProperties'
      });
    }
    
    // Step 4: Log program creation success with details
    console.log('--- Step 4: Program creation validation completed ---');
    
    const programAddress = program.programId.toBase58();
    const methodNames = Object.keys(program.methods);
    const accountNames = Object.keys(program.account);
    
    console.log('✓ Program creation validation successful:', {
      programAddress,
      methodCount: methodNames.length,
      accountCount: accountNames.length,
      providerCluster: provider.connection.rpcEndpoint,
      idlVersion: (processedIdl as unknown as { version?: string }).version
    });
    
    console.log('Program address:', programAddress);
    console.log('Available methods:', methodNames);
    console.log('Available accounts:', accountNames);
    
    // Step 5: Perform quick health check
    console.log('--- Step 5: Quick program health check ---');
    const isHealthy = quickProgramHealthCheck(program);
    if (!isHealthy) {
      console.log('⚠ Quick health check failed - program may have issues');
      console.log('Consider running performProgramHealthCheck() for detailed diagnostics');
    } else {
      console.log('✓ Quick health check passed');
    }
    
    console.log('=== Program Creation Validation Completed Successfully ===');
    
    return program;
    
  } catch (error) {
    console.error('=== Program Creation Validation Failed ===');
    
    if (error instanceof IDLProcessingError) {
      console.error('Program creation error details:', {
        name: error.name,
        message: error.message,
        step: error.step,
        code: error.code,
        suggestedFix: IDLErrorFactory.getSuggestedFix(error)
      });
    } else {
      console.error('Unexpected program creation error:', error);
    }
    
    // Log processed IDL structure for debugging
    console.log('Processed IDL structure at failure:', JSON.stringify(processedIdl, null, 2));
    
    throw error;
  }
}

// Method existence validation functions
export interface MethodValidationResult {
  methodExists: boolean
  methodName: string
  availableMethods: string[]
  suggestedMethod?: string
  errorMessage?: string
}

// Check if a specific method exists in the program
export function validateMethodExists(program: anchor.Program, methodName: string): MethodValidationResult {
  console.log(`--- Validating method existence: ${methodName} ---`);
  
  const availableMethods = Object.keys(program.methods);
  const methodExists = availableMethods.includes(methodName);
  
  console.log('Method validation details:', {
    requestedMethod: methodName,
    methodExists,
    totalAvailableMethods: availableMethods.length,
    availableMethods
  });
  
  const result: MethodValidationResult = {
    methodExists,
    methodName,
    availableMethods
  };
  
  if (!methodExists) {
    // Try to suggest a similar method name
    const suggestedMethod = suggestAlternativeMethod(methodName, availableMethods);
    result.suggestedMethod = suggestedMethod;
    result.errorMessage = `Method "${methodName}" not found in program. Available methods: ${availableMethods.join(', ')}`;
    
    if (suggestedMethod) {
      result.errorMessage += `. Did you mean "${suggestedMethod}"?`;
    }
    
    console.log('✗ Method not found:', {
      requestedMethod: methodName,
      suggestedMethod,
      availableMethods
    });
  } else {
    console.log('✓ Method found:', methodName);
  }
  
  return result;
}

// Get all available methods from the program
export function getAvailableMethods(program: anchor.Program): string[] {
  const methods = Object.keys(program.methods);
  console.log('Available program methods:', {
    count: methods.length,
    methods
  });
  return methods;
}

// Suggest alternative method names based on similarity
function suggestAlternativeMethod(requestedMethod: string, availableMethods: string[]): string | null {
  if (availableMethods.length === 0) {
    return null;
  }
  
  const requestedLower = requestedMethod.toLowerCase();
  
  // First, try exact case-insensitive match
  const exactMatch = availableMethods.find(method => method.toLowerCase() === requestedLower);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Then try partial matches (contains)
  const partialMatches = availableMethods.filter(method => 
    method.toLowerCase().includes(requestedLower) || requestedLower.includes(method.toLowerCase())
  );
  
  if (partialMatches.length > 0) {
    return partialMatches[0];
  }
  
  // Finally, try Levenshtein distance for similar names
  let bestMatch = availableMethods[0];
  let bestDistance = levenshteinDistance(requestedLower, bestMatch.toLowerCase());
  
  for (const method of availableMethods.slice(1)) {
    const distance = levenshteinDistance(requestedLower, method.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = method;
    }
  }
  
  // Only suggest if the distance is reasonable (less than half the length)
  if (bestDistance <= Math.max(requestedMethod.length, bestMatch.length) / 2) {
    return bestMatch;
  }
  
  return null;
}

// Simple Levenshtein distance calculation for method name suggestions
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Validate multiple methods at once
export function validateMultipleMethods(program: anchor.Program, methodNames: string[]): Record<string, MethodValidationResult> {
  console.log(`--- Validating multiple methods: ${methodNames.join(', ')} ---`);
  
  const results: Record<string, MethodValidationResult> = {};
  
  for (const methodName of methodNames) {
    results[methodName] = validateMethodExists(program, methodName);
  }
  
  const validMethods = Object.values(results).filter(r => r.methodExists).length;
  const invalidMethods = methodNames.length - validMethods;
  
  console.log('Multiple method validation summary:', {
    totalRequested: methodNames.length,
    validMethods,
    invalidMethods,
    allValid: invalidMethods === 0
  });
  
  return results;
}

// Program health check functionality
export interface ProgramHealthCheckResult {
  isHealthy: boolean
  programAddress: string
  networkEndpoint: string
  checks: {
    programExists: boolean
    methodsAccessible: boolean
    accountsAccessible: boolean
    idlValid: boolean
    providerConnected: boolean
  }
  methodCount: number
  accountCount: number
  availableMethods: string[]
  availableAccounts: string[]
  errors: string[]
  warnings: string[]
  timestamp: number
}

// Comprehensive program health check
export async function performProgramHealthCheck(program: anchor.Program): Promise<ProgramHealthCheckResult> {
  console.log('=== Starting Program Health Check ===');
  
  const startTime = Date.now();
  const provider = program.provider as anchor.AnchorProvider;
  
  const result: ProgramHealthCheckResult = {
    isHealthy: true,
    programAddress: program.programId.toBase58(),
    networkEndpoint: provider.connection.rpcEndpoint,
    checks: {
      programExists: false,
      methodsAccessible: false,
      accountsAccessible: false,
      idlValid: false,
      providerConnected: false
    },
    methodCount: 0,
    accountCount: 0,
    availableMethods: [],
    availableAccounts: [],
    errors: [],
    warnings: [],
    timestamp: startTime
  };
  
  try {
    // Check 1: Provider connection
    console.log('--- Check 1: Provider Connection ---');
    try {
      const slot = await provider.connection.getSlot();
      result.checks.providerConnected = true;
      console.log('✓ Provider connection healthy, current slot:', slot);
    } catch (error) {
      result.checks.providerConnected = false;
      result.isHealthy = false;
      const errorMsg = `Provider connection failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error('✗ Provider connection failed:', error);
    }
    
    // Check 2: Program exists on network
    console.log('--- Check 2: Program Existence ---');
    try {
      const programAccount = await provider.connection.getAccountInfo(program.programId);
      if (programAccount) {
        result.checks.programExists = true;
        console.log('✓ Program account exists on network:', {
          address: program.programId.toBase58(),
          owner: programAccount.owner.toBase58(),
          executable: programAccount.executable,
          dataLength: programAccount.data.length
        });
        
        if (!programAccount.executable) {
          result.warnings.push('Program account exists but is not marked as executable');
        }
      } else {
        result.checks.programExists = false;
        result.isHealthy = false;
        result.errors.push('Program account not found on network');
        console.error('✗ Program account not found on network');
      }
    } catch (error) {
      result.checks.programExists = false;
      result.isHealthy = false;
      const errorMsg = `Failed to check program existence: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error('✗ Failed to check program existence:', error);
    }
    
    // Check 3: IDL validity
    console.log('--- Check 3: IDL Validity ---');
    try {
      const idl = (program as unknown as { idl?: anchor.Idl }).idl;
      if (idl) {
        result.checks.idlValid = true;
        console.log('✓ IDL is accessible and valid:', {
          version: (idl as unknown as { version?: string }).version,
          name: (idl as unknown as { name?: string }).name,
          address: (idl as unknown as { address?: string }).address,
          instructionCount: idl.instructions?.length || 0,
          accountCount: idl.accounts?.length || 0,
          typeCount: idl.types?.length || 0
        });
      } else {
        result.checks.idlValid = false;
        result.isHealthy = false;
        result.errors.push('IDL not accessible from program instance');
        console.error('✗ IDL not accessible from program instance');
      }
    } catch (error) {
      result.checks.idlValid = false;
      result.isHealthy = false;
      const errorMsg = `IDL validation failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error('✗ IDL validation failed:', error);
    }
    
    // Check 4: Methods accessibility
    console.log('--- Check 4: Methods Accessibility ---');
    try {
      const methods = Object.keys(program.methods);
      result.availableMethods = methods;
      result.methodCount = methods.length;
      
      if (methods.length > 0) {
        result.checks.methodsAccessible = true;
        console.log('✓ Program methods accessible:', {
          count: methods.length,
          methods: methods
        });
        
        // Test a few method objects to ensure they're properly formed
        let validMethodCount = 0;
        for (const methodName of methods.slice(0, 3)) { // Test first 3 methods
          try {
            const method = (program.methods as Record<string, unknown>)[methodName];
            if (method && typeof method === 'object') {
              validMethodCount++;
            }
          } catch (error) {
            result.warnings.push(`Method ${methodName} may not be properly accessible: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        if (validMethodCount === 0 && methods.length > 0) {
          result.warnings.push('Methods exist but may not be properly accessible');
        }
      } else {
        result.checks.methodsAccessible = false;
        result.warnings.push('No methods found in program - this may be expected for some programs');
        console.log('⚠ No methods found in program');
      }
    } catch (error) {
      result.checks.methodsAccessible = false;
      result.isHealthy = false;
      const errorMsg = `Methods accessibility check failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error('✗ Methods accessibility check failed:', error);
    }
    
    // Check 5: Accounts accessibility
    console.log('--- Check 5: Accounts Accessibility ---');
    try {
      const accounts = Object.keys(program.account);
      result.availableAccounts = accounts;
      result.accountCount = accounts.length;
      
      if (accounts.length > 0) {
        result.checks.accountsAccessible = true;
        console.log('✓ Program accounts accessible:', {
          count: accounts.length,
          accounts: accounts
        });
        
        // Test a few account clients to ensure they're properly formed
        let validAccountCount = 0;
        for (const accountName of accounts.slice(0, 3)) { // Test first 3 accounts
          try {
            const accountClient = (program.account as Record<string, unknown>)[accountName];
            if (accountClient && typeof accountClient === 'object') {
              validAccountCount++;
            }
          } catch (error) {
            result.warnings.push(`Account ${accountName} may not be properly accessible: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        if (validAccountCount === 0 && accounts.length > 0) {
          result.warnings.push('Accounts exist but may not be properly accessible');
        }
      } else {
        result.checks.accountsAccessible = false;
        result.warnings.push('No accounts found in program - this may be expected for some programs');
        console.log('⚠ No accounts found in program');
      }
    } catch (error) {
      result.checks.accountsAccessible = false;
      result.isHealthy = false;
      const errorMsg = `Accounts accessibility check failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error('✗ Accounts accessibility check failed:', error);
    }
    
    // Final health assessment
    const checksCompleted = Object.values(result.checks).filter(Boolean).length;
    const totalChecks = Object.keys(result.checks).length;
    
    console.log('--- Health Check Summary ---');
    console.log('Health check results:', {
      isHealthy: result.isHealthy,
      checksCompleted: `${checksCompleted}/${totalChecks}`,
      methodCount: result.methodCount,
      accountCount: result.accountCount,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      duration: `${Date.now() - startTime}ms`
    });
    
    if (result.isHealthy) {
      console.log('✓ Program health check PASSED - Program is healthy and ready for use');
    } else {
      console.log('✗ Program health check FAILED - Issues detected:');
      result.errors.forEach(error => console.log(`  - ERROR: ${error}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('⚠ Warnings detected:');
      result.warnings.forEach(warning => console.log(`  - WARNING: ${warning}`));
    }
    
    console.log('=== Program Health Check Completed ===');
    
    return result;
    
  } catch (error) {
    console.error('=== Program Health Check Failed with Exception ===');
    console.error('Health check exception:', error);
    
    result.isHealthy = false;
    result.errors.push(`Health check failed with exception: ${error instanceof Error ? error.message : String(error)}`);
    
    return result;
  }
}

// Quick health check for basic program validation
export function quickProgramHealthCheck(program: anchor.Program): boolean {
  try {
    // Basic checks that should always pass for a valid program
    const hasProgram = !!program;
    const hasProgramId = !!program.programId;
    const hasMethods = !!program.methods && typeof program.methods === 'object';
    const hasAccount = !!program.account && typeof program.account === 'object';
    const hasProvider = !!program.provider;
    
    const isHealthy = hasProgram && hasProgramId && hasMethods && hasAccount && hasProvider;
    
    console.log('Quick health check:', {
      hasProgram,
      hasProgramId,
      hasMethods,
      hasAccount,
      hasProvider,
      isHealthy
    });
    
    return isHealthy;
  } catch (error) {
    console.error('Quick health check failed:', error);
    return false;
  }
}

async function sha256First8(input: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return new Uint8Array(digest).slice(0, 8);
}

export function derivePdas(user?: PublicKey | null) {
  const enc = new TextEncoder();
  const [config] = PublicKey.findProgramAddressSync([enc.encode("config")], PROGRAM_ID);
  const [vault] = PublicKey.findProgramAddressSync([enc.encode("vault")], PROGRAM_ID);
  const license = user
    ? PublicKey.findProgramAddressSync([enc.encode("license"), user.toBytes()], PROGRAM_ID)[0]
    : null;
  const userDeposit = user
    ? PublicKey.findProgramAddressSync([enc.encode("user"), user.toBytes()], PROGRAM_ID)[0]
    : null;
  const userHistory = user
    ? PublicKey.findProgramAddressSync([enc.encode("history"), user.toBytes()], PROGRAM_ID)[0]
    : null;
  return { config, vault, userDeposit, userHistory, license };
}

export function accounts(program: anchor.Program) {
  const pa = program.account as unknown as Record<string, anchor.AccountClient>;
  return {
    config: pa["config"],
    userLicense: pa["userLicense"],
    // userDeposit may be undefined if not present in the IDL; callers should handle errors.
    userDeposit: pa["userDeposit"] as anchor.AccountClient | undefined,
  };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Safe account fetch with owner preflight to avoid invalid discriminator errors
export async function safeFetchAccount<T = unknown>(
  program: anchor.Program,
  client: anchor.AccountClient,
  address: PublicKey
): Promise<T> {
  const info = await program.provider.connection.getAccountInfo(address);
  if (!info) throw new Error("Account not found");
  if (!info.owner.equals(PROGRAM_ID)) throw new Error("Account owned by different program");
  const data = await client.fetch(address);
  return data as T;
}

// Instruction wrappers mapped to IDL
export async function initializeConfig(
  program: anchor.Program,
  dev: PublicKey,
  config: PublicKey,
  vault: PublicKey,
  args: {
    admin: PublicKey;
    marketer1: PublicKey;
    marketer2: PublicKey;
    usdtPriceCents: anchor.BN;
    durationDays: number; // u16
    usdtMint: PublicKey;
  }
) {
  return program.methods
    .initializeConfig(
      args.admin,
      args.marketer1,
      args.marketer2,
      args.usdtPriceCents,
      args.durationDays,
      args.usdtMint
    )
    .accounts({ dev, config, vault, systemProgram: SystemProgram.programId })
    .rpc();
}

// ATA creation error types for enhanced error handling
class ATACreationError extends Error {
  constructor(
    message: string, 
    public ataType: 'user' | 'vault',
    public ataAddress: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ATACreationError';
  }

  getSuggestedFix(): string {
    return `Fix ATA creation for ${this.ataType} ATA (${this.ataAddress}):\n` +
           '1. Ensure sufficient SOL balance for account creation rent\n' +
           '2. Verify mint address is valid and exists on the network\n' +
           '3. Check that the owner address is valid\n' +
           '4. Ensure network connection is stable\n' +
           `5. For vault ATA: Verify PDA derivation is correct and allowOwnerOffCurve is true`;
  }
}

class ATAValidationError extends Error {
  constructor(
    message: string,
    public ataType: 'user' | 'vault',
    public ataAddress: string,
    public validationStep: string
  ) {
    super(message);
    this.name = 'ATAValidationError';
  }

  getSuggestedFix(): string {
    return `Fix ATA validation for ${this.ataType} ATA (${this.ataAddress}):\n` +
           '1. Verify ATA address is derived correctly using getAssociatedTokenAddressSync\n' +
           '2. Check that mint and owner addresses are valid\n' +
           '3. Ensure ATA follows SPL Token standards\n' +
           '4. For vault ATA: Use allowOwnerOffCurve=true for PDA owners';
  }
}

// Account validation interfaces and types for deposit transactions
interface AccountValidationResult {
  isValid: boolean
  validAccounts: string[]
  invalidAccounts: string[]
  missingAccounts: string[]
  invalidOwners: string[]
  creationRequired: {
    userAta: boolean
    vaultAta: boolean
  }
  errors: string[]
  warnings: string[]
}

// ATA creation result interface
interface ATACreationResult {
  success: boolean
  userAtaCreated: boolean
  vaultAtaCreated: boolean
  transactionSignature?: string
  errors: string[]
  warnings: string[]
}

// Deposit transaction safety interface
interface DepositTransactionResult {
  success: boolean
  transactionSignature?: string
  ataCreationSignature?: string
  errors: string[]
  warnings: string[]
  cleanup?: {
    required: boolean
    actions: string[]
  }
}

// Transaction safety error types
class DepositTransactionError extends Error {
  constructor(
    message: string,
    public stage: 'validation' | 'ata_creation' | 'deposit_execution' | 'cleanup',
    public cause?: Error,
    public cleanup?: { required: boolean; actions: string[] }
  ) {
    super(message);
    this.name = 'DepositTransactionError';
  }

  getSuggestedFix(): string {
    switch (this.stage) {
      case 'validation':
        return 'Fix validation issues:\n' +
               '1. Verify all account addresses are valid\n' +
               '2. Check PDA derivations are correct\n' +
               '3. Ensure sufficient balance for transaction';
      case 'ata_creation':
        return 'Fix ATA creation issues:\n' +
               '1. Ensure sufficient SOL for rent\n' +
               '2. Verify mint and owner addresses\n' +
               '3. Check network connectivity';
      case 'deposit_execution':
        return 'Fix deposit execution issues:\n' +
               '1. Verify program method exists\n' +
               '2. Check account permissions\n' +
               '3. Ensure sufficient token balance\n' +
               '4. Validate transaction size limits';
      case 'cleanup':
        return 'Handle cleanup after failure:\n' +
               '1. Check if partial state needs reverting\n' +
               '2. Verify account states are consistent\n' +
               '3. Consider retrying the operation';
      default:
        return 'Check transaction parameters and network connectivity';
    }
  }
}

interface DepositTransactionParams {
  user: PublicKey
  program: anchor.Program
  pdas: {
    config: PublicKey
    vault: PublicKey
    userDeposit: PublicKey
    userHistory: PublicKey
  }
  atAs: {
    mint: PublicKey
    userAta: PublicKey
    vaultAta: PublicKey
  }
  amount: anchor.BN
  validateBeforeExecution: boolean
}

// Comprehensive account validation for deposit transactions
async function validateDepositAccounts(
  connection: anchor.web3.Connection,
  params: DepositTransactionParams
): Promise<AccountValidationResult> {
  console.log('=== Starting comprehensive deposit account validation ===');
  
  const result: AccountValidationResult = {
    isValid: true,
    validAccounts: [],
    invalidAccounts: [],
    missingAccounts: [],
    invalidOwners: [],
    creationRequired: {
      userAta: false,
      vaultAta: false
    },
    errors: [],
    warnings: []
  };

  try {
    // Step 1: Validate all PublicKey parameters are valid addresses
    console.log('--- Step 1: Validating PublicKey parameters ---');
    
    const publicKeyValidations = [
      { name: 'user', key: params.user },
      { name: 'config', key: params.pdas.config },
      { name: 'vault', key: params.pdas.vault },
      { name: 'userDeposit', key: params.pdas.userDeposit },
      { name: 'userHistory', key: params.pdas.userHistory },
      { name: 'mint', key: params.atAs.mint },
      { name: 'userAta', key: params.atAs.userAta },
      { name: 'vaultAta', key: params.atAs.vaultAta }
    ];

    for (const validation of publicKeyValidations) {
      try {
        // Validate PublicKey is valid
        if (!validation.key || !PublicKey.isOnCurve(validation.key.toBytes())) {
          result.errors.push(`Invalid PublicKey for ${validation.name}: not on curve`);
          result.invalidAccounts.push(validation.name);
          result.isValid = false;
        } else {
          result.validAccounts.push(validation.name);
          console.log(`✓ ${validation.name}: ${validation.key.toBase58()}`);
        }
      } catch (error) {
        result.errors.push(`Invalid PublicKey for ${validation.name}: ${error instanceof Error ? error.message : String(error)}`);
        result.invalidAccounts.push(validation.name);
        result.isValid = false;
      }
    }

    // Step 2: Check that PDAs are derived correctly
    console.log('--- Step 2: Validating PDA derivations ---');
    
    try {
      const expectedConfig = PublicKey.findProgramAddressSync(
        [Buffer.from("config", "utf8")], 
        params.program.programId
      )[0];
      
      if (!expectedConfig.equals(params.pdas.config)) {
        result.errors.push(`Config PDA mismatch. Expected: ${expectedConfig.toBase58()}, Got: ${params.pdas.config.toBase58()}`);
        result.invalidAccounts.push('config');
        result.isValid = false;
      } else {
        console.log('✓ Config PDA derivation correct');
      }
    } catch (error) {
      result.errors.push(`Config PDA validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('config');
      result.isValid = false;
    }

    try {
      const expectedVault = PublicKey.findProgramAddressSync(
        [Buffer.from("vault", "utf8")], 
        params.program.programId
      )[0];
      
      if (!expectedVault.equals(params.pdas.vault)) {
        result.errors.push(`Vault PDA mismatch. Expected: ${expectedVault.toBase58()}, Got: ${params.pdas.vault.toBase58()}`);
        result.invalidAccounts.push('vault');
        result.isValid = false;
      } else {
        console.log('✓ Vault PDA derivation correct');
      }
    } catch (error) {
      result.errors.push(`Vault PDA validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('vault');
      result.isValid = false;
    }

    try {
      const expectedUserDeposit = PublicKey.findProgramAddressSync(
        [Buffer.from("user", "utf8"), params.user.toBytes()], 
        params.program.programId
      )[0];
      
      if (!expectedUserDeposit.equals(params.pdas.userDeposit)) {
        result.errors.push(`UserDeposit PDA mismatch. Expected: ${expectedUserDeposit.toBase58()}, Got: ${params.pdas.userDeposit.toBase58()}`);
        result.invalidAccounts.push('userDeposit');
        result.isValid = false;
      } else {
        console.log('✓ UserDeposit PDA derivation correct');
      }
    } catch (error) {
      result.errors.push(`UserDeposit PDA validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('userDeposit');
      result.isValid = false;
    }

    try {
      const expectedUserHistory = PublicKey.findProgramAddressSync(
        [Buffer.from("history", "utf8"), params.user.toBytes()], 
        params.program.programId
      )[0];
      
      if (!expectedUserHistory.equals(params.pdas.userHistory)) {
        result.errors.push(`UserHistory PDA mismatch. Expected: ${expectedUserHistory.toBase58()}, Got: ${params.pdas.userHistory.toBase58()}`);
        result.invalidAccounts.push('userHistory');
        result.isValid = false;
      } else {
        console.log('✓ UserHistory PDA derivation correct');
      }
    } catch (error) {
      result.errors.push(`UserHistory PDA validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('userHistory');
      result.isValid = false;
    }

    // Step 3: Validate account ownership before transaction
    console.log('--- Step 3: Validating account ownership and existence ---');
    
    // Check mint account
    try {
      const mintInfo = await connection.getAccountInfo(params.atAs.mint);
      if (!mintInfo) {
        result.errors.push(`Mint account does not exist: ${params.atAs.mint.toBase58()}`);
        result.missingAccounts.push('mint');
        result.isValid = false;
      } else if (!mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        result.errors.push(`Mint account not owned by Token Program. Owner: ${mintInfo.owner.toBase58()}`);
        result.invalidOwners.push('mint');
        result.isValid = false;
      } else {
        console.log('✓ Mint account exists and owned by Token Program');
      }
    } catch (error) {
      result.errors.push(`Mint account validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('mint');
      result.isValid = false;
    }

    // Check user ATA
    try {
      const userAtaInfo = await connection.getAccountInfo(params.atAs.userAta);
      if (!userAtaInfo) {
        result.warnings.push(`User ATA does not exist, will need to be created: ${params.atAs.userAta.toBase58()}`);
        result.creationRequired.userAta = true;
        console.log('⚠ User ATA needs to be created');
      } else if (!userAtaInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        result.errors.push(`User ATA not owned by Token Program. Owner: ${userAtaInfo.owner.toBase58()}`);
        result.invalidOwners.push('userAta');
        result.isValid = false;
      } else {
        console.log('✓ User ATA exists and owned by Token Program');
      }
    } catch (error) {
      result.errors.push(`User ATA validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('userAta');
      result.isValid = false;
    }

    // Check vault ATA
    try {
      const vaultAtaInfo = await connection.getAccountInfo(params.atAs.vaultAta);
      if (!vaultAtaInfo) {
        result.warnings.push(`Vault ATA does not exist, will need to be created: ${params.atAs.vaultAta.toBase58()}`);
        result.creationRequired.vaultAta = true;
        console.log('⚠ Vault ATA needs to be created');
      } else if (!vaultAtaInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        result.errors.push(`Vault ATA not owned by Token Program. Owner: ${vaultAtaInfo.owner.toBase58()}`);
        result.invalidOwners.push('vaultAta');
        result.isValid = false;
      } else {
        console.log('✓ Vault ATA exists and owned by Token Program');
      }
    } catch (error) {
      result.errors.push(`Vault ATA validation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.invalidAccounts.push('vaultAta');
      result.isValid = false;
    }

    // Step 4: Validate amount parameter
    console.log('--- Step 4: Validating transaction amount ---');
    
    if (!params.amount || params.amount.lte(new anchor.BN(0))) {
      result.errors.push(`Invalid deposit amount: ${params.amount?.toString() || 'undefined'}`);
      result.isValid = false;
    } else {
      console.log(`✓ Deposit amount valid: ${params.amount.toString()}`);
    }

    console.log('=== Account validation completed ===');
    console.log('Validation summary:', {
      isValid: result.isValid,
      validAccounts: result.validAccounts.length,
      invalidAccounts: result.invalidAccounts.length,
      missingAccounts: result.missingAccounts.length,
      invalidOwners: result.invalidOwners.length,
      ataCreationRequired: result.creationRequired.userAta || result.creationRequired.vaultAta,
      errors: result.errors.length,
      warnings: result.warnings.length
    });

    return result;

  } catch (error) {
    console.error('Account validation failed with exception:', error);
    result.errors.push(`Validation exception: ${error instanceof Error ? error.message : String(error)}`);
    result.isValid = false;
    return result;
  }
}

// Enhanced ATA creation with comprehensive error handling and validation
async function createRequiredATAs(
  connection: anchor.web3.Connection,
  user: PublicKey,
  mint: PublicKey,
  vault: PublicKey,
  userAta: PublicKey,
  vaultAta: PublicKey,
  creationRequired: { userAta: boolean; vaultAta: boolean },
  provider: anchor.AnchorProvider
): Promise<ATACreationResult> {
  console.log('=== Starting enhanced ATA creation ===');
  
  const result: ATACreationResult = {
    success: true,
    userAtaCreated: false,
    vaultAtaCreated: false,
    errors: [],
    warnings: []
  };

  try {
    // Step 1: Validate ATA addresses before creation attempts
    console.log('--- Step 1: Validating ATA addresses before creation ---');
    
    if (creationRequired.userAta) {
      try {
        const expectedUserAta = anchor.utils.token.associatedAddress({
          mint,
          owner: user
        });
        
        if (!expectedUserAta.equals(userAta)) {
          throw new ATAValidationError(
            `User ATA address mismatch. Expected: ${expectedUserAta.toBase58()}, Got: ${userAta.toBase58()}`,
            'user',
            userAta.toBase58(),
            'addressValidation'
          );
        }
        console.log('✓ User ATA address validation passed');
      } catch (error) {
        const errorMsg = error instanceof ATAValidationError 
          ? `${error.message} - ${error.getSuggestedFix()}`
          : `User ATA validation failed: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    if (creationRequired.vaultAta) {
      try {
        const expectedVaultAta = anchor.utils.token.associatedAddress({
          mint,
          owner: vault
        });
        
        if (!expectedVaultAta.equals(vaultAta)) {
          throw new ATAValidationError(
            `Vault ATA address mismatch. Expected: ${expectedVaultAta.toBase58()}, Got: ${vaultAta.toBase58()}`,
            'vault',
            vaultAta.toBase58(),
            'addressValidation'
          );
        }
        console.log('✓ Vault ATA address validation passed');
      } catch (error) {
        const errorMsg = error instanceof ATAValidationError 
          ? `${error.message} - ${error.getSuggestedFix()}`
          : `Vault ATA validation failed: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    if (!result.success) {
      return result;
    }

    // Step 2: Create ATAs if needed with enhanced error handling
    if (creationRequired.userAta || creationRequired.vaultAta) {
      console.log('--- Step 2: Creating required ATAs ---');
      
      const preTx = new Transaction();
      
      if (creationRequired.userAta) {
        console.log(`Creating user ATA: ${userAta.toBase58()}`);
        try {
          const createUserAtaIx = createAssociatedTokenAccountInstruction(
            user, // payer
            userAta, // ata
            user, // owner
            mint // mint
          );
          preTx.add(createUserAtaIx);
          console.log('✓ User ATA creation instruction added');
        } catch (error) {
          throw new ATACreationError(
            `Failed to create user ATA instruction: ${error instanceof Error ? error.message : String(error)}`,
            'user',
            userAta.toBase58(),
            error instanceof Error ? error : undefined
          );
        }
      }

      if (creationRequired.vaultAta) {
        console.log(`Creating vault ATA: ${vaultAta.toBase58()}`);
        try {
          const createVaultAtaIx = createAssociatedTokenAccountInstruction(
            user, // payer
            vaultAta, // ata
            vault, // owner (PDA, off-curve allowed)
            mint // mint
          );
          preTx.add(createVaultAtaIx);
          console.log('✓ Vault ATA creation instruction added');
        } catch (error) {
          throw new ATACreationError(
            `Failed to create vault ATA instruction: ${error instanceof Error ? error.message : String(error)}`,
            'vault',
            vaultAta.toBase58(),
            error instanceof Error ? error : undefined
          );
        }
      }

      // Step 3: Send transaction with retry logic and enhanced error handling
      console.log('--- Step 3: Sending ATA creation transaction ---');
      
      try {
        console.log(`Sending transaction with ${preTx.instructions.length} instructions`);
        
        // Add transaction size validation
        const serializedSize = preTx.serialize({ requireAllSignatures: false }).length;
        if (serializedSize > 1232) { // Solana transaction size limit
          throw new ATACreationError(
            `Transaction too large: ${serializedSize} bytes (max 1232)`,
            creationRequired.userAta ? 'user' : 'vault',
            creationRequired.userAta ? userAta.toBase58() : vaultAta.toBase58()
          );
        }

        const signature = await provider.sendAndConfirm(preTx, [], { 
          skipPreflight: false,
          commitment: 'confirmed'
        });
        
        result.transactionSignature = signature;
        result.userAtaCreated = creationRequired.userAta;
        result.vaultAtaCreated = creationRequired.vaultAta;
        
        console.log('✓ ATA creation transaction successful:', signature);
        
        // Step 4: Verify ATAs were created successfully
        console.log('--- Step 4: Verifying ATA creation ---');
        
        if (creationRequired.userAta) {
          const userAtaInfo = await connection.getAccountInfo(userAta);
          if (!userAtaInfo) {
            result.warnings.push(`User ATA creation may not have completed: ${userAta.toBase58()}`);
          } else {
            console.log('✓ User ATA created and verified');
          }
        }

        if (creationRequired.vaultAta) {
          const vaultAtaInfo = await connection.getAccountInfo(vaultAta);
          if (!vaultAtaInfo) {
            result.warnings.push(`Vault ATA creation may not have completed: ${vaultAta.toBase58()}`);
          } else {
            console.log('✓ Vault ATA created and verified');
          }
        }

      } catch (error) {
        console.error('ATA creation transaction failed:', error);
        
        // Enhanced error parsing for common ATA creation failures
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorLogs = (error as { logs?: string[] })?.logs;
        
        let enhancedError: string;
        
        if (errorMessage.includes('insufficient funds')) {
          enhancedError = 'Insufficient SOL balance for ATA creation. Need ~0.00204 SOL for rent.';
        } else if (errorMessage.includes('already in use')) {
          enhancedError = 'ATA address already exists. This may indicate a race condition or duplicate creation attempt.';
        } else if (errorMessage.includes('invalid mint')) {
          enhancedError = 'Invalid mint address provided for ATA creation.';
        } else if (errorMessage.includes('invalid owner')) {
          enhancedError = 'Invalid owner address provided for ATA creation.';
        } else {
          enhancedError = `ATA creation failed: ${errorMessage}`;
        }

        if (errorLogs && errorLogs.length > 0) {
          enhancedError += `\nTransaction logs:\n${errorLogs.join('\n')}`;
        }

        const ataType = creationRequired.userAta && creationRequired.vaultAta 
          ? 'user and vault' 
          : creationRequired.userAta ? 'user' : 'vault';
        const ataAddress = creationRequired.userAta ? userAta.toBase58() : vaultAta.toBase58();

        throw new ATACreationError(
          enhancedError,
          ataType as 'user' | 'vault',
          ataAddress,
          error instanceof Error ? error : undefined
        );
      }
    } else {
      console.log('✓ No ATA creation required');
    }

    console.log('=== ATA creation completed successfully ===');
    return result;

  } catch (error) {
    console.error('ATA creation failed with exception:', error);
    
    if (error instanceof ATACreationError) {
      result.errors.push(`${error.message} - ${error.getSuggestedFix()}`);
    } else if (error instanceof ATAValidationError) {
      result.errors.push(`${error.message} - ${error.getSuggestedFix()}`);
    } else {
      result.errors.push(`ATA creation exception: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    result.success = false;
    return result;
  }
}

// Safe deposit transaction execution with comprehensive error handling and cleanup
async function executeDepositTransactionSafely(
  program: anchor.Program,
  user: PublicKey,
  pdas: { config: PublicKey; vault: PublicKey; userDeposit: PublicKey; userHistory: PublicKey },
  atAs: { mint: PublicKey; userAta: PublicKey; vaultAta: PublicKey },
  amount: anchor.BN,
  ataCreationSignature?: string
): Promise<DepositTransactionResult> {
  console.log('=== Starting safe deposit transaction execution ===');
  
  const result: DepositTransactionResult = {
    success: true,
    ataCreationSignature,
    errors: [],
    warnings: []
  };

  try {
    // Step 1: Pre-transaction validation and safety checks
    console.log('--- Step 1: Pre-transaction safety validation ---');
    
    // Validate method exists using the new validation system
    const methodValidation = validateMethodExists(program, "depositUsdt");
    if (!methodValidation.methodExists) {
      throw new DepositTransactionError(
        methodValidation.errorMessage || `Method "depositUsdt" not found in program`,
        'validation'
      );
    }
    console.log("✓ Method validation passed for depositUsdt");

    // Validate wallet can sign transactions
    const provider = program.provider as anchor.AnchorProvider;
    const canSign = !!provider?.wallet && typeof (provider.wallet as unknown as { signTransaction?: unknown }).signTransaction === 'function';
    if (!canSign) {
      throw new DepositTransactionError(
        "Wallet does not support transaction signing. Please connect a signing-capable Solana wallet.",
        'validation'
      );
    }
    console.log("✓ Wallet signing capability validated");

    // Step 2: Build transaction with size validation
    console.log('--- Step 2: Building deposit transaction ---');
    
    const accounts = {
      user,
      config: pdas.config,
      vault: pdas.vault,
      mint: atAs.mint,
      userAta: atAs.userAta,
      vaultAta: atAs.vaultAta,
      userDeposit: pdas.userDeposit,
      userHistory: pdas.userHistory,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };

    console.log("Deposit instruction accounts:", accounts);

    // Build the transaction instruction
    let depositInstruction: TransactionInstruction;
    try {
      const methodBuilder = program.methods.depositUsdt(amount).accounts(accounts);
      depositInstruction = await methodBuilder.instruction();
      console.log("✓ Deposit instruction built successfully");
    } catch (error) {
      throw new DepositTransactionError(
        `Failed to build deposit instruction: ${error instanceof Error ? error.message : String(error)}`,
        'deposit_execution',
        error instanceof Error ? error : undefined
      );
    }

    // Step 3: Transaction size validation
    console.log('--- Step 3: Transaction size validation ---');
    
    const testTx = new Transaction().add(depositInstruction);
    try {
      const serializedSize = testTx.serialize({ requireAllSignatures: false }).length;
      if (serializedSize > 1232) { // Solana transaction size limit
        throw new DepositTransactionError(
          `Deposit transaction too large: ${serializedSize} bytes (max 1232)`,
          'deposit_execution'
        );
      }
      console.log(`✓ Transaction size valid: ${serializedSize} bytes`);
    } catch (error) {
      if (error instanceof DepositTransactionError) {
        throw error;
      }
      result.warnings.push(`Could not validate transaction size: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 4: Execute deposit transaction with enhanced error handling
    console.log('--- Step 4: Executing deposit transaction ---');
    
    try {
      console.log(`Executing depositUsdt with amount: ${amount.toString()}`);
      
      // Additional debugging information
      try {
        const idlIns = (program as unknown as { idl?: { instructions?: Array<{ name: string; args?: unknown[] }> } }).idl?.instructions?.find((i) => i.name === "depositUsdt");
        console.log("IDL depositUsdt args:", idlIns?.args);
      } catch (err) {
        console.warn("Failed to inspect IDL for depositUsdt args:", err);
      }

      const signature = await program.methods
        .depositUsdt(amount)
        .accounts(accounts)
        .rpc();

      result.transactionSignature = signature;
      console.log("✓ Deposit transaction successful:", signature);

      // Step 5: Post-transaction verification
      console.log('--- Step 5: Post-transaction verification ---');
      
      try {
        // Wait for confirmation
        await provider.connection.confirmTransaction(signature, 'confirmed');
        console.log("✓ Transaction confirmed");
        
        // Optional: Verify account states after transaction
        // This could include checking token balances, account data, etc.
        result.warnings.push("Post-transaction state verification not implemented");
        
      } catch (error) {
        result.warnings.push(`Transaction confirmation failed: ${error instanceof Error ? error.message : String(error)}`);
      }

    } catch (error) {
      console.error('Deposit transaction execution failed:', error);
      
      // Enhanced error parsing for common deposit failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorLogs = (error as { logs?: string[] })?.logs;
      
      let enhancedError: string;
      let cleanupRequired = false;
      const cleanupActions: string[] = [];
      
      if (errorMessage.includes('insufficient funds')) {
        enhancedError = 'Insufficient token balance for deposit transaction.';
      } else if (errorMessage.includes('InvalidAccountData')) {
        enhancedError = 'Invalid account data. ATA may not be properly initialized.';
        cleanupRequired = true;
        cleanupActions.push('Verify ATA creation was successful');
        cleanupActions.push('Check token account initialization');
      } else if (errorMessage.includes('AccountNotFound')) {
        enhancedError = 'Required account not found. Check PDA derivations and ATA addresses.';
      } else if (errorMessage.includes('InvalidInstruction')) {
        enhancedError = 'Invalid instruction. Check method signature and account requirements.';
      } else if (errorMessage.includes('ProgramError')) {
        enhancedError = 'Program execution error. Check program state and account permissions.';
      } else {
        enhancedError = `Deposit execution failed: ${errorMessage}`;
      }

      if (errorLogs && errorLogs.length > 0) {
        enhancedError += `\nTransaction logs:\n${errorLogs.join('\n')}`;
      }

      // Set cleanup information if needed
      if (cleanupRequired) {
        result.cleanup = {
          required: true,
          actions: cleanupActions
        };
      }

      throw new DepositTransactionError(
        enhancedError,
        'deposit_execution',
        error instanceof Error ? error : undefined,
        result.cleanup
      );
    }

    console.log('=== Deposit transaction execution completed successfully ===');
    return result;

  } catch (error) {
    console.error('Safe deposit execution failed:', error);
    
    if (error instanceof DepositTransactionError) {
      result.errors.push(`${error.message} - ${error.getSuggestedFix()}`);
      if (error.cleanup) {
        result.cleanup = error.cleanup;
      }
    } else {
      result.errors.push(`Deposit execution exception: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    result.success = false;
    return result;
  }
}

// Minimal token transfer helper to simulate "depositUsdt" for UI testing.
// This performs a direct SPL Token transfer from user ATA to vault ATA.
export async function depositUsdt(
  program: anchor.Program,
  user: PublicKey,
  pdas: { config: PublicKey; vault: PublicKey; userDeposit: PublicKey; userHistory: PublicKey },
  atAs: { mint: PublicKey; userAta: PublicKey; vaultAta: PublicKey },
  amount: anchor.BN
) {
  console.log("depositUsdt called with:");
  console.log("- user:", user.toBase58());
  console.log("- config:", pdas.config.toBase58());
  console.log("- vault:", pdas.vault.toBase58());
  console.log("- userDeposit:", pdas.userDeposit.toBase58());
  console.log("- userHistory:", pdas.userHistory.toBase58());
  console.log("- mint:", atAs.mint.toBase58());
  console.log("- amount:", amount.toString());

  const overrideMintStr = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_USDT_MINT_OVERRIDE;
  const resolvedMint = overrideMintStr ? new PublicKey(overrideMintStr) : atAs.mint;
  console.log("- resolvedMint:", resolvedMint.toBase58());

  const provider = program.provider as anchor.AnchorProvider;

  // Step 1: Comprehensive account validation for deposits
  console.log("=== Starting comprehensive account validation ===");
  
  const validationParams: DepositTransactionParams = {
    user,
    program,
    pdas,
    atAs: { ...atAs, mint: resolvedMint },
    amount,
    validateBeforeExecution: true
  };

  const validationResult = await validateDepositAccounts(provider.connection, validationParams);
  
  if (!validationResult.isValid) {
    console.error("Account validation failed:");
    validationResult.errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Account validation failed: ${validationResult.errors.join('; ')}`);
  }

  if (validationResult.warnings.length > 0) {
    console.log("Account validation warnings:");
    validationResult.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  console.log("✓ Account validation passed successfully");

  // Enhanced ATA creation with comprehensive error handling
  const ataCreationResult = await createRequiredATAs(
    provider.connection,
    user,
    resolvedMint,
    pdas.vault,
    atAs.userAta,
    atAs.vaultAta,
    validationResult.creationRequired,
    provider
  );

  if (!ataCreationResult.success) {
    console.error("ATA creation failed:");
    ataCreationResult.errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`ATA creation failed: ${ataCreationResult.errors.join('; ')}`);
  }

  if (ataCreationResult.warnings.length > 0) {
    console.log("ATA creation warnings:");
    ataCreationResult.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  // Safe deposit transaction execution with proper cleanup
  const depositResult = await executeDepositTransactionSafely(
    program,
    user,
    pdas,
    { ...atAs, mint: resolvedMint },
    amount,
    ataCreationResult.transactionSignature
  );

  if (!depositResult.success) {
    console.error("Deposit transaction failed:");
    depositResult.errors.forEach(error => console.error(`  - ${error}`));
    
    // Handle cleanup if required
    if (depositResult.cleanup?.required) {
      console.log("Cleanup actions required:");
      depositResult.cleanup.actions.forEach(action => console.log(`  - ${action}`));
    }
    
    throw new Error(`Deposit transaction failed: ${depositResult.errors.join('; ')}`);
  }

  console.log("✓ Deposit transaction completed successfully");
  return depositResult.transactionSignature;




}

// Placeholder terminate helper. The actual instruction depends on core program.
export async function terminate(
  _program: anchor.Program,
  _dev: PublicKey,
  _config: PublicKey,
  _vault: PublicKey
) {
  throw new Error("terminate instruction not available in current IDL");
}