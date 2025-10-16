# License System Documentation

## Overview

The Solairus license system enforces yearly license requirements for dApp access. Users must purchase a 25 USDT yearly license to access protected features. The system includes affiliate commission distribution and proper PDA (Program Derived Address) management.

## Architecture

### Core Components

1. **LicenseGuard** - Route protection component
2. **LicenseService** - Business logic and smart contract interaction
3. **LicenseErrorHandler** - Centralized error handling
4. **LicenseStatusCard** - UI component for license status display
5. **LicenseActivation Page** - License purchase interface

### Smart Contract Integration

The system integrates with the `solairus_main` Solana program for:
- User profile management
- License activation and expiration tracking
- Affiliate commission distribution
- USDT payment processing

## PDA (Program Derived Address) System

### Critical Implementation Details

The license system uses PDAs for secure account management:

#### User Profile PDA
- **Seeds**: `[b"profile", user_pubkey]`
- **Contains**: User data including sponsor hierarchy and license expiration
- **Purpose**: Stores user's sponsor relationships and license status

#### Affiliate Earnings PDAs
- **Seeds**: `[b"affiliate", sponsor_pubkey]`
- **Contains**: Commission earnings for each sponsor
- **Security**: Each sponsor has isolated earnings account

### PDA Derivation Process

```typescript
// 1. Fetch user profile to get actual sponsor information
const userProfile = await accounts(program).UserProfile.fetch(profile);

// 2. Derive affiliate PDAs using REAL sponsor keys (not placeholders)
const affL1 = PublicKey.findProgramAddressSync([
  Buffer.from("affiliate"),
  userProfile.sponsorL1.toBuffer(), // Actual sponsor key
], PROGRAM_ID)[0];
```

**CRITICAL**: Never use placeholder or default keys for PDA derivation. Always fetch the user profile first to get actual sponsor PublicKeys.

## License Activation Flow

### Step-by-Step Process

1. **User Registration** (if needed)
   - Check if user profile exists
   - Create profile with sponsor hierarchy
   - Default sponsors to dev key if not provided

2. **License Activation**
   - Fetch user profile for sponsor information
   - Derive affiliate PDAs using actual sponsor keys
   - Transfer USDT from user to vault
   - Set license expiration date
   - Distribute commissions to affiliates

3. **Error Handling**
   - Parse errors with LicenseErrorHandler
   - Provide user-friendly messages
   - Offer manual retry options (NO automatic retries)

### Commission Distribution

License fees are distributed as follows:
- System roles (admin, dev, marketers, reserve): Configured percentages
- Affiliate commissions: L1, L2, L3 sponsors get respective percentages
- Remaining amount: Added to system reserve

## Error Handling

### Common Errors and Solutions

#### Seeds Constraint Violation (Error 2006)
- **Cause**: Incorrect PDA derivation using wrong sponsor keys
- **Solution**: Fetch user profile first, use actual sponsor PublicKeys
- **Message**: "Account verification failed. Please ensure your wallet is connected and try again."

#### User Profile Not Found
- **Cause**: User not registered in the system
- **Solution**: Automatic registration before license activation
- **Message**: "User profile not found. Please register first."

#### Insufficient Funds
- **Cause**: Not enough USDT balance
- **Solution**: User needs to add USDT to wallet
- **Message**: "Insufficient USDT balance to activate license."

### Cost Protection

**NO AUTOMATIC RETRIES**: All retries are manual/user-controlled to prevent unexpected gas costs.

## Environment Configuration

### Required Environment Variables

```env
# Enable/disable license guard
VITE_ENABLE_LICENSE_GUARD=true

# Solana cluster configuration
VITE_SOLANA_CLUSTER=devnet

# USDT mint address (devnet)
VITE_USDT_MINT=USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT
```

## Usage Examples

### Protecting Routes with LicenseGuard

```tsx
import LicenseGuard from '@/components/license/LicenseGuard';

function ProtectedPage() {
  return (
    <LicenseGuard>
      <YourProtectedContent />
    </LicenseGuard>
  );
}
```

### Checking License Status

```tsx
import { useLicense } from '@/contexts/license-context';

function MyComponent() {
  const { licenseInfo, isLoading, error } = useLicense();
  
  if (isLoading) return <div>Checking license...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      License Status: {licenseInfo.status}
      {licenseInfo.expirationDate && (
        <div>Expires: {licenseInfo.expirationDate.toLocaleDateString()}</div>
      )}
    </div>
  );
}
```

### Manual License Activation

```tsx
import { useLicense } from '@/contexts/license-context';

function ActivationButton() {
  const { activateLicense, isActivating } = useLicense();
  
  const handleActivation = async () => {
    try {
      await activateLicense();
      console.log('License activated successfully!');
    } catch (error) {
      console.error('Activation failed:', error);
      // Error is already parsed by LicenseErrorHandler
    }
  };
  
  return (
    <button onClick={handleActivation} disabled={isActivating}>
      {isActivating ? 'Activating...' : 'Activate License'}
    </button>
  );
}
```

## Security Considerations

1. **PDA Security**: Always use actual sponsor keys for affiliate PDA derivation
2. **No Seed Manipulation**: Using real sponsor PublicKeys prevents earnings manipulation
3. **Isolated Earnings**: Each sponsor has their own AffiliateEarnings PDA
4. **Cost Protection**: No automatic retries prevent unexpected gas costs
5. **Proper Validation**: License guard checks environment configuration

## Troubleshooting

### License Guard Not Working
- Check `VITE_ENABLE_LICENSE_GUARD=true` in environment
- Verify wallet connection
- Check license context initialization

### Seeds Constraint Error
- Ensure user profile exists (registration completed)
- Verify sponsor keys are actual PublicKeys, not placeholders
- Check wallet connection stability

### License Activation Fails
- Verify sufficient USDT balance (25 USDT + gas)
- Check USDT mint address configuration
- Ensure smart contract is deployed and initialized

## Development Notes

### Testing License System

1. **Disable License Guard**: Set `VITE_ENABLE_LICENSE_GUARD=false` for development
2. **Mock License Status**: Use test wallets with known license states
3. **Error Testing**: Test with insufficient funds, network issues, etc.

### Performance Monitoring

The system includes performance monitoring via `LicensePerformanceMonitor`:
- Tracks operation duration and success rates
- Logs performance stats in development
- Helps identify bottlenecks and issues

## Migration Notes

### From Old License System

If migrating from a previous license implementation:

1. Update PDA derivation to use actual sponsor keys
2. Remove automatic retry logic
3. Update error handling to use LicenseErrorHandler
4. Ensure proper React Hook usage in components
5. Test license guard redirection functionality

### Breaking Changes

- Automatic retries removed (cost protection)
- PDA derivation now requires user profile fetch
- Error handling centralized in LicenseErrorHandler
- License guard behavior standardized