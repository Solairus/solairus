# Design Document

## Overview

The program initialization error occurs because the `fixTypes` function in `getProgram()` is not properly processing the IDL for Anchor v0.32.1 compatibility. The error `Cannot read properties of undefined (reading 'size')` at line 34 indicates that the Anchor Program constructor is receiving a malformed IDL structure. This design addresses the root cause by implementing proper IDL processing according to Anchor v0.32.1 requirements, ensuring program initialization succeeds and deposit functionality becomes available.

## Architecture

### Current Problem Analysis

**IDL Processing Issues:**
- The `fixTypes` function only converts "publicKey" to "pubkey" but misses other Anchor v0.32.1 requirements
- Missing root-level `address` field (Anchor expects `idl.address`, not just `idl.metadata.address`)
- Defined types in wrong format (string instead of object: "Role" should be {"name": "Role"})
- Account types may be inline instead of in the `types` array with discriminators

**Program Constructor Issues:**
- Anchor Program constructor fails with "Cannot read properties of undefined (reading 'size')"
- IDL structure doesn't match Anchor v0.32.1 expectations
- No validation of IDL structure before passing to Program constructor

**Error Handling Issues:**
- Generic "Program not available" error provides no debugging information about IDL structure
- No logging of processed IDL structure for debugging
- Missing validation of IDL processing steps

### Target Architecture

**Robust IDL Processing and Program Initialization:**
```
IDL Loading → IDL Structure Validation → Type Conversion → Program Creation → Method Validation
     ↓                    ↓                      ↓                ↓                ↓
Load raw IDL    Check required fields    Fix type formats    Create Program    Verify methods
```

## Components and Interfaces

### Enhanced IDL Processing

**Current IDL Processing (Problematic):**
```typescript
const fixTypes = (obj: unknown): unknown => {
  if (typeof obj === "string") return obj === "publicKey" ? "pubkey" : obj;
  // Only handles publicKey conversion, missing other Anchor v0.32.1 requirements
}
```

**Improved IDL Processing (Anchor v0.32.1 Compatible):**
```typescript
interface IDLProcessor {
  validateIDLStructure(idl: any): IDLValidationResult
  addRootAddressField(idl: any): any
  fixTypeCompatibility(idl: any): any
  fixDefinedTypes(idl: any): any
  restructureAccounts(idl: any): any
  logProcessedIDL(idl: any): void
}
```

### Method Validation System

**Pre-execution Validation:**
```typescript
interface MethodValidator {
  methodExists(program: anchor.Program, methodName: string): boolean
  getAvailableMethods(program: anchor.Program): string[]
  validateAccounts(accounts: Record<string, PublicKey>): ValidationResult
  suggestAlternativeMethod(methodName: string, available: string[]): string | null
}
```

### Enhanced Error Handling

**Detailed Error Information:**
```typescript
interface DepositError {
  type: 'METHOD_NOT_FOUND' | 'ACCOUNT_INVALID' | 'TRANSACTION_FAILED'
  message: string
  availableMethods?: string[]
  invalidAccounts?: string[]
  suggestedFix?: string
}
```

## Data Models

### IDL Validation Model

```typescript
interface IDLValidationResult {
  isValid: boolean
  methodsFound: string[]
  accountsFound: string[]
  typesProcessed: string[]
  errors: string[]
}
```

### Deposit Transaction Model

```typescript
interface DepositTransactionParams {
  // User and Program
  user: PublicKey
  program: anchor.Program
  
  // PDAs
  config: PublicKey
  vault: PublicKey
  userDeposit: PublicKey
  userHistory: PublicKey
  
  // Token Accounts
  mint: PublicKey
  userAta: PublicKey
  vaultAta: PublicKey
  
  // Transaction Details
  amount: anchor.BN
  
  // Validation
  validateBeforeExecution: boolean
}
```

### Account Validation Model

```typescript
interface AccountValidationResult {
  isValid: boolean
  missingAccounts: string[]
  invalidOwners: string[]
  creationRequired: {
    userAta: boolean
    vaultAta: boolean
  }
}
```

## Error Handling

### IDL Processing Errors

**Error Detection:**
1. Validate IDL has root-level address field
2. Check all type definitions are in correct format
3. Verify account structures match Anchor expectations
4. Log processed IDL structure for debugging

**Error Recovery:**
```typescript
function processIDLForAnchor(rawIdl: any): any {
  try {
    // Step 1: Add root address field
    const withAddress = {
      ...rawIdl,
      address: rawIdl.address || rawIdl.metadata?.address
    };
    
    if (!withAddress.address) {
      throw new IDLProcessingError('Missing address field in IDL');
    }
    
    // Step 2: Fix type compatibility
    const withFixedTypes = fixTypeCompatibility(withAddress);
    
    // Step 3: Fix defined types format
    const withFixedDefinedTypes = fixDefinedTypes(withFixedTypes);
    
    // Step 4: Restructure accounts if needed
    const finalIdl = restructureAccounts(withFixedDefinedTypes);
    
    console.log('Processed IDL structure:', JSON.stringify(finalIdl, null, 2));
    return finalIdl;
    
  } catch (error) {
    console.error('IDL processing failed:', error);
    console.log('Raw IDL structure:', JSON.stringify(rawIdl, null, 2));
    throw error;
  }
}
```

### Account Validation Errors

**Pre-flight Account Checks:**
```typescript
async function validateDepositAccounts(
  connection: Connection,
  accounts: DepositTransactionParams
): Promise<AccountValidationResult> {
  const validations = await Promise.all([
    validateAccount(connection, accounts.config, 'config'),
    validateAccount(connection, accounts.vault, 'vault'),
    validateTokenAccount(connection, accounts.userAta, accounts.user),
    validateTokenAccount(connection, accounts.vaultAta, accounts.vault)
  ])
  
  return aggregateValidationResults(validations)
}
```

### Transaction Execution Errors

**Atomic Transaction Handling:**
1. Separate ATA creation from deposit transaction
2. Validate all accounts before transaction submission
3. Provide detailed error messages for each failure point

## Testing Strategy

### IDL Processing Tests

**Unit Tests:**
- Test IDL type fixing preserves method names
- Test method existence validation
- Test available methods logging
- Test type conversion accuracy

**Integration Tests:**
- Test full IDL processing pipeline
- Test program initialization with processed IDL
- Test method resolution after IDL processing

### Method Validation Tests

**Method Existence Tests:**
- Test detection of existing methods
- Test handling of non-existent methods
- Test method name suggestion algorithm
- Test case sensitivity handling

**Account Validation Tests:**
- Test account existence validation
- Test account owner validation
- Test ATA creation requirement detection
- Test PDA derivation validation

### Error Handling Tests

**Error Scenario Tests:**
- Test method not found error handling
- Test invalid account error handling
- Test transaction failure error handling
- Test error message clarity and actionability

### End-to-End Deposit Tests

**Success Path Tests:**
- Test successful deposit with existing ATAs
- Test successful deposit with ATA creation
- Test deposit with different token amounts
- Test deposit error recovery

**Failure Path Tests:**
- Test deposit with invalid method name
- Test deposit with invalid accounts
- Test deposit with insufficient balance
- Test deposit with network failures

## Implementation Strategy

### Phase 1: IDL Structure Validation and Processing
1. Implement comprehensive IDL validation according to Anchor v0.32.1 rules
2. Add root-level address field from metadata.address
3. Fix type compatibility (publicKey → pubkey)
4. Fix defined types format (string → object)
5. Add comprehensive logging for IDL processing steps

### Phase 2: Program Initialization Fix
1. Replace current fixTypes function with comprehensive IDL processor
2. Add error handling for each IDL processing step
3. Validate processed IDL structure before Program constructor
4. Add debugging output for IDL processing failures

### Phase 3: Method and Account Validation
1. Add method existence checking after successful program initialization
2. Implement available methods logging
3. Add account validation for deposit functionality
4. Create detailed error messages for method and account issues

### Phase 4: Enhanced Error Handling and Recovery
1. Replace generic "Program not available" errors with specific IDL error types
2. Add actionable error messages for IDL processing failures
3. Implement error recovery suggestions based on project rules
4. Add comprehensive error logging for debugging

## Security Considerations

### Transaction Safety
- Ensure atomic transaction execution
- Validate all account ownership before signing
- Prevent partial transaction execution
- Maintain audit trail for all deposit attempts

### Account Validation Security
- Verify account ownership matches expected patterns
- Validate PDA derivation matches program expectations
- Ensure ATA creation uses correct parameters
- Prevent account substitution attacks

### Error Information Security
- Avoid exposing sensitive account information in errors
- Sanitize error messages for user display
- Log detailed errors securely for debugging
- Prevent information leakage through error messages