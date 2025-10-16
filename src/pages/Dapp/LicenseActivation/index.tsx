import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useLicense } from "@/contexts/license-context";
import LicenseStatusCard from "@/components/license/LicenseStatusCard";
import { Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { LicenseInfo } from "@/lib/solairus-main";
import { LicenseErrorHandler } from "@/utils/license-error-handler";
import * as anchor from "@coral-xyz/anchor";
import { getHealthyRpcConnection } from "@/utils/rpc-switcher";

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
  
  const [licenseFee, setLicenseFee] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [usdtBalance, setUsdtBalance] = useState<string>('0');
  const [showConfirmation, setShowConfirmation] = useState(false);
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

        // If already has valid license, redirect to home
        if (licenseInfo.isValid) {
          navigate('/dapp', { replace: true });
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
  }, [isConnected, account, licenseService, navigate, licenseInfo.isValid]);

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

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const confirmActivation = async () => {
    if (!account) return;

    try {
      setError(null);
      setShowConfirmation(false);

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

      // Redirect to home after a brief success display
      setTimeout(() => {
        navigate('/dapp', { replace: true });
      }, 3000);

    } catch (err) {
      console.error('License activation failed:', err);
      setRetryCount(prev => prev + 1);

      // Use enhanced error handler for actionable error messages
      const licenseError = LicenseErrorHandler.parseError(err);
      setError(licenseError.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <WelcomeHeader />
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <p className="text-yellow-800">Please connect your wallet to activate your license.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activationSuccess) {
    return (
      <div className="space-y-6">
        <SuccessMessage licenseInfo={licenseInfo} transactionHash={transactionHash} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Welcome Header */}
      <WelcomeHeader />
      
      {/* Main Activation Card - Center */}
      <div className="flex-1 flex items-center justify-center py-8">
        <LicenseStatusCard
          status={licenseInfo.status}
          expirationDate={licenseInfo.expirationDate}
          daysRemaining={licenseInfo.daysRemaining}
          onActivate={handleActivation}
          isLoading={isLoading || licenseLoading || isActivating}
          licenseFee={licenseFee}
        />
      </div>
      
      {/* Features Overview - Bottom */}
      <FeaturesOverview />

      {/* Error Display */}
      {(error || licenseError) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-red-600 mt-0.5">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 text-sm">Activation Failed</h4>
                <p className="text-red-700 text-sm mt-1">{error || licenseError}</p>
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
                  handleActivation();
                }}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Try Again
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                }}
                variant="outline"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* USDT Balance Display */}
      {licenseFee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Your USDT Balance:</span>
              <span className="text-lg font-bold">{usdtBalance} USDT</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">License Fee:</span>
              <span className="text-lg font-bold text-primary">{licenseFee} USDT</span>
            </div>
            {parseFloat(usdtBalance) < parseFloat(licenseFee) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Insufficient USDT balance. Please add more USDT to your wallet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Confirmation Dialog */}
      {showConfirmation && (
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Confirm License Activation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to activate your yearly Solairus license for {licenseFee} USDT.
            </p>
            <div className="p-3 bg-background rounded-lg border">
              <div className="flex justify-between text-sm">
                <span>License Duration:</span>
                <span className="font-medium">365 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Amount:</span>
                <span className="font-medium">{licenseFee} USDT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Transaction Fee:</span>
                <span className="font-medium">~0.01 SOL</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={confirmActivation}
                className="flex-1"
                disabled={isActivating}
              >
                {isActivating ? 'Processing...' : 'Confirm Payment'}
              </Button>
              <Button
                onClick={() => setShowConfirmation(false)}
                variant="outline"
                className="flex-1"
                disabled={isActivating}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isActivating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6 text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <h3 className="text-lg font-semibold text-blue-800">Activating License</h3>
            <p className="text-sm text-blue-600">
              Processing your USDT payment and activating your yearly license...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Welcome Header Component
function WelcomeHeader() {
  return (
    <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 mx-4 mt-4">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Welcome to Solairus
          </CardTitle>
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <p className="text-lg text-foreground font-medium">
          Your Smartest AI Trading Agents Portal
        </p>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground mb-4">
          To proceed and unlock the full potential of AI-powered trading, please activate your yearly license.
        </p>
        <Badge variant="outline" className="text-xs">
          Premium AI Trading Platform
        </Badge>
      </CardContent>
    </Card>
  );
}

// Features Overview Component - Mobile-friendly bottom section
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
    <div className="mt-auto pb-4">
      <div className="grid grid-cols-3 gap-3 px-2">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="text-center p-3 rounded-lg bg-muted/30">
            <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="font-medium text-xs mb-1 text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground leading-tight">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Success Message Component
function SuccessMessage({ licenseInfo, transactionHash }: { licenseInfo: LicenseInfo; transactionHash?: string }) {
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-green-800">
            Congratulations!
          </CardTitle>
          <p className="text-green-700">
            Your yearly license has been successfully activated
          </p>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-green-600">
            You now have full access to all Solairus AI trading features.
          </p>
          
          {licenseInfo.expirationDate && (
            <div className="p-4 bg-green-100 rounded-lg space-y-2">
              <div>
                <p className="text-sm font-medium text-green-800">
                  License Valid Until:
                </p>
                <p className="text-lg font-bold text-green-900">
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