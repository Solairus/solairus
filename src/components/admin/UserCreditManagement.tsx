import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Minus, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';
import { UserLookup, UserInfo } from './UserLookup';
// Purged solairus-removed imports from admin credit management
import { useAdminErrorHandler } from '@/utils/admin-error-handler';
import { useTransactionStatus } from '@/hooks/useTransactionStatus';
import { createAdminService } from '@/services/admin/admin-service';
import { LoadingCard } from './LoadingStates';
import { ResponsiveCard, InfoCard } from './ResponsiveCard';
import { ConfirmationDialog } from './ConfirmationDialog';
import { FormValidation, useFormValidation, validators } from './FormValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as anchor from '@coral-xyz/anchor';

interface CreditOperationForm {
  amount: string;
  isDebit: boolean;
}

export function UserCreditManagement() {
  const { anchorProvider, publicKey } = useWallet();
  const { hasAccess } = useAdminRole();
  const { showError, showSuccess } = useAdminErrorHandler();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [form, setForm] = useState<CreditOperationForm>({ amount: '', isDebit: false });
  const [lastOperation, setLastOperation] = useState<{ type: 'credit' | 'debit'; amount: string; success: boolean } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<{ type: 'credit' | 'debit'; amount: string } | null>(null);
  const validation = useFormValidation();
  
  // Format balance from micro-USDT (6 decimals) to display format
  const formatBalance = (balance: anchor.BN | string | number): string => {
    try {
      let balanceBN: anchor.BN;
      if (typeof balance === 'string') {
        balanceBN = new anchor.BN(balance);
      } else if (typeof balance === 'number') {
        balanceBN = new anchor.BN(balance);
      } else {
        balanceBN = balance;
      }
      
      // Convert from smallest unit (6 decimals for USDT) to display format
      const divisor = new anchor.BN(1000000); // 10^6
      const wholePart = balanceBN.div(divisor);
      const fractionalPart = balanceBN.mod(divisor);
      
      if (fractionalPart.eq(new anchor.BN(0))) {
        return wholePart.toString();
      }
      
      const fractionalStr = fractionalPart.toString().padStart(6, '0').replace(/0+$/, '');
      return `${wholePart.toString()}.${fractionalStr}`;
    } catch {
      return '0';
    }
  };
  
  const transactionStatus = useTransactionStatus({
    steps: [
      { id: 'validate', label: 'Validating operation' },
      { id: 'process', label: 'Processing backend operation' },
    ],
    onSuccess: (signature) => {
      const operationType = form.isDebit ? 'debit' : 'credit';
      const operationText = form.isDebit ? 'debited from' : 'credited to';
      
      showSuccess(`Successfully ${operationText} user balance`, {
        description: `${form.amount} USDT ${operationText} ${userInfo?.address.slice(0, 8)}... | Tx: ${signature.slice(0, 8)}...`,
      });

      setLastOperation({
        type: operationType,
        amount: form.amount,
        success: true,
      });

      setForm({ amount: '', isDebit: false });
      
      // Refresh user info
      if (userInfo) {
        const currentAddress = userInfo.address;
        setUserInfo(null);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refreshUserLookup', { detail: { address: currentAddress } }));
        }, 1000);
      }
    },
    onError: (error) => {
      setLastOperation({
        type: form.isDebit ? 'debit' : 'credit',
        amount: form.amount,
        success: false,
      });
      
      showError(error.originalError, `User ${form.isDebit ? 'debit' : 'credit'} operation`, {
        showRetry: !['authorization', 'validation'].includes(error.type),
        onRetry: () => handleCreditOperation(),
      });
    },
  });

  if (!hasAccess) {
    return (
      <Alert className="bg-red-900/20 border-red-800">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-red-400">
          Access denied. Admin or dev privileges required.
        </AlertDescription>
      </Alert>
    );
  }

  const validateCreditOperation = (isDebit: boolean): boolean => {
    validation.clearErrors();
    
    if (!userInfo) {
      validation.addError('user', 'Please lookup a user first');
      return false;
    }

    const amountError = validators.usdtAmount(form.amount, 'Amount');
    if (amountError) {
      validation.addError(amountError.field, amountError.message);
      return false;
    }

    if (isDebit && !userInfo.exists) {
      validation.addError('operation', 'Cannot debit from non-existent user');
      return false;
    }

    return true;
  };

  const parseUsdtAmount = (amount: string): anchor.BN => {
    try {
      const num = parseFloat(amount);
      // Convert to smallest unit (6 decimals for USDT)
      const multiplier = 1000000; // 10^6
      const smallestUnit = Math.floor(num * multiplier);
      return new anchor.BN(smallestUnit);
    } catch {
      throw new Error('Invalid amount format');
    }
  };

  const handleCreditOperationClick = (isDebit: boolean) => {
    if (validateCreditOperation(isDebit)) {
      setPendingOperation({ type: isDebit ? 'debit' : 'credit', amount: form.amount });
      setShowConfirmDialog(true);
    }
  };

  const handleCreditOperation = async () => {
    if (!pendingOperation || !validateCreditOperation(pendingOperation.type === 'debit')) {
      return;
    }

    const isDebit = pendingOperation.type === 'debit';
    
    // Update form state to track operation type
    setForm(prev => ({ ...prev, isDebit }));

    const txSig = await transactionStatus.executeTransaction(async () => {
      transactionStatus.updateProgress(20, 'validate');
      
      const userPubkey = new PublicKey(userInfo!.address);
      const amountBN = parseUsdtAmount(form.amount);
      
      transactionStatus.updateProgress(40, 'process');

      // Use the admin service instead of calling contract directly
      const adminService = createAdminService(anchorProvider);
      const result = await adminService.creditUserBalance({
        provider: anchorProvider,
        userPubkey,
        amount: amountBN.toNumber(), // Convert BN to number for the service
        isDebit,
        authority: publicKey,
      });

      return result.txSignature;
    }, `User ${isDebit ? 'debit' : 'credit'} operation`);

    if (txSig && typeof txSig === 'string' && txSig.length <= 40) {
      const operationType = isDebit ? 'debit' : 'credit';
      const operationText = isDebit ? 'debited from' : 'credited to';
      showSuccess(`Successfully ${operationText} user balance`, {
        description: `${form.amount} USDT ${operationText} ${userInfo?.address.slice(0, 8)}... | Tx: ${txSig.slice(0, 8)}...`,
      });
      setLastOperation({ type: operationType, amount: form.amount, success: true });
      const currentAddress = userInfo!.address;
      setUserInfo(null);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshUserLookup', { detail: { address: currentAddress } }));
      }, 1000);
    }
  };

  const handleUserFound = (info: UserInfo | null) => {
    setUserInfo(info);
    setLastOperation(null); // Clear previous operation status
  };

  const canPerformOperation = (): boolean => {
    return !transactionStatus.isLoading && 
           userInfo !== null && 
           form.amount.trim() !== '' && 
           !validation.hasErrors();
  };

  return (
    <>
      <div className="space-y-6">
        <ResponsiveCard
          title="User Credit Management"
          description="Credit or debit user balances. Auto-registration will create new users with dev as sponsor."
          icon={CreditCard}
          variant="elevated"
        >
          <div className="text-sm text-gray-400">
            Use this interface to manage user credit balances for customer service and promotional purposes.
          </div>
        </ResponsiveCard>

      {/* User Lookup Section */}
      <UserLookup 
        onUserFound={handleUserFound}
        showCreateOption={true}
        className="w-full"
      />

        {/* Credit Operation Form */}
        {userInfo && (
          <ResponsiveCard
            title="Credit Operations"
            icon={DollarSign}
            badge={{
              text: userInfo.exists ? 'Existing User' : 'New User',
              variant: userInfo.exists ? 'default' : 'secondary',
              className: userInfo.exists ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }}
          >
            <div className="space-y-4">


              {/* Transaction Status */}
              {transactionStatus.isLoading && (
                <LoadingCard
                  title="Processing Credit Operation"
                  message={transactionStatus.state.currentStep}
                  progress={transactionStatus.state.progress}
                  steps={transactionStatus.state.steps}
                  variant="compact"
                />
              )}

              {/* Form Validation */}
              <FormValidation errors={validation.errors} />

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Amount (USDT)
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount (e.g., 100.50)"
                  value={form.amount}
                  onChange={(e) => {
                    setForm({ ...form, amount: e.target.value });
                    validation.removeError('amount');
                  }}
                  className="bg-gray-800 border-gray-700 text-white"
                  step="0.000001"
                  min="0.000001"
                  max="1000000"
                  disabled={transactionStatus.isLoading}
                />
                <div className="text-xs text-gray-500">
                  Range: 0.000001 - 1,000,000 USDT
                </div>
              </div>

              {/* Operation Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleCreditOperationClick(false)}
                  disabled={!canPerformOperation()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Credit Balance
                </Button>
                
                <Button
                  onClick={() => handleCreditOperationClick(true)}
                  disabled={!canPerformOperation() || !userInfo.exists}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Debit Balance
                </Button>
              </div>

              {/* Warnings and Info */}
              {!userInfo.exists && (
                <div className="space-y-3">
                  <Alert className="bg-yellow-900/20 border-yellow-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-yellow-300">
                      <strong>Note:</strong> Debit operations are only available for existing users. 
                      Credit operations will automatically register new users.
                    </AlertDescription>
                  </Alert>

                  <Alert className="bg-blue-900/20 border-blue-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-blue-300">
                      <strong>Auto-Registration:</strong> Since this user doesn't exist, 
                      crediting their balance will automatically create their profile with the dev as their sponsor.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Last Operation Status */}
              {lastOperation && (
                <Alert className={lastOperation.success ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}>
                  {lastOperation.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription className={lastOperation.success ? "text-green-300" : "text-red-300"}>
                    Last operation: {lastOperation.success ? 'Successfully' : 'Failed to'} {lastOperation.type}ed {lastOperation.amount} USDT
                    {lastOperation.success && lastOperation.type === 'credit' && !userInfo.exists && (
                      <span className="block mt-1 text-sm">User profile was automatically created.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ResponsiveCard>
        )}

        {/* Instructions */}
        <ResponsiveCard
          title="Instructions"
          variant="outlined"
        >
          <div className="space-y-3 text-sm text-gray-400">
            <ul className="space-y-2 list-disc list-inside">
              <li>Enter a user wallet address to lookup their current balance and status</li>
              <li>Credit operations add USDT to the user's balance</li>
              <li>Debit operations subtract USDT from the user's balance (existing users only)</li>
              <li>New users will be automatically registered with dev as their sponsor</li>
              <li>All operations are logged on the blockchain for audit purposes</li>
            </ul>
          </div>
        </ResponsiveCard>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={`Confirm ${pendingOperation?.type === 'debit' ? 'Debit' : 'Credit'} Operation`}
        description={`Are you sure you want to ${pendingOperation?.type === 'debit' ? 'debit' : 'credit'} ${pendingOperation?.amount} USDT ${pendingOperation?.type === 'debit' ? 'from' : 'to'} this user's balance?`}
        confirmText={pendingOperation?.type === 'debit' ? 'Debit' : 'Credit'}
        cancelText="Cancel"
        variant={pendingOperation?.type === 'debit' ? 'destructive' : 'default'}
        onConfirm={handleCreditOperation}
        onCancel={() => setPendingOperation(null)}
        details={[
          `User: ${userInfo?.address.slice(0, 8)}...${userInfo?.address.slice(-8)}`,
          `Amount: ${pendingOperation?.amount} USDT`,
          `Operation: ${pendingOperation?.type === 'debit' ? 'Debit (subtract)' : 'Credit (add)'}`,
          ...(userInfo && !userInfo.exists ? ['Note: User will be auto-registered'] : [])
        ]}
      />
    </>
  );
}