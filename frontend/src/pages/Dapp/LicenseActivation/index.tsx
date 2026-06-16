import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { Sparkles, Shield, Zap, TrendingUp, LogOut, ArrowLeft, Wallet } from "lucide-react";
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/contexts/auth-context';
import { LicenseBackendService, type BackendLicenseStatus } from '@/services/license/license-backend';
import { useBalance } from '@/hooks/useBalance';
import { AuthService } from '@/services/auth/auth-service';
import { PaymentOrderPanel } from '@/components/payment/PaymentOrderPanel';

/**
 * LicenseActivationPage (contract-free)
 * Flow: create a license payment order → show unique address + QR + countdown → poll
 *       until the backend detects the payment and activates the license. No wallet signing.
 */
export default function LicenseActivationPage() {
  const { account, isConnected, disconnect } = useWalletConnection();
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [successInfo, setSuccessInfo] = useState<{ status: BackendLicenseStatus; expirationDate?: Date; isValid: boolean } | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendLicenseStatus>('none');
  const [termDays, setTermDays] = useState<number>(365);
  const [licenseFee, setLicenseFee] = useState<string>('');
  const [licenseFeeMicro, setLicenseFeeMicro] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payingWithBalance, setPayingWithBalance] = useState(false);
  const { balanceDisplay: usdtBalance, balanceMicro } = useBalance();

  const creditMicro = (() => { try { return BigInt(user?.credit_balance_micro ?? '0'); } catch { return 0n; } })();
  const canPayWithBalance = licenseFeeMicro > 0 && creditMicro >= BigInt(licenseFeeMicro);

  const returnPath = location.state?.returnPath || '/dapp';
  const isActiveStatus = (s: unknown): boolean => s === 'active';

  // Robust micro-USDT -> 2dp display.
  const formatUsdtMicro = (micro: number | string) => {
    try {
      const digits = (typeof micro === 'string' ? micro : String(micro)).replace(/[^0-9]/g, '');
      const padded = digits.padStart(7, '0');
      const whole = padded.slice(0, -6) || '0';
      const fractional2dp = padded.slice(-6).slice(0, 2);
      return `${Number(whole).toLocaleString('en-US')}.${fractional2dp}`;
    } catch {
      return '0.00';
    }
  };

  useEffect(() => {
    const loadLicenseInfo = async () => {
      if (!isConnected || !account) { setIsLoading(false); return; }
      try {
        setIsLoading(true);
        setError(null);
        const info = await LicenseBackendService.getInfo();
        setLicenseFee(formatUsdtMicro(info.cost_usdt_micro));
        setLicenseFeeMicro(info.cost_usdt_micro);
        setTermDays(info.term_days ?? 365);

        const computed: BackendLicenseStatus = (info.license_status || user?.license_status || 'none') as BackendLicenseStatus;
        setBackendStatus(computed);
        if (isActiveStatus(computed)) {
          await refreshSession();
          navigate(returnPath, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load license info (backend):', err);
        setError(err instanceof Error ? err.message : 'Failed to load license information');
      } finally {
        setIsLoading(false);
      }
    };
    loadLicenseInfo();
  }, [isConnected, account, navigate, returnPath, user?.license_status, refreshSession]);

  const handleCompleted = useCallback(async () => {
    setShowPay(false);
    setSuccessInfo({ status: 'active', isValid: true });
    setActivationSuccess(true);
    try { await refreshSession(); } catch { /* guard refresh */ }
    setTimeout(() => navigate(returnPath, { replace: true }), 2500);
  }, [refreshSession, navigate, returnPath]);

  const startActivation = async () => {
    if (!account) return;
    // Ensure a backend session exists before creating a protected order.
    try { if (!localStorage.getItem('solairus.jwt')) await AuthService.authenticateWallet(account); } catch { /* will 401 if truly missing */ }
    setError(null);
    setShowPay(true);
  };

  const activateWithBalance = async () => {
    if (!account || !canPayWithBalance) return;
    setError(null);
    setPayingWithBalance(true);
    try {
      if (!localStorage.getItem('solairus.jwt')) await AuthService.authenticateWallet(account);
      await LicenseBackendService.activate({ paymentMethod: 'balance' });
      await handleCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation from balance failed');
    } finally {
      setPayingWithBalance(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-sm mx-auto space-y-3 p-3">
        <div className="flex items-center justify-start"><BackButton to="/dapp" /></div>
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
    return <SuccessMessage licenseInfo={successInfo || { status: 'active', isValid: true }} />;
  }

  // Focused payment view: only the QR/address panel + a back button (no scrolling).
  if (showPay) {
    return (
      <div className="max-w-sm mx-auto space-y-3 p-3">
        <button
          onClick={() => setShowPay(false)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">Activate License</h2>
          <p className="text-xs text-gray-500">Send {licenseFee} USDT to the address below</p>
        </div>
        <PaymentOrderPanel
          type="license"
          onCompleted={handleCompleted}
          onCancel={() => setShowPay(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-3 p-3">
      <HeaderControls disconnect={disconnect} />
      <WelcomeHeader />

      {licenseFee && (
        <div className="flex gap-2 justify-center mb-4">
          <Badge variant="secondary" className="text-xs px-2 py-1">Cost: {licenseFee} USDT</Badge>
          {balanceMicro !== null && balanceMicro > 0 && (
            <Badge variant="destructive" className="text-xs px-2 py-1">Balance: {usdtBalance}</Badge>
          )}
          {creditMicro > 0n && (
            <Badge variant="outline" className="text-xs px-2 py-1 border-green-500 text-green-700 bg-green-50">
              Credit: ${formatUsdtMicro(creditMicro.toString())}
            </Badge>
          )}
        </div>
      )}

      <Card className="bg-gradient-to-br from-slate-50 to-gray-100 border-gray-200">
        <CardContent className="p-4 text-center space-y-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {backendStatus === 'active' ? 'Extend License' : 'Activate Yearly License'}
            </h2>
            <p className="text-sm text-gray-600">
              {backendStatus === 'active'
                ? `Extend your license for another ${termDays} days`
                : `Get ${termDays} days (1 year) of full access to Solairus features`}
            </p>
            <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">📅 License Duration: {termDays} Days</p>
              <p className="text-xs text-blue-600">Full access to all AI trading features</p>
            </div>
          </div>

          {licenseFee && (
            <div className="bg-white/60 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">License Fee ({termDays} Days)</p>
              <p className="text-2xl font-bold text-gray-900">
                {licenseFee} <span className="text-sm font-normal text-gray-500">USDT</span>
              </p>
              <p className="text-xs text-gray-500">1 Year of full access to all Solairus features</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={startActivation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              <Shield className="w-4 h-4 mr-2" /> Activate License ({termDays} Days)
            </Button>
            {canPayWithBalance && (
              <Button
                onClick={activateWithBalance}
                disabled={payingWithBalance}
                variant="outline"
                className="w-full border-green-500 text-green-700 hover:bg-green-50"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {payingWithBalance ? 'Activating…' : `Pay with balance ($${formatUsdtMicro(String(licenseFeeMicro))})`}
              </Button>
            )}
          </div>

          {error && (
            <div className="text-left">
              <p className="text-sm font-semibold text-red-700">Activation Error</p>
              <p className="text-xs text-red-600 break-words">{error}</p>
              <Button onClick={() => setError(null)} variant="outline" size="sm" className="text-xs px-2 py-1 mt-2">Dismiss</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <FeaturesOverview />
    </div>
  );
}

/** Top header with branding and short description. */
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
        <p className="text-sm text-gray-600 font-medium mb-2">Your Smartest AI Trading Agents Portal</p>
        <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Premium AI Trading Platform</Badge>
        <p className="text-xs text-gray-500 mt-2">
          To proceed and unlock the full potential of AI-powered trading, please activate your yearly license.
        </p>
      </CardContent>
    </Card>
  );
}

/** Small grid of feature highlights. */
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

/** Back button, network switcher, and disconnect control. */
function HeaderControls({ disconnect }: { disconnect: () => void }) {
  const [currentCluster, setCurrentCluster] = useState<string>(() => {
    try {
      return localStorage.getItem("solana_cluster_override") || (import.meta.env.VITE_SOLANA_CLUSTER as string) || "mainnet-beta";
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
        <div className="flex items-center gap-1">
          <Badge variant={currentCluster === "mainnet-beta" ? "default" : "secondary"} className="text-xs px-2 py-1">
            {currentCluster === "mainnet-beta" ? "Mainnet" : "Devnet"}
          </Badge>
          <Button onClick={switchNetwork} variant="ghost" size="sm" className="text-xs px-1 py-1 h-6 w-6 hover:bg-gray-100"
            title={`Switch to ${currentCluster === "mainnet-beta" ? "Devnet" : "Mainnet"}`}>
            🔄
          </Button>
        </div>
        <Button onClick={disconnect} variant="outline" size="sm" className="flex items-center gap-1 text-xs px-2 py-1 h-8">
          <LogOut className="w-3 h-3" /> Disconnect
        </Button>
      </div>
    </div>
  );
}

/** Post-activation confirmation. */
function SuccessMessage({ licenseInfo }: { licenseInfo: { status: BackendLicenseStatus; expirationDate?: Date; isValid: boolean } }) {
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
              <p className="text-xs font-medium text-green-800">License Valid Until:</p>
              <p className="text-sm font-bold text-green-900">{licenseInfo.expirationDate.toLocaleDateString()}</p>
            </div>
          )}
          <p className="text-xs text-green-600">Redirecting to dashboard in a few seconds...</p>
        </CardContent>
      </Card>
    </div>
  );
}
