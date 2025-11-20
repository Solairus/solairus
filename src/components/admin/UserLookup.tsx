import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, Calendar, Wallet, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@/contexts/wallet-context';
import { toast } from 'sonner';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';

export interface UserProfile {
  credit_balance?: number;
  principal_balance?: number;
  ref_by?: string;
  license_status?: 'active' | 'expired' | 'near-expiry' | 'none';
  license_expiration?: string;
  days_remaining?: number;
  total_affiliate_earnings?: number;
  available_affiliate_earnings?: number;
}

export interface UserInfo {
  address: string;
  exists: boolean;
  profile?: UserProfile;
  balance?: number; // Credit balance in USDT (not micro)
  principalBalance?: number; // Principal balance in USDT
  sponsor?: string; // Public key as string
  licenseStatus?: 'active' | 'expired' | 'near-expiry' | 'none';
  licenseExpiresAt?: string; // ISO date string
  daysRemaining?: number;
  totalAffiliateEarnings?: number; // In USDT
  availableAffiliateEarnings?: number; // In USDT
}

interface UserLookupProps {
  onUserFound?: (userInfo: UserInfo) => void;
  showCreateOption?: boolean;
  className?: string;
  mode?: 'default' | 'sponsor';
}

export function UserLookup({ onUserFound, showCreateOption = false, className, mode = 'default' }: UserLookupProps) {
  const { anchorProvider } = useWallet();
  const [userAddress, setUserAddress] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  const lookupUser = async () => {
    if (!userAddress.trim()) {
      setError('Please enter a user address');
      return;
    }

    if (!validateAddress(userAddress)) {
      setError('Invalid Solana address format');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserInfo(null);

    try {
      // Use backend API instead of blockchain calls
      const response = await ApiClient.get(`${API_CONFIG.getBaseUrl()}/users/${userAddress}`);
      const userData: UserProfile | null = response.ok ? await response.json() : null;

      const info: UserInfo = {
        address: userAddress,
        exists: !!userData,
        profile: userData,
        balance: userData?.credit_balance || 0,
        principalBalance: userData?.principal_balance || 0,
        sponsor: userData?.ref_by,
        licenseStatus: userData?.license_status,
        licenseExpiresAt: userData?.license_expiration,
        daysRemaining: userData?.days_remaining,
        totalAffiliateEarnings: userData?.total_affiliate_earnings || 0,
        availableAffiliateEarnings: userData?.available_affiliate_earnings || 0,
      };

      setUserInfo(info);
      onUserFound?.(info);

    } catch (lookupError: unknown) {
      console.error('User lookup error:', lookupError);

      const error = lookupError as {
        response?: {
          status?: number;
          data?: {
            error?: string;
          };
        };
        message?: string;
      };
      if (error?.response?.status === 404) {
        // User not found - this is expected
        const info: UserInfo = {
          address: userAddress,
          exists: false,
        };
        setUserInfo(info);
        onUserFound?.(info);
      } else {
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to lookup user';
        setError(errorMessage);
        toast.error('Failed to lookup user', {
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserAddress(value);
    setError(null);

    // Clear user info when address changes
    if (userInfo && userInfo.address !== value) {
      setUserInfo(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      lookupUser();
    }
  };

  const formatBalance = (balanceMicro: number | string): string => {
    try {
      const micro = typeof balanceMicro === 'string' ? parseFloat(balanceMicro) : balanceMicro;
      const usdt = micro / 1_000_000; // convert micro → units
      return usdt.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      });
    } catch {
      return '0';
    }
  };

  const getLicenseStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'near-expiry':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'expired':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'none':
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getLicenseStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'near-expiry':
        return <Clock className="h-4 w-4" />;
      case 'expired':
      case 'none':
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card className={`bg-gray-900/50 border-gray-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <User className="h-5 w-5" />
          User Lookup
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter user wallet address..."
            value={userAddress}
            onChange={handleAddressChange}
            onKeyPress={handleKeyPress}
            className="bg-gray-800 border-gray-700 text-white flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={lookupUser}
            disabled={isLoading || !userAddress.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-md p-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* User Information Display */}
        {userInfo && (
          <div className="space-y-4">
            {/* User Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Status:</span>
                <Badge className={userInfo.exists ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}>
                  {userInfo.exists ? 'Registered' : 'Not Registered'}
                </Badge>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {userInfo.address.slice(0, 8)}...{userInfo.address.slice(-8)}
              </div>
            </div>

            {/* User Profile Information */}
            {userInfo.exists && userInfo.profile && (
              <div className="space-y-3 bg-gray-800/50 rounded-md p-4">
                {/* Credit Balance */}
                {mode !== 'sponsor' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Wallet className="h-4 w-4" />
                      <span className="text-sm">Credit Balance:</span>
                    </div>
                    <span className="text-white font-semibold">
                      {formatBalance(userInfo.balance || 0)} USDT
                    </span>
                  </div>
                )}

                {/* Principal Balance (from license activations) */}
                {mode !== 'sponsor' && (userInfo.principalBalance ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Wallet className="h-4 w-4" />
                      <span className="text-sm">Principal Balance:</span>
                    </div>
                    <span className="text-blue-400 font-semibold">
                      {formatBalance(userInfo.principalBalance)} USDT
                    </span>
                  </div>
                )}

                {/* License Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">License:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getLicenseStatusColor(userInfo.licenseStatus)}>
                      <div className="flex items-center gap-1">
                        {getLicenseStatusIcon(userInfo.licenseStatus)}
                        <span className="capitalize">{userInfo.licenseStatus || 'None'}</span>
                      </div>
                    </Badge>
                  </div>
                </div>

                {/* License Expiration Details */}
                {userInfo.licenseStatus === 'active' || userInfo.licenseStatus === 'near-expiry' ? (
                  <div className="text-xs text-gray-500">
                    Expires: {userInfo.licenseExpiresAt ? new Date(userInfo.licenseExpiresAt).toLocaleDateString() : 'Unknown'}
                    ({userInfo.daysRemaining} days remaining)
                  </div>
                ) : userInfo.licenseStatus === 'expired' && userInfo.licenseExpiresAt ? (
                  <div className="text-xs text-red-400">
                    Expired: {new Date(userInfo.licenseExpiresAt).toLocaleDateString()}
                  </div>
                ) : null}

                {/* Sponsor Information */}
                {(userInfo.sponsor ?? '').toString().trim() !== '' && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Sponsor:</span>
                    <span className="text-xs text-gray-300 font-mono">
                      {mode === 'sponsor' ? userInfo.sponsor.toString() : `${userInfo.sponsor.toString().slice(0, 8)}...${userInfo.sponsor.toString().slice(-8)}`}
                    </span>
                  </div>
                )}

                {/* Affiliate Earnings */}
                {mode !== 'sponsor' && (userInfo.totalAffiliateEarnings ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Total Affiliate Earnings:</span>
                      <span className="text-green-400 font-semibold">
                        {formatBalance(userInfo.totalAffiliateEarnings)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Available to Withdraw:</span>
                      <span className="text-blue-400 font-semibold">
                        {formatBalance(userInfo.availableAffiliateEarnings || 0)} USDT
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-existent User Message */}
            {!userInfo.exists && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="space-y-2">
                    <div className="text-yellow-400 font-medium">User Not Registered</div>
                    <div className="text-yellow-300 text-sm">
                      This wallet address has not been registered in the system yet.
                      {showCreateOption && (
                        <span className="block mt-1">
                          Credit operations will automatically create a user profile with the dev as sponsor.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}