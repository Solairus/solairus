import React, { useState, useEffect } from "react";
import { useWallet } from '@/contexts/wallet-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  TrendingUp,
  Shield,
  Zap,
  DollarSign,
  History,
  ArrowRight,
  CreditCard,
  Wallet,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
// Remove solairus-removed integrations and activation service for now
import { useAgentErrorHandler } from '@/utils/agent-error-handler';
import { AgentErrorDisplay } from '@/components/agent/AgentErrorDisplay';
import AgentHireCard from '@/components/agent/AgentHireCard';
import WalletGate from '@/components/WalletGate';
import LicenseGuard from '@/components/license/LicenseGuard';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/ui/BackButton';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { PaymentOrderPanel } from '@/components/payment/PaymentOrderPanel';
import { AuthService } from '@/services/auth/auth-service';
import {
  getAgentTiersMap,
  type AgentTierRow,
  formatDailyRange,
  microToUsdt,
} from '@/services/agent/tiers-backend';
import { useBalance } from '@/hooks/useBalance';
import { useAuth } from '@/contexts/auth-context';

// UI metadata per tier (non-data visuals only)
const TIER_META: Record<string, { name: string; emoji: string; description: string; color: 'cyan' | 'emerald' | 'indigo' | 'amber' }>= {
  NOVA: { name: 'NOVA Agent', emoji: '🪶', description: 'Pattern Seeker • Low Risk', color: 'cyan' },
  VEGA: { name: 'VEGA Agent', emoji: '🔮', description: 'Momentum Scout • Medium Risk', color: 'emerald' },
  ORION: { name: 'ORION Agent', emoji: '⚡', description: 'Risk Balancer • High Risk', color: 'indigo' },
  PRIME: { name: 'PRIME Agent', emoji: '🧠', description: 'Alpha Hunter • Max Risk', color: 'amber' },
};

// Presentational tier list for the hire cards. Derives name/emoji/accent from
// TIER_META (single source of truth); adds the listing-card visuals only.
const TIERS = (
  [
    { key: 'NOVA', image: '/media/agents/nova.jpeg', tagline: 'Pattern Seeker', riskLabel: 'Low Risk' },
    { key: 'VEGA', image: '/media/agents/vega.jpeg', tagline: 'Momentum Scout', riskLabel: 'Medium Risk' },
    { key: 'ORION', image: '/media/agents/orion.jpeg', tagline: 'Risk Balancer', riskLabel: 'High Risk' },
    { key: 'PRIME', image: '/media/agents/prime.jpeg', tagline: 'Alpha Hunter', riskLabel: 'Max Risk' },
  ] as const
).map((t) => ({
  ...t,
  name: TIER_META[t.key].name,
  emoji: TIER_META[t.key].emoji,
  accent: TIER_META[t.key].color,
}));

type ActivationStep = 'input' | 'processing' | 'success' | 'error';
// Local stub for activation result to preserve success UI
type AgentActivationResult = { success: boolean };

// Note: On-chain balances are not fetched at this stage.

/**
 * Get tier-specific success message
 */
function getTierSpecificSuccessMessage(tierName: string, amount: string, row?: AgentTierRow): string {
  const meta = TIER_META[tierName];
  const dailyRange = row ? formatDailyRange(row.daily_reward_min_bp, row.daily_reward_max_bp) : 'daily returns';
  if (!meta) {
    return 'Your AI trading agent is now active and ready to generate returns.';
  }
  switch (tierName) {
    case 'NOVA':
      return `Your ${meta.name} is now active with $${amount} investment. Expect steady daily returns between ${dailyRange} with minimal risk.`;
    case 'VEGA':
      return `Your ${meta.name} is now active with $${amount} investment. Enjoy balanced daily returns between ${dailyRange} with moderate risk.`;
    case 'ORION':
      return `Your ${meta.name} is now active with $${amount} investment. Prepare for aggressive daily returns between ${dailyRange} with higher volatility.`;
    case 'PRIME':
      return `Your ${meta.name} is now active with $${amount} investment. Experience elite daily returns between ${dailyRange} with maximum potential.`;
    default:
      return `Your ${meta.name} is now active with $${amount} investment and ready to generate returns.`;
  }
}

// Enhanced Direct Hire Modal Component with Full Implementation
function DirectHireModal({
  isOpen,
  onClose,
  tierName,
  userPublicKey,
  onSuccess,
  tierRow,
  tiersMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  userPublicKey: PublicKey;
  onSuccess: () => void;
  tierRow?: AgentTierRow;
  tiersMap?: Record<string, AgentTierRow>;
}) {
  const [step, setStep] = useState<ActivationStep>('input');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'usdt' | 'credit'>('usdt');
  const [activationResult, setActivationResult] = useState<AgentActivationResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [paymentAmountMicro, setPaymentAmountMicro] = useState<number>(0);

  // USDT on-chain balance via reusable hook (same as license activation page)
  const { balanceDisplay: usdtBalanceDisplay, isLoading: usdtLoading, error: usdtError, refresh: refreshUsdt, balanceMicro: usdtBalanceMicro } = useBalance();
  const { user: authUser } = useAuth();

  const { showError, showSuccess } = useAgentErrorHandler();
  const tierMeta = TIER_META[tierName];

  // Fetch user balances
  const fetchBalances = React.useCallback(async () => {
    if (!userPublicKey) {
      setCreditBalance(0);
      setLoadingBalance(false);
      return;
    }

    try {
      setLoadingBalance(true);
      // Prefer AuthContext user; fall back to cached user
      const raw = (authUser?.credit_balance_micro) ?? (AuthService.getCachedUser()?.credit_balance_micro) ?? '0';
      const credit = Number(raw);
      setCreditBalance(Number.isFinite(credit) ? credit : 0);
      // Proactively refresh USDT balance from chain
      await refreshUsdt();
    } catch (e) {
      console.warn('[Hire] Failed to fetch balances:', e);
      setCreditBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  // Fetch balances when modal opens
  React.useEffect(() => {
    if (isOpen && userPublicKey) {
      fetchBalances();
    }
  }, [isOpen, userPublicKey, fetchBalances]);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setStep('input');
    setAmount('');
    setPaymentMethod('usdt');
    setActivationResult(null);
    setError(null);
    setCreditBalance(null);
    setShowPaymentPanel(false);
    setPaymentAmountMicro(0);
    onClose();
  };

  const handleOrderCompleted = () => {
    setShowPaymentPanel(false);
    setActivationResult({ success: true });
    setStep('success');
    showSuccess('Agent activation successful', {
      description: getTierSpecificSuccessMessage(tierName, Number.parseFloat(amount || '0').toFixed(2), tierRow),
      duration: 6000,
    });
    onSuccess();
  };

  const handleActivate = async () => {
    const investmentAmount = parseFloat(amount);

    if (!amount || investmentAmount <= 0) {
      showError('Please enter a valid amount', 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }

    if (!tierMeta) {
      showError('Invalid tier configuration', 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }

    // Validate investment amount against tier limits
    if (!tierRow) {
      showError('Tier data unavailable', 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }
    const minInv = microToUsdt(tierRow.min_amount);
    const maxInv = microToUsdt(tierRow.max_amount);
    if (investmentAmount < minInv) {
      showError(`Minimum investment for ${tierMeta.name} is $${minInv} USDT`, 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }

    if (investmentAmount > maxInv) {
      showError(`Maximum investment for ${tierMeta.name} is $${maxInv.toLocaleString()} USDT`, 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }
    // Credit payment path (backend-only; uses cached credit balance)
    if (paymentMethod === 'credit') {
      const availableMicro = Number(creditBalance ?? 0);
      const requestedMicro = Math.floor(investmentAmount * 1_000_000);
      if (!Number.isFinite(availableMicro) || requestedMicro <= 0 || requestedMicro > availableMicro) {
        const availUsd = (availableMicro / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        showError(`Insufficient credit balance. Available: $${availUsd}`, 'Agent activation', undefined, { showRetry: false, duration: 5000 });
        return;
      }

      try {
        setStep('processing');
        setError(null);

        const amountMicro = requestedMicro;
        const initUrl = `${API_CONFIG.getBaseUrl()}/agents/activate`;
        const initBody = { amountMicro, paymentMethod: 'credit', tierName };
        const initRes = await ApiClient.post(initUrl, initBody);
        const initData = await initRes.json();
        if (!initRes.ok || !initData?.activated) {
          throw new Error(initData?.error || 'Credit activation failed');
        }

        setActivationResult({ success: true });
        setStep('success');
        showSuccess('Agent activation successful', {
          description: getTierSpecificSuccessMessage(tierName, Number.parseFloat(amount || '0').toFixed(2), tierRow),
          duration: 6000,
        });
        onSuccess();
        return;
      } catch (e) {
        console.error('[Hire] Credit activation failed:', e);
        setError(e);
        setStep('error');
        showError(e instanceof Error ? e.message : 'Credit activation failed', 'Agent activation', undefined, { showRetry: true, duration: 6000 });
        return;
      }
    }

    // USDT payment via PaymentOrderPanel (HD wallet, contract-free)
    try {
      // Ensure backend JWT is present before calling protected endpoints
      const token = localStorage.getItem('solairus.jwt');
      if (!token && userPublicKey) {
        await AuthService.authenticateWallet(userPublicKey.toBase58());
      }
    } catch (authErr) {
      console.warn('[Hire] Silent auth failed, proceeding may 401:', authErr);
    }

    const amountMicro = Math.round(investmentAmount * 1_000_000);
    if (!Number.isFinite(amountMicro) || amountMicro <= 0) {
      showError('Invalid amount', 'Agent activation', undefined, { showRetry: false, duration: 4000 });
      return;
    }

    setPaymentAmountMicro(amountMicro);
    setShowPaymentPanel(true);
  };

  const handleRetry = () => {
    setStep('input');
    setError(null);
    setActivationResult(null);
  };

  const handleStartOver = () => {
    setStep('input');
    setAmount('');
    setPaymentMethod('usdt');
    setActivationResult(null);
    setError(null);
    setShowPaymentPanel(false);
    setPaymentAmountMicro(0);
  };

  // PaymentOrderPanel handles its own expired/cancelled/retry states internally.

  if (!tierMeta) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">{tierMeta.emoji}</span>
              <span className="text-lg">{tierMeta.name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Input & Configuration */}
          {step === 'input' && (
            <>
              {showPaymentPanel ? (
                <PaymentOrderPanel
                  type="agent"
                  amountMicro={paymentAmountMicro}
                  onCompleted={handleOrderCompleted}
                  onCancel={() => { setShowPaymentPanel(false); setPaymentAmountMicro(0); }}
                />
              ) : (
                <>
              {/* Tier Summary */}
              <div className={
                tierMeta.color === 'cyan' ? 'p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20' :
                  tierMeta.color === 'emerald' ? 'p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20' :
                    tierMeta.color === 'indigo' ? 'p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20' :
                      'p-3 rounded-lg bg-amber-500/10 border border-amber-500/20'
              }>
                <p className="text-xs text-muted-foreground mb-1">{tierMeta.description}</p>
                <div className="flex justify-between text-xs">
                  <span>Daily Range:</span>
                  <span className={
                    tierMeta.color === 'cyan' ? 'text-cyan-400 font-medium' :
                      tierMeta.color === 'emerald' ? 'text-emerald-400 font-medium' :
                        tierMeta.color === 'indigo' ? 'text-indigo-400 font-medium' :
                          'text-amber-400 font-medium'
                  }>{tierRow ? formatDailyRange(tierRow.daily_reward_min_bp, tierRow.daily_reward_max_bp) : '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Yield Cap:</span>
                  <span className={
                    tierMeta.color === 'cyan' ? 'text-cyan-400 font-medium' :
                      tierMeta.color === 'emerald' ? 'text-emerald-400 font-medium' :
                        tierMeta.color === 'indigo' ? 'text-indigo-400 font-medium' :
                          'text-amber-400 font-medium'
                  }>{tierRow ? `${(tierRow.reward_cap_bp / 100).toFixed(0)}%` : '—'}</span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm">Liquidity Amount (USDT)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder={tierRow ? `Min: $${microToUsdt(tierRow.min_amount)} • Max: $${microToUsdt(tierRow.max_amount).toLocaleString()}` : 'Enter liquidity'}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10"
                    min={tierRow ? microToUsdt(tierRow.min_amount) : undefined}
                    max={tierRow ? microToUsdt(tierRow.max_amount) : undefined}
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {tierRow ? `Liquidity Range: $${microToUsdt(tierRow.min_amount)} - $${microToUsdt(tierRow.max_amount).toLocaleString()} USDT` : 'Liquidity Range: —'}
                </p>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  {loadingBalance || usdtLoading ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 overflow-hidden flex-nowrap py-0.5 w-auto">
                      {/* USDT Balance - Always show with clear label */}
                      <Badge
                        variant="secondary"
                        className="inline-flex items-center whitespace-nowrap px-1 py-0.5 text-[11px] rounded-[5px] flex-1 min-w-0"
                      >
                        <Wallet className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="whitespace-nowrap">USDT Balance: {usdtBalanceDisplay}</span>
                      </Badge>

                      {/* Credit Balance - Only show if positive with clear label */}
                      {creditBalance !== null && creditBalance > 0 && (
                        <Badge
                          variant="default"
                          className="inline-flex items-center whitespace-nowrap px-1 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-700 rounded-[5px] flex-1 min-w-0"
                        >
                          <CreditCard className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="whitespace-nowrap">Credit Balance: ${(creditBalance / 1_000_000).toFixed(2)}</span>
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {/* <Label className="text-[12px] my-[2px]">Payment Method</Label> */}

                {/* Show payment options based on credit balance */}
                {(() => {
                  const requestedAmount = parseFloat(amount) || 0;
                  const creditBalanceUsdt = creditBalance !== null ? creditBalance / 1_000_000 : 0;
                  const hasSufficientCredit = creditBalance !== null && creditBalanceUsdt >= requestedAmount && requestedAmount > 0;

                  // If user has sufficient credit, show both options
                  if (hasSufficientCredit) {
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('usdt')}
                          className={`p-4 rounded-xl border-2 transition-all active:scale-95 ${paymentMethod === 'usdt'
                            ? 'border-primary bg-primary/10 hover:bg-primary/15'
                            : 'border-border hover:border-border/60 hover:bg-muted/20'
                            }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentMethod === 'usdt' ? 'bg-primary/20' : 'bg-muted/50'
                              }`}>
                              <Wallet className={`h-4 w-4 ${paymentMethod === 'usdt' ? 'text-primary' : 'text-foreground'
                                }`} />
                            </div>
                            <span className={`text-sm font-medium ${paymentMethod === 'usdt' ? 'text-primary' : 'text-foreground'
                              }`}>USDT Token Transfer</span>
                            <span className="text-xs text-center text-muted-foreground leading-tight">Pay with USDT tokens</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('credit')}
                          className={`p-4 rounded-xl border-2 transition-all active:scale-95 ${paymentMethod === 'credit'
                            ? 'border-primary bg-primary/10 hover:bg-primary/15'
                            : 'border-border hover:border-border/60 hover:bg-muted/20'
                            }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentMethod === 'credit' ? 'bg-primary/20' : 'bg-muted/50'
                              }`}>
                              <CreditCard className={`h-4 w-4 ${paymentMethod === 'credit' ? 'text-primary' : 'text-foreground'
                                }`} />
                            </div>
                            <span className={`text-sm font-medium ${paymentMethod === 'credit' ? 'text-primary' : 'text-foreground'
                              }`}>Credit Balance</span>
                            <span className="text-xs text-center text-muted-foreground leading-tight">
                              ${(creditBalance! / 1_000_000).toFixed(2)} available
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  }

                  // If insufficient credit or no amount entered, show only USDT option
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('usdt')}
                        className="p-1 rounded-xl border-2 border-primary bg-primary/10 transition-all hover:bg-primary/15 active:scale-95"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-primary">USDT Token Transfer</span>
                          <span className="text-xs text-muted-foreground">
                            Pay with USDT tokens
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled
                        className="p-1 rounded-xl border-2 border-border bg-muted/20 opacity-50"
                        title="Insufficient credit balance for activation"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">Credit Balance</span>
                          <span className="text-xs text-muted-foreground">
                            {creditBalance && creditBalance > 0
                              ? `$${(creditBalance / 1_000_000).toFixed(2)} available`
                              : 'Unavailable for activation'}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Activate Button */}
              <Button
                onClick={handleActivate}
                className="w-full"
              >
                Activate Agent
              </Button>
                </>
              )}
            </>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-sm">Processing your activation...</p>
              <p className="text-xs text-muted-foreground">Please wait while we confirm your transaction.</p>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h3 className="text-sm font-semibold">Agent Activated Successfully</h3>
                </div>
                <p className="text-xs text-muted-foreground">Your AI trading agent is now active and ready to generate returns.</p>
              </div>

              {/* Success Details */}
              {activationResult && (
                <div className="glass rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">${Number.parseFloat(amount || '0').toFixed(2)} USDT</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Method</p>
                      <p className="font-medium">{paymentMethod.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tier</p>
                      <p className="font-medium">{tierName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium text-green-500">Success</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {getTierSpecificSuccessMessage(tierName, Number.parseFloat(amount || '0').toFixed(2), tierRow)}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleStartOver} variant="secondary" className="flex-1 text-xs">
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Activate Another
                </Button>
                <Button onClick={() => onSuccess()} className="flex-1 text-xs">
                  Go to Portfolio
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <h3 className="text-sm font-semibold">Activation Failed</h3>
                </div>
                <p className="text-xs text-muted-foreground">Something went wrong during activation.</p>
              </div>
              <AgentErrorDisplay error={error} />
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="secondary" className="flex-1 text-xs">Try Again</Button>
                <Button onClick={handleStartOver} className="flex-1 text-xs">Start Over</Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>

    </Dialog>
  );
}

/**
 * Agent Hire Page
 * Purpose: Let users choose an AI agent tier and activate using USDT or credit balance.
 * Inputs: Wallet context provides `publicKey`.
 * Outputs: Activation modal and navigation to portfolio.
 * Notes: Mobile-first layout consistent with other /dapp pages.
 */
export default function DappHire() {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [tiersMap, setTiersMap] = useState<Record<string, AgentTierRow>>({});

  // Fetch agent tiers from backend
  useEffect(() => {
    (async () => {
      try {
        const map = await getAgentTiersMap();
        setTiersMap(map);
      } catch (error) {
        console.warn('Failed to load agent tiers from backend:', error);
      }
    })();
  }, [publicKey]);

  const handleActivationSuccess = () => {
    // Close modal and navigate to portfolio
    setSelectedTier(null);
    navigate('/dapp/my-agents');
  };

  return (
    <LicenseGuard>
      <WalletGate>
        <div className="w-full space-y-4">
          {/* Back Button */}
          <div className="flex items-center justify-start">
            <BackButton to="/dapp" />
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Deploy AI Trading Agent</h1>
              <p className="text-xs text-muted-foreground">Choose a tier and activate your agent with USDT or credit balance</p>
            </div>
          </div>

          {/* Tier Cards — native-mobile listing layout */}
          <div className="space-y-3">
            {TIERS.map((t) => {
              const row = tiersMap[t.key];
              return (
                <AgentHireCard
                  key={t.key}
                  name={t.name}
                  emoji={t.emoji}
                  image={t.image}
                  tagline={t.tagline}
                  riskLabel={t.riskLabel}
                  accent={t.accent}
                  dailyRange={row ? formatDailyRange(row.daily_reward_min_bp, row.daily_reward_max_bp) : null}
                  minUsd={row ? microToUsdt(row.min_amount) : null}
                  maxUsd={row ? microToUsdt(row.max_amount) : null}
                  onHire={() => setSelectedTier(t.key)}
                />
              );
            })}
          </div>

          {/* Quick Link to View Active Agents */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-foreground">Your Active Agents</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dapp/my-agents')}
              className="text-xs h-7 px-3 text-primary hover:text-primary/80"
            >
              <History className="h-3 w-3 mr-1" />
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Feature Cards - Mobile Optimized */}
          <div className="space-y-2">
            <div className="glass rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-xs text-foreground">Daily Returns</h4>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Earn daily ROI from your activated agents with tier-specific yield ranges
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-xs text-foreground">Risk Management</h4>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Choose from 4 tiers with different risk levels and yield caps for protection
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-xs text-foreground">Automated Trading</h4>
                  <p className="text-xs text-muted-foreground leading-tight">
                    AI agents work 24/7 to generate returns without manual intervention
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Hire Modal */}
          {selectedTier && publicKey && (
            <DirectHireModal
              isOpen={!!selectedTier}
              onClose={() => setSelectedTier(null)}
              tierName={selectedTier}
              userPublicKey={publicKey}
              tierRow={selectedTier ? tiersMap[selectedTier] : undefined}
              tiersMap={tiersMap}
              onSuccess={handleActivationSuccess}
            />
          )}
        </div>
      </WalletGate>
    </LicenseGuard>
  );
}