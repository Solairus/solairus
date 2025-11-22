import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Key, Calendar, User, AlertCircle, CheckCircle, Clock, Shield } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';
import { UserLookup, UserInfo } from './UserLookup';
import { createAdminService } from '@/services/admin/admin-service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveCard, InfoCard } from './ResponsiveCard';
import { FormInput } from './FormInput';
import { ConfirmationDialog } from './ConfirmationDialog';
import { FormValidation, useFormValidation, validators } from './FormValidation';
import { LoadingCard } from './LoadingStates';
import { AdminNotifications } from './NotificationSystem';
import { useTransactionStatus } from '@/hooks/useTransactionStatus';
import * as anchor from '@coral-xyz/anchor';

interface ManualActivationForm {
  durationDays: string;
  extendExisting: boolean;
  sponsorAddress: string;
}

interface ActivationResult {
  success: boolean;
  txSignature?: string;
  error?: string;
  wasNewUser?: boolean;
  previousExpiration?: Date;
  newExpiration?: Date;
}

export function ManualLicenseActivation() {
  const { anchorProvider, publicKey } = useWallet();
  const { hasAccess } = useAdminRole();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [form, setForm] = useState<ManualActivationForm>({
    durationDays: '30',
    extendExisting: false,
    sponsorAddress: ''
  });
  const [lastResult, setLastResult] = useState<ActivationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const validation = useFormValidation();
  
  const transactionStatus = useTransactionStatus({
    steps: [
      { id: 'validate', label: 'Validating license activation' },
      { id: 'sign', label: 'Waiting for signature' },
      { id: 'confirm', label: 'Confirming transaction' },
    ],
    onSuccess: (signature) => {
      const durationDays = parseInt(form.durationDays);
      AdminNotifications.licenseActivation(
        userInfo!.address,
        durationDays,
        signature,
        !userInfo!.exists
      );
      
      setLastResult({
        success: true,
        txSignature: signature,
        wasNewUser: !userInfo!.exists,
        newExpiration: calculateNewExpiration()
      });

      // Refresh user info
      const currentAddress = userInfo!.address;
      setUserInfo(null);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshUserLookup', { detail: { address: currentAddress } }));
      }, 1000);
    },
    onError: (error) => {
      const errorMessage = error.originalError instanceof Error ? error.originalError.message : 'Unknown error occurred';
      AdminNotifications.transactionError('Manual license activation', error.originalError instanceof Error ? error.originalError : new Error(String(error.originalError)), error.isRetryable, () => handleActivation());
      
      setLastResult({
        success: false,
        error: errorMessage
      });
    },
  });

  if (!hasAccess) {
    return (
      <Alert className="bg-red-900/20 border-red-800">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-red-400">
          Access denied. Admin or dev privileges required for manual license activation.
        </AlertDescription>
      </Alert>
    );
  }

  const validateActivation = (): boolean => {
    validation.clearErrors();
    
    if (!userInfo) {
      validation.addError('user', 'Please lookup a user first');
      return false;
    }

    const durationError = validators.integer(form.durationDays, 'Duration', 1, 3650);
    if (durationError) {
      validation.addError(durationError.field, durationError.message);
      return false;
    }

    // If user doesn't exist, sponsor is required
    if (!userInfo.exists && !form.sponsorAddress.trim()) {
      validation.addError('sponsor', 'Sponsor address is required for new users');
      return false;
    }

    // Validate sponsor address only for new users
    // Sponsor validation is unnecessary for existing users since they already have a sponsor
    if (!userInfo.exists && form.sponsorAddress.trim()) {
      const sponsorError = validators.publicKey(form.sponsorAddress, 'Sponsor address');
      if (sponsorError) {
        validation.addError(sponsorError.field, sponsorError.message);
        return false;
      }
    }

    return true;
  };

  const calculateNewExpiration = (): Date => {
    const currentTime = new Date();
    const durationMs = parseInt(form.durationDays) * 24 * 60 * 60 * 1000;
    
    const currentExp = userInfo?.licenseExpiresAt ? new Date(userInfo!.licenseExpiresAt) : null;
    if (form.extendExisting && currentExp && userInfo!.licenseStatus === 'active') {
      return new Date(currentExp.getTime() + durationMs);
    } else {
      return new Date(currentTime.getTime() + durationMs);
    }
  };

  const handleActivationClick = () => {
    if (validateActivation()) {
      setShowConfirmDialog(true);
    }
  };

  const handleActivation = async () => {
    if (!validateActivation()) return;

    const result = await transactionStatus.executeTransaction(async () => {
      transactionStatus.updateProgress(20, 'validate');

      const userPubkey = new PublicKey(userInfo!.address);

      let sponsorPubkey: PublicKey;
      if (!userInfo!.exists) {
        sponsorPubkey = new PublicKey(form.sponsorAddress);
      } else {
        sponsorPubkey = userInfo!.sponsor ? new PublicKey(userInfo!.sponsor) : new PublicKey(form.sponsorAddress || publicKey.toString());
      }

      const durationDays = parseInt(form.durationDays);

      transactionStatus.updateProgress(40, 'sign');

      const adminService = createAdminService(anchorProvider);
      const svcResult = await adminService.activateLicenseManual({
        provider: anchorProvider,
        userPubkey,
        sponsorPubkey,
        durationDays,
        extendExisting: form.extendExisting,
        authority: publicKey,
      });
      return svcResult.txSignature;
    }, 'Manual license activation');

    if (result && typeof result === 'string' && result.length <= 40) {
      const durationDays = parseInt(form.durationDays);
      AdminNotifications.licenseActivation(
        userInfo!.address,
        durationDays,
        result,
        !userInfo!.exists
      );

      setLastResult({
        success: true,
        txSignature: result,
        wasNewUser: !userInfo!.exists,
        newExpiration: calculateNewExpiration()
      });

      const currentAddress = userInfo!.address;
      setUserInfo(null);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshUserLookup', { detail: { address: currentAddress } }));
      }, 1000);
    }
  };

  const handleUserFound = (info: UserInfo | null) => {
    setUserInfo(info);
    setLastResult(null);
    
    // Auto-fill sponsor for existing users
    if (info && info.exists && info.sponsor) {
      setForm(prev => ({
        ...prev,
        sponsorAddress: info.sponsor!.toString()
      }));
    } else {
      // Clear sponsor for new lookups
      setForm(prev => ({
        ...prev,
        sponsorAddress: ''
      }));
    }
  };

  const canActivate = (): boolean => {
    return !transactionStatus.isLoading && 
           userInfo !== null && 
           !validation.hasErrors();
  };

  const getLicenseStatusDisplay = () => {
    if (!userInfo) return null;

    if (!userInfo.exists) {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">
            No License (New User)
          </Badge>
        </div>
      );
    }

    const statusColors = {
      'active': 'bg-green-500/10 text-green-400 border-green-500/20',
      'near-expiry': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'expired': 'bg-red-500/10 text-red-400 border-red-500/20',
      'none': 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    };

    const statusIcons = {
      'active': <CheckCircle className="h-4 w-4" />,
      'near-expiry': <Clock className="h-4 w-4" />,
      'expired': <AlertCircle className="h-4 w-4" />,
      'none': <AlertCircle className="h-4 w-4" />
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className={statusColors[userInfo.licenseStatus || 'none']}>
            <div className="flex items-center gap-1">
              {statusIcons[userInfo.licenseStatus || 'none']}
              <span className="capitalize">{userInfo.licenseStatus || 'None'}</span>
            </div>
          </Badge>
        </div>
        
        {userInfo.licenseExpiresAt && (
          <div className="text-xs text-gray-500">
            {userInfo.licenseStatus === 'active' || userInfo.licenseStatus === 'near-expiry' ? (
              <>Expires: {new Date(userInfo.licenseExpiresAt).toLocaleDateString()} ({(userInfo.daysRemaining ?? 0)} days)</>
            ) : userInfo.licenseStatus === 'expired' ? (
              <>Expired: {new Date(userInfo.licenseExpiresAt).toLocaleDateString()}</>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <ResponsiveCard
          title="Manual License Activation"
          description="Manually activate user licenses without USDT payment. For promotional activations and customer service."
          icon={Key}
          badge={{
            text: 'Admin Only',
            variant: 'destructive',
            className: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
          }}
          variant="elevated"
        >
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Shield className="h-4 w-4 text-orange-400" />
            <span>No USDT payment required • No affiliate commissions • Audit logged</span>
          </div>
        </ResponsiveCard>

      {/* User Lookup Section */}
      <UserLookup 
        onUserFound={handleUserFound}
        className="w-full"
      />

        {/* License Activation Form */}
        {userInfo && (
          <ResponsiveCard
            title="License Activation"
            icon={Calendar}
            badge={{
              text: userInfo.exists ? 'Existing User' : 'New User',
              variant: userInfo.exists ? 'default' : 'secondary',
              className: userInfo.exists ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }}
          >
            <div className="space-y-6">




              {/* Transaction Status */}
              {transactionStatus.isLoading && (
                <LoadingCard
                  title="Processing License Activation"
                  message={transactionStatus.state.currentStep}
                  progress={transactionStatus.state.progress}
                  steps={transactionStatus.state.steps}
                  variant="compact"
                />
              )}

              {/* Form Validation */}
              <FormValidation errors={validation.errors} />

              {/* Duration Input */}
              <FormInput
                label="License Duration (Days)"
                type="number"
                placeholder="Enter duration in days (e.g., 30)"
                value={form.durationDays}
                onChange={(e) => {
                  setForm({ ...form, durationDays: e.target.value });
                  validation.removeError('duration');
                }}
                min="1"
                max="3650"
                disabled={transactionStatus.isLoading}
                description="Range: 1 - 3650 days (10 years maximum)"
                required
              />

              {/* Extension Option */}
              {userInfo.exists && (userInfo.licenseStatus === 'active' || userInfo.licenseStatus === 'near-expiry') && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="extend-existing"
                      checked={form.extendExisting}
                      onCheckedChange={(checked) => setForm({ ...form, extendExisting: checked })}
                      disabled={transactionStatus.isLoading}
                    />
                    <Label htmlFor="extend-existing" className="text-gray-300">
                      Extend existing license
                    </Label>
                  </div>
                  <div className="text-xs text-gray-500 ml-6">
                    {form.extendExisting ? (
                      <>Add {form.durationDays} days to current expiration date</>
                    ) : (
                      <>Replace current license with {form.durationDays} days from now</>
                    )}
                  </div>
                </div>
              )}

              {/* Sponsor Selection for New Users */}
              {!userInfo.exists && (
                <FormInput
                  label="Sponsor Address"
                  type="text"
                  placeholder="Enter sponsor wallet address..."
                  value={form.sponsorAddress}
                  onChange={(e) => {
                    setForm({ ...form, sponsorAddress: e.target.value });
                    validation.removeError('sponsor');
                  }}
                  disabled={transactionStatus.isLoading}
                  description="Required for new users. This will be their referral sponsor."
                  required
                />
              )}



              {/* Activation Button */}
              <Button
                onClick={handleActivationClick}
                disabled={!canActivate()}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                size="lg"
              >
                <Key className="h-4 w-4 mr-2" />
                Activate License ({form.durationDays} days)
              </Button>

              {/* Warnings and Info */}
              {!userInfo.exists && (
                <Alert className="bg-blue-900/20 border-blue-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-blue-300">
                    <strong>Auto-Registration:</strong> This user will be automatically registered 
                    with the specified sponsor when their license is activated.
                  </AlertDescription>
                </Alert>
              )}

              {/* Last Operation Result */}
              {lastResult && (
                <Alert className={lastResult.success ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}>
                  {lastResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription className={lastResult.success ? "text-green-300" : "text-red-300"}>
                    {lastResult.success ? (
                      <div className="space-y-1">
                        <div>License activated successfully!</div>
                        {lastResult.wasNewUser && (
                          <div className="text-sm">User profile was automatically created.</div>
                        )}
                        {lastResult.newExpiration && (
                          <div className="text-sm">
                            New expiration: {lastResult.newExpiration.toLocaleDateString()}
                          </div>
                        )}
                        {lastResult.txSignature && (
                          <div className="text-sm font-mono">
                            Tx: {lastResult.txSignature.slice(0, 16)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>Failed to activate license: {lastResult.error}</div>
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
              <li>Enter a user wallet address to lookup their current license status</li>
              <li>Specify the license duration in days (1-3650 days)</li>
              <li>For existing users with active licenses, choose to extend or replace</li>
              <li>For new users, provide a sponsor address for auto-registration</li>
              <li>Manual activations do not involve USDT payments or affiliate commissions</li>
              <li>All activations are audit logged in backend</li>
            </ul>
          </div>
        </ResponsiveCard>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm License Activation"
        description={`Are you sure you want to activate a ${form.durationDays} day license for this user?`}
        confirmText="Activate License"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleActivation}
        details={[
          `User: ${userInfo?.address.slice(0, 8)}...${userInfo?.address.slice(-8)}`,
          `Duration: ${form.durationDays} days`,
          `Method: ${form.extendExisting ? 'Extend existing license' : 'Replace/Create new license'}`,
          ...(userInfo && !userInfo.exists ? [`Sponsor: ${form.sponsorAddress.slice(0, 8)}...${form.sponsorAddress.slice(-8)}`, 'Note: User will be auto-registered'] : []),
          'No USDT payment required'
        ]}
      />
    </>
  );
}