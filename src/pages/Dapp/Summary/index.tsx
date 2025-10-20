import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useLicense } from '@/contexts/license-context';
import { getUserAgentStatistics, type AgentStatistics } from '@/services/agent/agent-service';
import { getWithdrawalLimitDisplay } from '@/services/agent/withdrawal-limit-service';
import WalletGate from '@/components/WalletGate';
import LicenseGuard from '@/components/license/LicenseGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Shield, 
  Bot, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/ui/BackButton';

export default function DappSummary() {
  const { publicKey, provider } = useWallet();
  const { licenseInfo, isLoading: licenseLoading } = useLicense();
  const navigate = useNavigate();
  
  const [agentStats, setAgentStats] = useState<AgentStatistics | null>(null);
  const [withdrawalStats, setWithdrawalStats] = useState<{
    totalDeposits: string;
    totalWithdrawn: string;
    usagePercentage: number;
    isPrivileged: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = useCallback(async (isRefresh = false) => {
    if (!publicKey || !provider) return;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const [stats, withdrawalData] = await Promise.all([
        getUserAgentStatistics(provider, publicKey),
        getWithdrawalLimitDisplay(provider, publicKey)
      ]);
      
      setAgentStats(stats);
      setWithdrawalStats(withdrawalData);
    } catch (error) {
      console.error('Error fetching account data:', error);
      setError('Failed to load account data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey, provider]);

  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  const handleRefresh = () => {
    fetchAccountData(true);
  };

  const handleExtendLicense = () => {
    navigate('/dapp/license-activation');
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isNearExpiry = licenseInfo?.daysRemaining !== null && 
                    licenseInfo?.daysRemaining !== undefined && 
                    licenseInfo.daysRemaining <= 30 && 
                    licenseInfo.daysRemaining > 0;

  // Show loading state if license is still loading or licenseInfo is not available
  if (licenseLoading || !licenseInfo) {
    return (
      <LicenseGuard>
        <WalletGate>
          <div className="max-w-sm mx-auto space-y-4">
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading account information...</p>
            </div>
          </div>
        </WalletGate>
      </LicenseGuard>
    );
  }

  return (
    <LicenseGuard>
      <WalletGate>
        <div className="max-w-sm mx-auto space-y-4">
          {/* Back Button */}
          <div className="flex items-center justify-start">
            <BackButton to="/dapp" />
          </div>
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Account Summary</h1>
              <p className="text-xs text-muted-foreground">
                Overview of your license, agents, and earnings
              </p>
            </div>
            
            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* License Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                License Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <div className="flex items-center gap-2">
                  {licenseInfo?.isValid ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                        Active
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <Badge variant="destructive">
                        Inactive
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {licenseInfo?.isValid && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expires:</span>
                    <span className="text-sm font-medium">
                      {formatDate(licenseInfo?.expirationDate || null)}
                    </span>
                  </div>

                  {licenseInfo?.daysRemaining !== null && licenseInfo?.daysRemaining !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Days Remaining:</span>
                      <span className={`text-sm font-medium ${isNearExpiry ? 'text-amber-600' : 'text-foreground'}`}>
                        {licenseInfo.daysRemaining} days
                      </span>
                    </div>
                  )}

                  {isNearExpiry && licenseInfo?.daysRemaining !== undefined && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-amber-800 font-medium">License Expiring Soon</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Your license expires in {licenseInfo.daysRemaining} days. Extend now to avoid service interruption.
                          </p>
                          <Button
                            size="sm"
                            onClick={handleExtendLicense}
                            className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Extend License
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!licenseInfo?.isValid && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium">No Active License</p>
                      <p className="text-xs text-red-700 mt-1">
                        You need an active license to use Solairus features.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleExtendLicense}
                        className="mt-2 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Activate License
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trading Overview Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trading Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="text-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-2">Loading trading data...</p>
                </div>
              ) : agentStats ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Agents:</span>
                    <span className="text-sm font-medium">{agentStats.totalAgents}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Agents:</span>
                    <span className="text-sm font-medium">{agentStats.activeAgents}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Liquidity:</span>
                    <span className="text-sm font-medium">
                      ${agentStats.totalInvested.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total PnL Claimed:</span>
                    <span className="text-sm font-medium text-green-600">
                      ${agentStats.totalWithdrawn.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                  
                  {withdrawalStats && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Max PnL Volume:</span>
                      <span className="text-sm font-medium">
                        {withdrawalStats.isPrivileged ? 'Unlimited' : `${withdrawalStats.usagePercentage.toFixed(1)}% used`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No trading data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </WalletGate>
    </LicenseGuard>
  );
}