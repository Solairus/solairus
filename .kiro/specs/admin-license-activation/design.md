# Design Document

## Overview

This design implements a comprehensive admin interface system with manual license activation capabilities. The system provides role-based access control for admin, dev, and marketer users, enabling them to perform authorized operations through a secure web interface and smart contract methods.

## Architecture

### Smart Contract Layer
- **New Method**: `activate_license_manual` - Admin/dev-only license activation without USDT
- **Enhanced Events**: Extended event system to track manual activations
- **Access Control**: Leverages existing admin/dev authorization patterns

### Frontend Layer
- **Protected Route**: `/dapp/special` with wallet-based authentication
- **Role-Based UI**: Dynamic interface based on connected wallet role
- **Real-time Data**: Live bucket balances and user information
- **Transaction Management**: Secure contract interaction with proper error handling

### Authentication Layer
- **Wallet Verification**: Connected wallet address validation against environment variables
- **Role Detection**: Automatic role assignment based on wallet address
- **Session Management**: Persistent role-based access during session

## Components and Interfaces

### Smart Contract Components

#### 1. Manual License Activation Method
```rust
pub fn activate_license_manual(
    ctx: Context<ActivateLicenseManual>, 
    user_pubkey: Pubkey,
    sponsor_pubkey: Pubkey,
    duration_days: u16,
    extend_existing: bool
) -> Result<()>
```

**Functionality:**
- Validates caller is admin or dev
- Registers user if not exists (with provided sponsor)
- If extend_existing = true AND user has active license: extends from current expiration
- If extend_existing = false OR user has no active license: sets expiration from current time
- Emits ManualLicenseActivatedEvent with extension behavior
- No USDT transfers or bucket updates
- No affiliate commission distribution

#### 2. Context Structure
```rust
#[derive(Accounts)]
pub struct ActivateLicenseManual<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"profile", user_pubkey.as_ref()],
        bump,
        space = 8 + UserProfile::SIZE
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
```

#### 3. Enhanced Event System
```rust
#[event]
pub struct ManualLicenseActivatedEvent {
    pub user: Pubkey,
    pub sponsor: Pubkey,
    pub duration_days: u16,
    pub license_expires_at: i64,
    pub activated_by: Pubkey,
    pub was_new_user: bool,
    pub extend_existing: bool,
    pub previous_expiration: i64,
    pub timestamp: i64,
}
```

### Frontend Components

#### 1. Route Protection Component
```typescript
// /src/components/admin/AdminRoute.tsx
interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { publicKey } = useWallet();
  const userRole = useAdminRole(publicKey);
  
  if (!userRole) {
    return <Navigate to="/dapp" replace />;
  }
  
  return <AdminProvider role={userRole}>{children}</AdminProvider>;
};
```

#### 2. Role-Based Admin Interface
```typescript
// /src/pages/Admin/AdminDashboard.tsx
const AdminDashboard: React.FC = () => {
  const { role } = useAdmin();
  
  return (
    <div className="admin-dashboard">
      {role === 'dev' && <ConfigManagement />}
      {(role === 'admin' || role === 'dev') && (
        <>
          <BucketManagement />
          <UserCreditManagement />
          <UserSponsorManagement />
          <ManualLicenseActivation />
        </>
      )}
      {role.startsWith('marketer') && <MarketerDashboard />}
    </div>
  );
};
```

#### 3. Manual License Activation Component
```typescript
// /src/components/admin/ManualLicenseActivation.tsx
interface ManualActivationForm {
  userAddress: string;
  sponsorAddress: string;
  durationDays: number;
  extendExisting: boolean;
}

const ManualLicenseActivation: React.FC = () => {
  const [form, setForm] = useState<ManualActivationForm>();
  const [userStatus, setUserStatus] = useState<UserLicenseStatus>();
  
  const handleActivation = async () => {
    await activateLicenseManual({
      userPubkey: new PublicKey(form.userAddress),
      sponsorPubkey: new PublicKey(form.sponsorAddress),
      durationDays: form.durationDays,
      extendExisting: form.extendExisting
    });
  };
  
  return (
    <div className="manual-activation">
      <UserLookup onUserFound={setUserStatus} />
      <ActivationForm 
        onSubmit={handleActivation}
        showExtendOption={userStatus?.isActive}
      />
    </div>
  );
};
```

#### 4. Bucket Management Component
```typescript
// /src/components/admin/BucketManagement.tsx
const BucketManagement: React.FC = () => {
  const { role } = useAdmin();
  const buckets = useBucketBalances();
  
  const getAccessibleBuckets = () => {
    switch (role) {
      case 'admin':
        return ['admin', 'trader', 'systemreserve'];
      case 'dev':
        return ['dev', 'trader', 'systemreserve'];
      case 'marketer1':
        return ['marketer1'];
      case 'marketer2':
        return ['marketer2'];
      default:
        return [];
    }
  };
  
  return (
    <div className="bucket-management">
      {getAccessibleBuckets().map(bucket => (
        <BucketCard 
          key={bucket}
          bucket={bucket}
          balance={buckets[bucket]}
          canWithdraw={true}
        />
      ))}
    </div>
  );
};
```

#### 5. User Credit Management Component
```typescript
// /src/components/admin/UserCreditManagement.tsx
const UserCreditManagement: React.FC = () => {
  const [userAddress, setUserAddress] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [amount, setAmount] = useState(0);
  
  const handleCreditOperation = async (isDebit: boolean) => {
    await creditUserBalance({
      userAddress: new PublicKey(userAddress),
      amount,
      isDebit
    });
    // Note: If user doesn't exist, contract will create with dev as sponsor
  };
  
  return (
    <div className="user-credit-management">
      <UserLookup 
        onUserFound={setUserInfo}
        showCreateOption={true}
      />
      <CreditOperationForm 
        onCredit={() => handleCreditOperation(false)}
        onDebit={() => handleCreditOperation(true)}
      />
    </div>
  );
};
```

#### 6. User Sponsor Management Component
```typescript
// /src/components/admin/UserSponsorManagement.tsx
const UserSponsorManagement: React.FC = () => {
  const [userAddress, setUserAddress] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [newSponsor, setNewSponsor] = useState('');
  
  const handleSponsorUpdate = async () => {
    await updateUserProfile({
      userAddress: new PublicKey(userAddress),
      newSponsor: new PublicKey(newSponsor)
    });
  };
  
  return (
    <div className="user-sponsor-management">
      <UserLookup onUserFound={setUserInfo} />
      {userInfo && (
        <SponsorUpdateForm 
          currentSponsor={userInfo.sponsor}
          onUpdate={handleSponsorUpdate}
        />
      )}
    </div>
  );
};
```

## Data Models

### Environment Variables
```typescript
// Admin role addresses
VITE_ADMIN_ADDRESS=
VITE_DEV_ADDRESS=
VITE_MARKETER1_ADDRESS=
VITE_MARKETER2_ADDRESS=
```

### User Role Type
```typescript
type UserRole = 'admin' | 'dev' | 'marketer1' | 'marketer2' | null;

interface AdminContext {
  role: UserRole;
  canAccessConfig: boolean;
  canManageUsers: boolean;
  canViewAllBuckets: boolean;
  accessibleBuckets: string[];
}
```

### Manual Activation Request
```typescript
interface ManualActivationRequest {
  userPubkey: PublicKey;
  sponsorPubkey: PublicKey;
  durationDays: number;
  extendExisting: boolean;
}

interface UserLicenseStatus {
  exists: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  sponsor: PublicKey | null;
}
```

## Error Handling

### Smart Contract Errors
- **Unauthorized**: Caller is not admin or dev
- **InvalidAmount**: Duration days is zero or negative
- **InvalidSponsor**: Sponsor address is invalid or not registered
- **MathOverflow**: Timestamp calculation overflow

### Frontend Error Handling
```typescript
const handleContractError = (error: any) => {
  if (error.code === 'Unauthorized') {
    toast.error('Only admin or dev can perform this action');
  } else if (error.code === 'InvalidAmount') {
    toast.error('Please enter a valid duration in days');
  } else {
    toast.error('Transaction failed. Please try again.');
  }
};
```

## Testing Strategy

### Smart Contract Tests
1. **Authorization Tests**: Verify only admin/dev can call manual activation
2. **User Registration Tests**: Test automatic user registration for new users
3. **License Extension Tests**: Verify proper license extension logic
4. **Event Emission Tests**: Confirm correct event data emission
5. **Edge Cases**: Test with zero duration, invalid addresses, etc.

### Frontend Tests
1. **Role Detection Tests**: Verify correct role assignment based on wallet
2. **UI Rendering Tests**: Test role-based component rendering
3. **Form Validation Tests**: Validate input forms and error handling
4. **Integration Tests**: Test complete manual activation flow
5. **Access Control Tests**: Verify unauthorized users cannot access admin features

### Integration Tests
1. **End-to-End Flow**: Complete manual activation from UI to contract
2. **Multi-Role Testing**: Test different user roles accessing the interface
3. **Error Scenarios**: Test various failure modes and error handling
4. **Performance Tests**: Verify UI responsiveness with real blockchain data

## Security Considerations

### Access Control
- **Wallet-Based Authentication**: Only authorized wallets can access admin interface
- **Role-Based Permissions**: Each role has specific, limited permissions
- **Contract-Level Security**: Smart contract validates caller authority
- **Session Management**: Secure session handling without storing private keys

### Data Validation
- **Input Sanitization**: All user inputs validated before contract calls
- **Address Validation**: Public key addresses validated for correctness
- **Range Validation**: Duration and amount inputs validated for reasonable ranges
- **Transaction Verification**: All contract interactions verified before execution

### Audit Trail
- **Event Logging**: All admin actions logged via blockchain events
- **Transaction History**: Complete audit trail of all administrative operations
- **Role Tracking**: Track which admin/dev performed each action
- **Timestamp Recording**: All actions timestamped for accountability