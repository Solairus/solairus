import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { Sparkles, Shield, Zap, TrendingUp, LogOut } from "lucide-react";
import BackButton from '@/components/ui/BackButton';
import { useSettings } from '@/contexts/settings-context';
import { useAuth } from '@/contexts/auth-context';
import { LicenseBackendService, type BackendLicenseStatus } from '@/services/license/license-backend';
import { LicenseErrorHandler } from "@/utils/license-error-handler";
import { useWallet } from '@/contexts/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { SolairusPayService } from '@/services/wallet/solairus-pay';
import { useBalance } from '@/hooks/useBalance';
import { AuthService } from '@/services/auth/auth-service';

// Backend-only mode: no on-chain balance lookup. USDT balance is not used.

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
  const { account, isConnected, disconnect } = useWalletConnection();
  const { anchorProvider, publicKey } = useWallet();
  const { isLoading: settingsLoading, licenseFeeUsdtMicro, licenseTermDays } = useSettings();
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isActivating, setIsActivating] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ status: BackendLicenseStatus; expirationDate?: Date; isValid: boolean } | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendLicenseStatus>('none');
  const [termDays, setTermDays] = useState<number>(365);
  
  // Get the return path from navigation state, default to /dapp
  const returnPath = location.state?.returnPath || '/dapp';
  
  const [licenseFee, setLicenseFee] = useState<string>('');
  const [licenseFeeMicro, setLicenseFeeMicro] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  // replace local state with hook-provided balance
  const { balanceDisplay: usdtBalance, isLoading: balanceLoading, error: balanceError } = useBalance();
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [attemptedRecovery, setAttemptedRecovery] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string>('');
  const [confirmationCountdown, setConfirmationCountdown] = useState<number | null>(null);

  // Helper to safely compare active status without literal union mismatch
  const isActiveStatus = (s: unknown): boolean => s === 'active';

  // Countdown timer for confirmation waiting
  useEffect(() => {
    if (confirmationCountdown !== null && confirmationCountdown > 0) {
      const timer = setTimeout(() => {
        setConfirmationCountdown(confirmationCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [confirmationCountdown]);

  // Note: License guard check is now handled at the router level in App.tsx

  // Helper: robust micro-USDT -> display (2dp) without floating errors
  const formatUsdtMicro = (micro: number | string) => {
    try {
      const raw = typeof micro === 'string' ? micro : String(micro);
      const digits = raw.replace(/[^0-9]/g, ''); // ensure only digits
      const padded = digits.padStart(7, '0'); // at least 1 whole + 6 fractional
      const whole = padded.slice(0, -6) || '0';
      const fractional = padded.slice(-6);
      const fractional2dp = fractional.slice(0, 2);
      return `${Number(whole).toLocaleString('en-US')}.${fractional2dp}`;
    } catch {
      return '0.00';
    }
  };

  type RecoveryOutcome =
    | { success: true; record: Record<string, unknown> }
    | { success: false; code: 'NO_RECORD' | 'NOT_CONFIRMED' | 'ERROR'; reason: string };

  const ensureBackendSession = async () => {
    if (!account) return;
    const token = localStorage.getItem('solairus.jwt');
    if (!token) {
      await AuthService.authenticateWallet(account);
    }
  };

  const performRecovery = async (): Promise<RecoveryOutcome> => {
    if (!account) {
      return { success: false, code: 'ERROR', reason: 'Wallet not connected' };
    }

    try {
      await ensureBackendSession();

      const lastUrl = `${API_CONFIG.getBaseUrl()}/transactions/last-confirmed?initiatorWallet=${encodeURIComponent(account)}`;
      const lastRes = await ApiClient.get(lastUrl);
      const lastData = await lastRes.json();
      const record = lastData?.record as Record<string, unknown> | undefined | null;

      if (!record || !record['order_id']) {
        return { success: false, code: 'NO_RECORD', reason: 'No pending transaction found. Please activate your license first.' };
      }

      const orderId = record['order_id'] as string;
      const reapplyUrl = `${API_CONFIG.getBaseUrl()}/transactions/reapply-license`;
      const reapplyBody = { initiatorWallet: account, orderId };
      const reappliedRes = await ApiClient.post(reapplyUrl, reapplyBody);
      const reappliedData = await reappliedRes.json();

      if (reappliedRes.ok && reappliedData?.reapplied) {
        await refreshSession();
        return { success: true, record: reappliedData.record as Record<string, unknown> };
      }

      const reason = reappliedData?.error || 'No matching on-chain payment found. Please try activating normally.';
      return { success: false, code: 'NOT_CONFIRMED', reason };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to check payment status';
      return { success: false, code: 'ERROR', reason };
    }
  };

  // Manual payment recovery function (can be triggered by user)
  const checkPaymentStatus = async () => {
    if (!account) return;

    try {
      setIsCheckingPayment(true);
      setRecoveryMessage('Checking for pending payments...');
      setError(null);

      const result = await performRecovery();
      if (result.success) {
        setRecoveryMessage('Payment verified! Activating your license...');
        setAttemptedRecovery(true);

        setTimeout(() => {
          navigate(returnPath, { replace: true });
        }, 1500);
        return;
      }

      setRecoveryMessage('');
      if (result.success) {
        setError('');
      } else {
        setError('reason' in result ? result.reason : 'Recovery failed');
      }
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Load license information
  useEffect(() => {
    const loadLicenseInfo = async () => {
      if (!isConnected || !account) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Backend-only: fetch license info and cost
        const info = await LicenseBackendService.getInfo();
        setLicenseFee(formatUsdtMicro(info.cost_usdt_micro));
        setLicenseFeeMicro(info.cost_usdt_micro);
        setTermDays(info.term_days ?? 365);

        // If already has valid license in backend, redirect
        const backendStatusComputed: BackendLicenseStatus = (info.license_status || user?.license_status || 'none') as BackendLicenseStatus;
        setBackendStatus(backendStatusComputed);
        if (isActiveStatus(backendStatusComputed)) {
          navigate(returnPath, { replace: true });
          return;
        }

        // Silent recovery: if a confirmed license_activation txn exists, reapply without new payment
        // Steps:
        // 1) GET /api/transactions/last-confirmed?initiatorWallet=<account>
        // 2) If record exists and status not active, POST /api/transactions/reapply-license with orderId
        // 3) Refresh session and hard redirect to bypass guard
        if (!attemptedRecovery) {
          try {
            const result = await performRecovery();
            if (result.success && !isActiveStatus(backendStatusComputed)) {
              setAttemptedRecovery(true);
              navigate(returnPath, { replace: true });
              return;
            }
          } catch (recErr) {
            console.warn('Silent recovery attempt failed:', recErr);
          } finally {
            setAttemptedRecovery(true);
          }
        }

        setUsingFallbackData(false);
        // USDT balance is now read via useBalance hook on mount
      } catch (err) {
        console.error('Failed to load license info (backend):', err);
        const msg = err instanceof Error ? err.message : 'Failed to load license information';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadLicenseInfo();
  }, [isConnected, account, navigate, returnPath, settingsLoading, licenseFeeUsdtMicro, user?.license_status, attemptedRecovery]);

  const handleActivation = async () => {
    if (!account) return;
    // Backend-only flow: no balance checks
    setError(null);
    setShowOrderSummary(true);
  };

  const confirmActivation = async () => {
    if (!account || !publicKey) return;

    try {
      setError(null);
      setShowOrderSummary(false);
      setIsActivating(true);
      setConfirmationCountdown(null); // Reset countdown

      // Ensure backend JWT is present before calling protected endpoints
      try {
        const token = localStorage.getItem('solairus.jwt');
        if (!token) {
          await AuthService.authenticateWallet(account);
        }
      } catch (authErr) {
        console.warn('Silent auth failed, proceeding may 401:', authErr);
      }

      // Determine effective cluster to choose correct USDT mint from env
      const overrideCluster = (() => {
        try { return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() } catch { return "" }
      })();
      const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet').toLowerCase();
      const effectiveCluster = overrideCluster || envCluster;
      const normalizedCluster = effectiveCluster.startsWith('mainnet') ? 'mainnet-beta' : 'devnet';
      const usdtMintStr = normalizedCluster === 'mainnet-beta'
        ? (import.meta.env.VITE_USDT_MINT as string)
        : (import.meta.env.VITE_USDT_MINT_DEVNET as string);
      if (!usdtMintStr) throw new Error('USDT mint not configured in .env');
      const usdtMint = new PublicKey(usdtMintStr);

      // Initialize Anchor program service
      if (!anchorProvider) throw new Error('Wallet provider is missing signing capabilities');
      const payService = new SolairusPayService(anchorProvider);

      // 1) Backend init: create or resume transaction record to obtain order ID
      const initUrl = `${API_CONFIG.getBaseUrl()}/payments/activate`;
      const initBody = {
        type: 'license_activation',
        initiatorWallet: account,
        amount: licenseFeeMicro,
        mintAddress: usdtMintStr,
        decimals: 6,
        programId: payService.programId.toBase58(),
        metadata: { flow: 'license_activation' }
      };
      const initRes = await ApiClient.post(initUrl, initBody);
      const initData = await initRes.json();

      // Handle both new transaction (201) and resumed transaction (200)
      let orderId: string;
      if (initRes.status === 200 && initData.resumed && initData.record) {
        // Resumed existing transaction
        orderId = (initData.record.order_id) as string;
        console.log('Resumed existing license activation transaction:', orderId);
      } else if (initRes.status === 201 && initData.record) {
        // Created new transaction
        orderId = (initData.record.order_id) as string;
        console.log('Created new license activation transaction:', orderId);
      } else {
        throw new Error('Failed to initialize payment order (missing order_id)');
      }

      if (!orderId) throw new Error('Failed to initialize payment order (missing order_id)');

      // Check if this is a resumed transaction that already has a signature
      let txSig: string;
      const isResumedTransaction = initRes.status === 200 && initData.resumed;

      if (isResumedTransaction && initData.record?.signature) {
        // Resumed transaction already has a signature, use it
        txSig = initData.record.signature as string;
        setTransactionHash(txSig);
        console.log('Using existing signature from resumed transaction:', txSig);
      } else {
        // New transaction or resumed without signature - make payment
        const memo = orderId;
        txSig = await payService.makePayment({
          payer: publicKey,
          mint: usdtMint,
          recipient: publicKey,
          amount: licenseFeeMicro,
          memo,
        });
        setTransactionHash(txSig);
      }

      // 3) Record transaction signature (only if not already recorded for resumed transactions)
      if (!isResumedTransaction || !initData.record?.signature) {
        const recordUrl = `${API_CONFIG.getBaseUrl()}/transactions/record/signature`;
        const recordBody = {
          orderId,
          signature: txSig,
        };
        const recordRes = await ApiClient.post(recordUrl, recordBody);
        const recordData = await recordRes.json();
        if (!recordRes.ok) {
          const reason = recordData?.error || 'Failed to record signature';
          throw new Error(reason);
        }
      } else {
        console.log('Skipping signature recording for resumed transaction that already has signature');
      }

      // Start countdown for user feedback
      setConfirmationCountdown(30);

      // Poll for backend verification result (backend handles on-chain checking)
      let attempts = 0;
      const maxAttempts = 12; // 12 attempts * 5 seconds = 60 seconds max wait
      while (attempts < maxAttempts) {
        try {
          const statusUrl = `${API_CONFIG.getBaseUrl()}/transactions/${orderId}`;
          const statusRes = await ApiClient.get(statusUrl);
          const statusData = await statusRes.json();

          if (statusData.status === 'confirmed') {
            console.log('✅ Transaction confirmed by backend');
            await refreshSession();

            setSuccessInfo({ status: 'active', expirationDate: undefined, isValid: true });
            setActivationSuccess(true);

            setTimeout(() => {
              navigate(returnPath, { replace: true });
            }, 3000);
            return; // Success!
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.failureReason || statusData.metadata?.failureReason || 'Transaction verification failed');
          } else if (statusData.status === 'pending') {
            // Still processing, wait and try again
            console.log(`⏳ Transaction still pending (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
            attempts++;
            continue;
          } else {
            console.warn('Unexpected transaction status:', statusData.status);
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
            continue;
          }
        } catch (pollError) {
          console.error('Error polling transaction status:', pollError);
          attempts++;
          if (attempts >= maxAttempts) {
            throw pollError;
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error('Transaction verification timed out - please check your transaction status later');
      }

      setRecoveryMessage('Payment submitted. Waiting for backend confirmation. You can use "Check Payment Status" after a short delay.');
      setError('Payment captured and pending confirmation. Please check status shortly.');
    } catch (err) {
      console.error('License activation failed (verification flow):', err);
      setRetryCount(prev => prev + 1);
      setShowOrderSummary(false);

      const licenseError = LicenseErrorHandler.parseError(err);
      setError(licenseError.message);
    } finally {
      setIsActivating(false);
      setConfirmationCountdown(null); // Reset countdown
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
      <SuccessMessage licenseInfo={successInfo || { status: 'active', isValid: true }} transactionHash={transactionHash} />
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-3 p-3">
      {/* Back Button, Network Switcher, and Wallet Disconnect */}
      <HeaderControls disconnect={disconnect} />
      
      {/* Welcome Header */}
      <WelcomeHeader />
      {/* Cost and Balance Badges */}
      {licenseFee && (
        <div className="flex gap-2 justify-center mb-4">
          <Badge variant="secondary" className="text-xs px-2 py-1">
            Cost: {licenseFee} USDT
          </Badge>
          <Badge 
            variant="destructive" 
            className="text-xs px-2 py-1"
          >
            Balance: {usdtBalance}
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
                  {backendStatus === 'active' ? 'Extend License' : 'Activate Yearly License'}
                </h2>
                <p className="text-sm text-gray-600">
                  {backendStatus === 'active'
                    ? `Extend your license for another ${termDays} days`
                    : `Get ${termDays} days (1 year) of full access to Solairus features`
                  }
                </p>
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">📅 License Duration: {termDays} Days</p>
                  <p className="text-xs text-blue-600">Full access to all AI trading features</p>
                </div>
              </div>

              {/* License Fee Display */}
              {licenseFee && (
                <div className={`bg-white/60 rounded-lg p-3 border ${usingFallbackData ? 'border-orange-200 bg-orange-50/50' : 'border-gray-200'}`}>
                  <p className="text-xs text-gray-500 mb-1">
                    License Fee (365 Days)
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {licenseFee} <span className="text-sm font-normal text-gray-500">USDT</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    1 Year of full access to all Solairus features
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => setShowOrderSummary(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isCheckingPayment}
                >
                  <Shield className="w-4 h-4 mr-2" /> Activate License ({termDays} Days)
                </Button>
                <Button
                  onClick={checkPaymentStatus}
                  disabled={isCheckingPayment}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 text-sm"
                >
                  {isCheckingPayment ? 'Checking...' : 'Already Paid? Check Status'}
                </Button>
              </div>
            </>
          ) : (
            <OrderSummary
              licenseFee={licenseFee}
              usdtBalance={usdtBalance}
              licenseTermDays={termDays}
              onConfirm={confirmActivation}
              onCancel={() => setShowOrderSummary(false)}
            />
          )}

          {/* Recovery Message Display */}
          {recoveryMessage && (
            <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-700">Checking Payment</p>
              <p className="text-xs text-blue-600">{recoveryMessage}</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="text-left">
              <p className="text-sm font-semibold text-red-700">Activation Failed</p>
              <p className="text-xs text-red-600">{error}</p>
              <div className="flex gap-2 mt-2">
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
                  onClick={checkPaymentStatus}
                  disabled={isCheckingPayment}
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs px-2 py-1"
                >
                  {isCheckingPayment ? 'Checking...' : 'Check Payment Status'}
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
            </div>
          )}
        </CardContent>
      </Card>

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
                {confirmationCountdown !== null
                  ? `Awaiting blockchain confirmation - ${confirmationCountdown}s`
                  : 'Processing your USDT payment and activating your yearly license...'
                }
              </DialogDescription>
              {confirmationCountdown !== null && (
                <p className="text-xs text-muted-foreground text-center">
                  Please wait while we confirm your transaction on the blockchain.
                </p>
              )}
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderSummary({ licenseFee, usdtBalance, onConfirm, onCancel, licenseTermDays }: { licenseFee: string; usdtBalance: string; onConfirm: () => void; onCancel: () => void; licenseTermDays: number }) {
  return (
    <Card className="bg-white/80 backdrop-blur border-gray-200">
      <CardContent className="p-4 space-y-3">
        <h2 className="text-center text-lg font-semibold text-gray-800">Order Summary</h2>

        <div className="rounded-lg border border-gray-200 bg-white/70 p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">License Duration:</span>
            <span className="font-medium text-gray-800">{licenseTermDays} days</span>
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

        <div className="flex gap-2">
          <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
            Confirm Payment
          </Button>
          <Button onClick={onCancel} className="bg-gray-800 hover:bg-gray-900 text-white">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * WelcomeHeader
 * Purpose: Top header with branding and short description.
 */
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

/**
 * FeaturesOverview
 * Purpose: Small grid of feature highlights.
 */
function FeaturesOverview() {
  const features = [
    { icon: Shield, title: 'Secure Trading', description: 'Bank-grade security' },
    { icon: Zap, title: 'AI-Powered', description: 'Advanced algorithms' },
    { icon: TrendingUp, title: 'Profit Optimization', description: 'Smart strategies' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {features.map(({ icon: Icon, title, description }) => (
        <Card key={title} className="bg-gradient-to-br from-white to-gray-50/80 border-gray-200 shadow-sm">
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

/**
 * HeaderControls
 * Purpose: Back button and disconnect control (simplified).
 */
function HeaderControls({ disconnect }: { disconnect: () => void }) {
  // Restore network switcher: read current cluster from localStorage override with env fallback
  const [currentCluster, setCurrentCluster] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("solana_cluster_override") || (import.meta.env.VITE_SOLANA_CLUSTER as string) || "mainnet-beta"
      );
    } catch {
      return "mainnet-beta";
    }
  });

  const switchNetwork = () => {
    const next = currentCluster === "mainnet-beta" ? "devnet" : "mainnet-beta";
    try {
      localStorage.setItem("solana_cluster_override", next);
      setCurrentCluster(next);
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <BackButton to="/dapp" />
      <div className="flex items-center gap-2">
        {/* Network Badge and Switcher */}
        <div className="flex items-center gap-1">
          <Badge
            variant={currentCluster === "mainnet-beta" ? "default" : "secondary"}
            className="text-xs px-2 py-1"
          >
            {currentCluster === "mainnet-beta" ? "Mainnet" : "Devnet"}
          </Badge>
          <Button
            onClick={switchNetwork}
            variant="ghost"
            size="sm"
            className="text-xs px-1 py-1 h-6 w-6 hover:bg-gray-100"
            title={`Switch to ${currentCluster === "mainnet-beta" ? "Devnet" : "Mainnet"}`}
          >
            🔄
          </Button>
        </div>

        {/* Disconnect Button */}
        <Button
          onClick={disconnect}
          variant="outline"
          size="sm"
          className="flex items-center gap-1 text-xs px-2 py-1 h-8"
        >
          <LogOut className="w-3 h-3" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

/**
 * SuccessMessage
 * Purpose: Post-activation confirmation with optional expiration and Tx hash.
 */
function SuccessMessage({ licenseInfo, transactionHash }: { licenseInfo: { status: BackendLicenseStatus; expirationDate?: Date; isValid: boolean }; transactionHash?: string }) {
  return (
    <div className="max-w-sm mx-auto p-3">
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-4 text-center space-y-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-green-800">Congratulations!</h2>
            <p className="text-sm text-green-700">Your yearly license has been successfully activated</p>
          </div>
          <p className="text-xs text-green-600">You now have full access to all Solairus AI trading features.</p>
          {licenseInfo.expirationDate && (
            <div className="bg-green-100/60 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-xs font-medium text-green-800">License Valid Until:</p>
                <p className="text-sm font-bold text-green-900">{licenseInfo.expirationDate.toLocaleDateString()}</p>
              </div>
              {transactionHash && (
                <div>
                  <p className="text-xs font-medium text-green-700">Transaction Hash:</p>
                  <p className="text-xs font-mono text-green-600 break-all">{transactionHash}</p>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-green-600">Redirecting to dashboard in a few seconds...</p>
        </CardContent>
      </Card>
    </div>
  );
}