import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Users, AlertCircle, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminRole } from '@/hooks/useAdminRole';
import { UserLookup, UserInfo } from './UserLookup';
// Purged solairus-removed; use backend-only AdminService
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAdminService } from '@/services/admin/admin-service';
import * as anchor from '@coral-xyz/anchor';

interface SponsorUpdateForm {
  newSponsorAddress: string;
}

interface SponsorUpdateConfirmation {
  show: boolean;
  userInfo: UserInfo | null;
  currentSponsor: string;
  newSponsor: string;
}

export function UserSponsorManagement() {
  const { anchorProvider, publicKey } = useWallet();
  const { hasAccess } = useAdminRole();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [form, setForm] = useState<SponsorUpdateForm>({ newSponsorAddress: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmation, setConfirmation] = useState<SponsorUpdateConfirmation>({
    show: false,
    userInfo: null,
    currentSponsor: '',
    newSponsor: '',
  });
  const [lastOperation, setLastOperation] = useState<{ success: boolean; message: string } | null>(null);

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

  const validateSponsorAddress = (address: string): { isValid: boolean; error?: string } => {
    const trimmed = (address || '').trim();
    if (!userInfo || !userInfo.exists) {
      return { isValid: false, error: 'Please lookup an existing user first' };
    }
    if (!trimmed) {
      return { isValid: false, error: 'Sponsor address is required' };
    }

    // Basic length sanity check only; avoid strict base58 validation to reduce false negatives
    if (trimmed.length < 32 || trimmed.length > 64) {
      return { isValid: false, error: 'Sponsor address length looks invalid' };
    }

    const userAddr = userInfo.address.trim();
    const currentSponsorStr = userInfo.sponsor?.toString().trim() || '';
    if (trimmed === userAddr) {
      return { isValid: false, error: 'User cannot sponsor themselves' };
    }
    if (currentSponsorStr && trimmed === currentSponsorStr) {
      return { isValid: false, error: 'User already has this sponsor' };
    }
    return { isValid: true };
  };

  const handleUserFound = (info: UserInfo | null) => {
    setUserInfo(info);
    setForm({ newSponsorAddress: '' });
    setLastOperation(null);
    setConfirmation({
      show: false,
      userInfo: null,
      currentSponsor: '',
      newSponsor: '',
    });
  };

  const handleSponsorUpdate = () => {
    if (!userInfo || !userInfo.exists) {
      toast.error('Please lookup an existing user first');
      return;
    }

    if (!form.newSponsorAddress.trim()) {
      toast.error('Please enter a new sponsor address');
      return;
    }

      const validation = validateSponsorAddress(form.newSponsorAddress);
    if (!validation.isValid) {
      toast.error(validation.error || 'Invalid sponsor address');
      return;
    }

    const newSponsorAddress = form.newSponsorAddress.trim();
    const currentSponsorAddress = userInfo.sponsor?.toString() || 'None';

    // Check if the new sponsor is the same as current
    if (userInfo.sponsor && userInfo.sponsor === newSponsorAddress) {
      toast.error('New sponsor address is the same as current sponsor');
      return;
    }

    // Show confirmation dialog
    setConfirmation({
      show: true,
      userInfo,
      currentSponsor: currentSponsorAddress,
      newSponsor: newSponsorAddress,
    });
  };

  const confirmSponsorUpdate = async () => {
    if (!anchorProvider || !publicKey || !confirmation.userInfo) {
      toast.error('Wallet not connected or invalid confirmation state');
      return;
    }

    setIsProcessing(true);
    setConfirmation({ ...confirmation, show: false });

    try {
      const adminService = createAdminService(anchorProvider);
      const txSig = await adminService.updateUserSponsor({
        provider: anchorProvider,
        userPubkey: confirmation.userInfo.address.trim(),
        newSponsor: confirmation.newSponsor.trim(),
        authority: publicKey,
      });

      toast.success('Successfully updated user sponsor');

      setLastOperation({
        success: true,
        message: `Sponsor updated successfully`,
      });

      // Clear form
      setForm({ newSponsorAddress: '' });

      // Refresh user info to show updated sponsor
      const currentAddress = confirmation.userInfo.address;
      setUserInfo(null);
      
      // Small delay to allow backend state to update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshUserLookup', { detail: { address: currentAddress } }));
      }, 1000);

    } catch (error) {
      console.error('Sponsor update error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }

      // Handle specific backend errors
      if (errorMessage.includes('UnauthorizedSponsorUpdate')) {
        errorMessage = 'Only admin or dev can update user sponsors';
      } else if (errorMessage.includes('SponsorNotRegistered')) {
        errorMessage = 'The new sponsor address is not registered in the system';
      }

      toast.error('Failed to update user sponsor', {
        description: errorMessage,
      });

      setLastOperation({
        success: false,
        message: `Failed to update sponsor: ${errorMessage}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelSponsorUpdate = () => {
    setConfirmation({
      show: false,
      userInfo: null,
      currentSponsor: '',
      newSponsor: '',
    });
  };

  const canUpdateSponsor = (): boolean => {
    if (isProcessing || !userInfo || !userInfo.exists) return false;
    const newAddr = form.newSponsorAddress.trim();
    if (!newAddr) return false;
    const isSelf = newAddr === userInfo.address.trim();
    const isSame = userInfo.sponsor ? newAddr === userInfo.sponsor.toString().trim() : false;
    return !isSelf && !isSame;
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <UserCheck className="h-6 w-6" />
            User Sponsor Management
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Update user sponsor relationships. Only admin and dev can perform sponsor updates.
          </p>
        </CardHeader>
      </Card>

      {/* User Lookup Section */}
      <UserLookup 
        onUserFound={handleUserFound}
        showCreateOption={false}
        className="w-full"
        mode="sponsor"
      />

      {/* Sponsor Update Form */}
      {userInfo && userInfo.exists && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">
              Update Sponsor
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Target User:</span>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                {formatAddress(userInfo.address)}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">


            {/* New Sponsor Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                New Sponsor Address
              </label>
              <Input
                type="text"
                placeholder="Enter new sponsor wallet address..."
                value={form.newSponsorAddress}
                onChange={(e) => setForm({ ...form, newSponsorAddress: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={isProcessing}
              />
              <div className="text-xs text-gray-500">
                Note: A user cannot sponsor themselves. The new sponsor must be a different wallet address.
              </div>
              <div className="text-xs text-gray-500">
                Enter a valid Solana wallet address for the new sponsor
              </div>
            </div>

            {/* Update Button */}
            <Button
              onClick={handleSponsorUpdate}
              disabled={!canUpdateSponsor()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating Sponsor...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Update Sponsor
                </>
              )}
            </Button>

            {/* Validation Info */}
            {form.newSponsorAddress && (() => {
              const validation = validateSponsorAddress(form.newSponsorAddress);
              return !validation.isValid && (
                <Alert className="bg-red-900/20 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-300">
                    {validation.error}
                  </AlertDescription>
                </Alert>
              );
            })()}

            {/* Last Operation Status */}
            {lastOperation && (
              <Alert className={lastOperation.success ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}>
                {lastOperation.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription className={lastOperation.success ? "text-green-300" : "text-red-300"}>
                  {lastOperation.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-existent User Message */}
      {userInfo && !userInfo.exists && (
        <Alert className="bg-yellow-900/20 border-yellow-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-yellow-300">
            <strong>User Not Registered:</strong> Sponsor updates can only be performed for existing users. 
            Please ensure the user is registered in the system first.
          </AlertDescription>
        </Alert>
      )}

      {/* Confirmation Dialog */}
      {confirmation.show && (
        <Card className="bg-gray-900 border-yellow-600 border-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              Confirm Sponsor Update
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="bg-gray-800/50 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">User:</span>
                <span className="text-white font-mono">
                  {confirmation.userInfo ? formatAddress(confirmation.userInfo.address) : 'N/A'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Current Sponsor:</span>
                <span className="text-white font-mono">
                  {confirmation.currentSponsor === 'None' ? 'None' : formatAddress(confirmation.currentSponsor)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">New Sponsor:</span>
                <span className="text-green-400 font-mono">
                  {formatAddress(confirmation.newSponsor)}
                </span>
              </div>
            </div>

            <Alert className="bg-yellow-900/20 border-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-yellow-300">
                <strong>Warning:</strong> This action will permanently change the user's sponsor relationship. 
                This affects their referral hierarchy and commission distribution.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                onClick={confirmSponsorUpdate}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Update
                  </>
                )}
              </Button>
              
              <Button
                onClick={cancelSponsorUpdate}
                disabled={isProcessing}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-6">
          <div className="space-y-3 text-sm text-gray-400">
            <div className="font-medium text-gray-300">Instructions:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Enter a user wallet address to lookup their current sponsor information</li>
              <li>Only existing registered users can have their sponsors updated</li>
              <li>The new sponsor address must be a valid Solana wallet address</li>
              <li>Sponsor updates affect referral hierarchies and commission distributions</li>
              <li>Only admin and dev roles can perform sponsor updates</li>
              <li>All sponsor updates are audit logged in backend</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}