import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useLicense } from "@/contexts/license-context";
import LicenseStatusCard from "@/components/license/LicenseStatusCard";
import { Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { LicenseInfo } from "@/lib/solairus-main";
import { LicenseErrorHandler } from "@/utils/license-error-handler";
import * as anchor from "@coral-xyz/anchor";
import { getHealthyRpcConnection } from "@/utils/rpc-switcher";
import BackButton from '@/components/ui/BackButton';

// Helper function to get USDT balance
async function getUsdtBalance(userPubkey: PublicKey, usdtMint: PublicKey): Promise<string> {
  try {
    // Get USDT mint from env or use provided mint
    const mintAddress = import.meta.env.VITE_USDT_MINT || usdtMint.toString();
    const mint = new PublicKey(mintAddress);

    // Create associated token account address
    const associatedTokenAccount = anchor.utils.token.associatedAddress({
      mint,
      owner: userPubkey,
    });

    // Use the same RPC switcher as the rest of the app for consistency
    // This handles comma-separated RPC URLs, fallbacks, and network switching
    const currentCluster = (() => {
      const override = localStorage.getItem("solana_cluster_override")?.toLowerCase();
      const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet").toLowerCase();
      const effective = override || envCluster;
      return effective.startsWith("mainnet") ? "mainnet-beta" :
             effective === "testnet" ? "testnet" : "devnet";
    })() as 'mainnet-beta' | 'devnet' | 'testnet';

    const connection = await getHealthyRpcConnection(currentCluster);

    // Get token account info
    const tokenAccountInfo = await connection.getTokenAccountBalance(associatedTokenAccount);

    // Convert from base units (6 decimals) to display units
    const balance = Number(tokenAccountInfo.value.amount) / 1_000_000;
    return balance.toFixed(2);
  } catch (error) {
    console.warn('Could not fetch USDT balance, account may not exist:', error);
    return "0.00";
  }
}

/**
 * LicenseActivationPage
 * Purpose: Dedicated page for license activation with payment flow
 * Features:
 * - Welcome message with Solairus branding
 * - License fee display and payment
 * - Success state with countdown
 * - Error handling and retry
 * - Responsive mobile-first design
 */
export default function LicenseActivationPage() {
  const { account, isConnected } = useWalletConnection();
  const {
    licenseInfo,
    isLoading: licenseLoading,
    activateLicense,
    isActivating,
    error: licenseError,
    licenseService,
  } = useLicense();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the return path from navigation state, default to /dapp
  const returnPath = location.state?.returnPath || '/dapp';
  
  const [licenseFee, setLicenseFee] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [usdtBalance, setUsdtBalance] = useState<string>('0');
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [transactionHash, setTransactionHash] = useState<string>('');

  // Note: License guard check is now handled at the router level in App.tsx

  // Load license information
  useEffect(() => {
    const loadLicenseInfo = async () => {
      if (!isConnected || !account) {
        setIsLoading(false);
        return;
      }
      
      if (!licenseService) {
        setError('License service is not available. Please refresh the page.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Try to get license fee from contract, use fallback if not deployed
        try {
          const { amount, usdtMint } = await licenseService.getLicenseFee();
          // Format USDT amount safely using proper decimal conversion
          const feeInUsdt = (Number(amount.toString()) / 1_000_000).toFixed(2);
          setLicenseFee(feeInUsdt);

          // Get USDT balance
          try {
            const publicKey = new PublicKey(account);
            const balance = await getUsdtBalance(publicKey, usdtMint);
            setUsdtBalance(balance);
          } catch (balanceError) {
            console.warn('Could not fetch USDT balance:', balanceError);
            setUsdtBalance('0');
          }
        } catch (contractError) {
          console.warn('Contract not deployed yet, using fallback values:', contractError);
          // Use fallback values when contract is not deployed
          setLicenseFee('25.00'); // Default license fee
          setUsdtBalance('100.00'); // Placeholder balance
        }

        // If already has valid license, redirect to intended page
        if (licenseInfo.isValid) {
          navigate(returnPath, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load license info:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load license information';
        
        // Don't show errors for contract deployment issues - we handle this with fallbacks
        if (!errorMessage.includes('Smart contract not deployed') && 
            !errorMessage.includes('Account does not exist') &&
            !errorMessage.includes('AccountNotInitialized') &&
            !errorMessage.includes('Failed to fetch config')) {
          setError(errorMessage);
        }
        // If it's a contract deployment issue, we've already set fallback values above
      } finally {
        setIsLoading(false);
      }
    };

    loadLicenseInfo();
  }, [isConnected, account, licenseService, navigate, licenseInfo.isValid, returnPath]);

  const handleActivation = async () => {
    if (!account) return;

    if (!licenseService) {
      setError('License system is not yet available. Please try again later.');
      return;
    }

    // Check if user has valid license and less than 30 days remaining
    if (licenseInfo.isValid && licenseInfo.daysRemaining !== undefined && licenseInfo.daysRemaining > 30) {
      setError('Your license is still valid for more than 30 days. You can only extend when you have 30 days or less remaining.');
      return;
    }

    // Check USDT balance first
    const balanceNum = parseFloat(usdtBalance);
    const feeNum = parseFloat(licenseFee);

    if (balanceNum < feeNum) {
      setError(`Insufficient USDT balance. You have ${usdtBalance} USDT but need ${licenseFee} USDT.`);
      return;
    }

    // Show order summary in the same card
    setShowOrderSummary(true);
  };

  const confirmActivation = async () => {
    if (!account) return;

    try {
      setError(null);
      setShowOrderSummary(false);

      const txSignature = await activateLicense();

      // Capture the transaction hash for display
      try {
        // activateLicense returns a string transaction signature
        const signature = txSignature as unknown as string;
        if (signature && typeof signature === 'string') {
          setTransactionHash(signature);
        }
      } catch (error) {
        console.warn('Could not capture transaction signature:', error);
      }

      setActivationSuccess(true);

      // Redirect to intended page after a brief success display
      setTimeout(() => {
        navigate(returnPath, { replace: true });
      }, 3000);

    } catch (err) {
      console.error('License activation failed:', err);
      setRetryCount(prev => prev + 1);
      setShowOrderSummary(false);

      // Use enhanced error handler for actionable error messages
      const licenseError = LicenseErrorHandler.parseError(err);
      setError(licenseError.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-sm mx-auto space-y-3 p-3">
        {/* Back Button */}
        <div className="flex items-center justify-start">
          <BackButton to="/dapp" />
        </div>
        
        <WelcomeHeader />
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-3 text-center">
            <p className="text-yellow-800 text-sm">Please connect your wallet to activate your license.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activationSuccess) {
    return (
      <SuccessMessage licenseInfo={licenseInfo} transactionHash={transactionHash} />
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-3 p-3">
      {/* Back Button */}
      <div className="flex items-center justify-start">
        <BackButton to="/dapp" />
      </div>
      
      {/* Welcome Header */}
      <WelcomeHeader />
      
      {/* Cost and Balance Badges */}
      {licenseFee && (
        <div className="flex gap-2 justify-center mb-4">
          <Badge variant="secondary" className="text-xs px-2 py-1">
            Cost: {licenseFee} USDT
          </Badge>
          <Badge 
            variant={parseFloat(usdtBalance) >= parseFloat(licenseFee) ? "default" : "destructive"} 
            className="text-xs px-2 py-1"
          >
            Balance: {usdtBalance} USDT
          </Badge>
        </div>
      )}

      {/* Main License Card */}
      <Card className="bg-gradient-to-br from-slate-50 to-gray-100 border-gray-200">
        <CardContent className="p-4 text-center space-y-3">
          {/* Icon */}
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          
          {!showOrderSummary ? (
            <>
              {/* License Status */}
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-800">
                  {licenseInfo.isValid ? 'Extend License' : 'Activate Yearly License'}
                </h2>
                <p className="text-sm text-gray-600">
                  {licenseInfo.isValid 
                    ? `Extend your license for another 365 days (1 year)`
                    : 'Get 365 days (1 year) of full access to Solairus features'
                  }
                </p>
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">📅 License Duration: 365 Days (1 Year)</p>
                  <p className="text-xs text-blue-600">Full access to all AI trading features</p>
                </div>
              </div>

              {/* License Fee Display */}
              {licenseFee && (
                <div className="bg-white/60 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">License Fee (365 Days)</p>
                  <p className="text-2xl font-bold text-gray-800">{licenseFee} <span className="text-sm font-normal text-gray-500">USDT</span></p>
                  <p className="text-xs text-gray-500 mt-1">1 Year of full access to all Solairus features</p>
                </div>
              )}

              {/* Activate Button */}
              <Button
                onClick={handleActivation}
                disabled={isLoading || licenseLoading || isActivating || parseFloat(usdtBalance) < parseFloat(licenseFee)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2.5 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                size="sm"
              >
                {isLoading || licenseLoading ? (
                  'Loading...'
                ) : isActivating ? (
                  'Processing...'
                ) : (
                  <>🚀 Activate License (365 Days)</>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Order Summary */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Order Summary</h3>
                
                <div className="bg-white/60 rounded-lg p-3 border border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">License Duration:</span>
                    <span className="font-medium text-gray-800">365 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Payment Amount:</span>
                    <span className="font-medium text-gray-800">{licenseFee} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Network Fee:</span>
                    <span className="font-medium text-gray-800">~0.01 SOL</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-800">Total:</span>
                      <span className="text-gray-800">{licenseFee} USDT</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  You are about to activate your yearly Solairus license.
                </p>

                {/* Confirmation Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={confirmActivation}
                    disabled={isActivating}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                    size="sm"
                  >
                    {isActivating ? 'Processing...' : 'Confirm Payment'}
                  </Button>
                  <Button
                    onClick={() => setShowOrderSummary(false)}
                    variant="outline"
                    disabled={isActivating}
                    className="flex-1 py-2 text-sm border-gray-300 hover:bg-gray-50 transition-all duration-200 active:scale-95"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {(error || licenseError) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 text-red-600 mt-0.5">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-red-800 text-sm">Activation Failed</h4>
                <p className="text-red-700 text-xs mt-1">{error || licenseError}</p>
                {retryCount > 0 && (
                  <p className="text-red-600 text-xs mt-1">
                    Attempt {retryCount} failed. You can try again.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                  setShowOrderSummary(false);
                  handleActivation();
                }}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100 text-xs px-2 py-1"
              >
                Try Again
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                  setShowOrderSummary(false);
                }}
                variant="outline"
                size="sm"
                className="text-xs px-2 py-1"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Overview */}
      <FeaturesOverview />

      {/* License Activation Modal */}
      <Dialog open={isActivating} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm mx-auto [&>button]:hidden">
          <DialogHeader>
            <div className="flex flex-col items-center space-y-4 pt-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <DialogTitle className="text-lg font-semibold text-blue-800">
                Activating License
              </DialogTitle>
              <DialogDescription className="text-center text-blue-600">
                Processing your USDT payment and activating your yearly license...
              </DialogDescription>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Welcome Header Component
function WelcomeHeader() {
  return (
    <Card className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-blue-200">
      <CardContent className="p-3 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            Welcome to Solairus
          </h1>
          <Sparkles className="w-4 h-4 text-blue-600" />
        </div>
        <p className="text-sm text-gray-600 font-medium mb-2">
          Your Smartest AI Trading Agents Portal
        </p>
        <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
          Premium AI Trading Platform
        </Badge>
        <p className="text-xs text-gray-500 mt-2">
          To proceed and unlock the full potential of AI-powered trading, please activate your yearly license.
        </p>
      </CardContent>
    </Card>
  );
}

// Features Overview Component - Mobile app-like 3 inline cards
function FeaturesOverview() {
  const features = [
    {
      icon: Shield,
      title: "Secure Trading",
      description: "Bank-grade security"
    },
    {
      icon: Zap,
      title: "AI-Powered",
      description: "Advanced algorithms"
    },
    {
      icon: TrendingUp,
      title: "Profit Optimization",
      description: "Smart strategies"
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {features.map(({ icon: Icon, title, description }) => (
        <Card key={title} className="bg-gradient-to-br from-white to-gray-50/80 border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95">
          <CardContent className="p-3 text-center space-y-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Icon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-gray-800 leading-tight">{title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-tight">{description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Success Message Component
function SuccessMessage({ licenseInfo, transactionHash }: { licenseInfo: LicenseInfo; transactionHash?: string }) {
  return (
    <div className="max-w-sm mx-auto p-3">
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-4 text-center space-y-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-green-800">
              Congratulations!
            </h2>
            <p className="text-sm text-green-700">
              Your yearly license has been successfully activated
            </p>
          </div>

          <p className="text-xs text-green-600">
            You now have full access to all Solairus AI trading features.
          </p>
          
          {licenseInfo.expirationDate && (
            <div className="bg-green-100/60 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-xs font-medium text-green-800">
                  License Valid Until:
                </p>
                <p className="text-sm font-bold text-green-900">
                  {licenseInfo.expirationDate.toLocaleDateString()}
                </p>
              </div>
              {transactionHash && (
                <div>
                  <p className="text-xs font-medium text-green-700">
                    Transaction Hash:
                  </p>
                  <p className="text-xs font-mono text-green-600 break-all">
                    {transactionHash}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <p className="text-xs text-green-600">
            Redirecting to dashboard in a few seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}