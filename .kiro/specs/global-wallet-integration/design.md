# Design Document

## Overview

This design standardizes wallet integration across the Solairus DApp by ensuring all pages use the existing WalletContextProvider as the single source of truth for wallet state and smart contract interactions. The design eliminates dual-wallet complexity in uitests pages while maintaining the existing successful pattern used in Dapp pages.

## Architecture

### Current State Analysis

**Dapp Pages (Working Pattern):**
- Uses global `WalletContextProvider` from `src/contexts/wallet-context.tsx`
- Protected by `WalletGate` component
- Consistent wallet state across all Dapp routes
- Simple `useWallet()` hook for accessing wallet functionality

**Uitests Pages (Complex Pattern):**
- Uses both `@solana/wallet-adapter-react` AND global `WalletContextProvider`
- Complex synchronization logic between two wallet systems
- Auto-connection bridging between AppKit and Solana Adapter
- Inconsistent with Dapp pages approach

### Target Architecture

**Unified Pattern for All Pages:**
```
AppKitProvider
└── WalletContextProvider (Global)
    └── WalletConnectionProvider
        └── App Routes
            ├── /dapp/* (Already using unified pattern)
            └── /uitests/* (To be updated to unified pattern)
```

## Components and Interfaces

### Enhanced WalletContextProvider

The existing `WalletContextProvider` already provides:
- Connection state management (`isConnected`, `isConnecting`)
- Account information (`account`, `balance`)
- Solana Connection object (`provider`)
- Network switching capabilities (`switchNetwork`)
- Error handling (`lastError`, `clearError`)

**Enhancement Needed:**
Add smart contract interaction capabilities to the existing context:

```typescript
type WalletContextType = {
  // ... existing properties
  
  // New smart contract interaction properties
  anchorProvider: anchor.AnchorProvider | null
  publicKey: PublicKey | null
  signTransaction: ((transaction: Transaction) => Promise<Transaction>) | null
  signAllTransactions: ((transactions: Transaction[]) => Promise<Transaction[]>) | null
}
```

### Simplified Uitests Integration

**Current Complex Pattern (to be removed):**
```typescript
// Remove these imports and usage
import { useWallet as useAdapterWallet } from "@solana/wallet-adapter-react";
const { provider, connection, wallet } = useProvider();
const appWallet = useAppWallet();
// Complex sync logic...
```

**New Simplified Pattern:**
```typescript
// Single import and usage
import { useWallet } from "@/contexts/wallet-context";
const { isConnected, account, provider, anchorProvider, signTransaction } = useWallet();
```

### WalletGate Integration

Extend `WalletGate` usage to protect all uitests pages:
- Currently protects `/dapp` routes and `/uitests/license_activation`
- Should protect all future uitests routes consistently
- Maintain the same user experience across all protected routes

## Data Models

### Wallet State Model

```typescript
interface WalletState {
  // Connection State
  isConnected: boolean
  isConnecting: boolean
  account: string | null
  balance: string | null
  
  // Network State
  chainId: number | null
  provider: Connection | null
  
  // Smart Contract State
  anchorProvider: anchor.AnchorProvider | null
  publicKey: PublicKey | null
  
  // Transaction Signing
  signTransaction: ((tx: Transaction) => Promise<Transaction>) | null
  signAllTransactions: ((txs: Transaction[]) => Promise<Transaction[]>) | null
  
  // Error Handling
  lastError: Error | null
}
```

### Smart Contract Integration Model

```typescript
interface SmartContractCapabilities {
  // Program Interaction
  getProgram: (programId: PublicKey, idl: Idl) => anchor.Program | null
  
  // Transaction Building
  buildTransaction: (instructions: TransactionInstruction[]) => Promise<Transaction>
  
  // Account Derivation
  deriveAddress: (seeds: (Buffer | Uint8Array)[], programId: PublicKey) => PublicKey
}
```

## Error Handling

### Unified Error Management

All wallet-related errors should flow through the global context:
- Connection errors
- Transaction signing errors
- Network switching errors
- Smart contract interaction errors

**Error Types:**
```typescript
enum WalletErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_SWITCH_FAILED = 'NETWORK_SWITCH_FAILED',
  SMART_CONTRACT_ERROR = 'SMART_CONTRACT_ERROR'
}
```

### Error Display Strategy

- Use existing `toast` system for user-facing errors
- Maintain error state in context for programmatic handling
- Provide `clearError()` method for error recovery

## Testing Strategy

### Unit Testing Approach

**Context Testing:**
- Test wallet connection state management
- Test smart contract provider creation
- Test error handling and recovery
- Test network switching functionality

**Component Integration Testing:**
- Test `WalletGate` behavior with new context
- Test `useWallet` hook in various scenarios
- Test error boundary behavior

**Page-Level Testing:**
- Test uitests pages with simplified wallet integration
- Test consistency between Dapp and uitests wallet behavior
- Test smart contract interaction flows

### Integration Testing

**Cross-Page Consistency:**
- Test wallet state persistence across route changes
- Test wallet connection sharing between Dapp and uitests
- Test error propagation across different page types

**Smart Contract Integration:**
- Test Anchor provider creation and usage
- Test transaction signing workflows
- Test program interaction capabilities

## Implementation Phases

### Phase 1: Enhance Global Context
- Add smart contract capabilities to existing `WalletContextProvider`
- Ensure backward compatibility with existing Dapp pages
- Add Anchor provider creation logic

### Phase 2: Simplify Uitests Integration
- Remove dual-wallet complexity from uitests pages
- Update uitests to use only global context
- Ensure WalletGate protection for all uitests routes

### Phase 3: Validation and Testing
- Test consistency across all pages
- Validate smart contract interaction capabilities
- Ensure mobile-first UI approach is maintained

## Security Considerations

### Transaction Signing Security
- Maintain existing security patterns for transaction signing
- Ensure private keys never leave wallet adapters
- Validate all transaction parameters before signing

### Network Security
- Maintain existing network validation logic
- Ensure secure RPC endpoint usage
- Validate cluster configuration consistency

### Error Information Security
- Avoid exposing sensitive information in error messages
- Sanitize error details before displaying to users
- Maintain audit trail for security-relevant errors