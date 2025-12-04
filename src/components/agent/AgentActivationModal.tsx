import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { EXTENDED_AGENT_TIER_METADATA } from '@/config/agent-config';
import { TierSelection } from './TierSelection';
import {
  activateAgent,
  validateActivationParams,
  getMinimumActivationAmount,
  type AgentActivationParams,
  type AgentActivationResult
} from '@/services/agent/agent-activation-service';
import { useAgentErrorHandler } from '@/utils/agent-error-handler';
import { AgentErrorDisplay } from './AgentErrorDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  ArrowRight,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/contexts/wallet-context';

import { AuthService } from '@/services/auth/auth-service';
import { useBalance } from '@/hooks/useBalance';

interface AgentActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPublicKey: PublicKey;
  connection: Connection;
  onSuccess?: (result: AgentActivationResult) => void;
}

type ActivationStep = 'tier-selection' | 'amount-input' | 'confirmation' | 'processing' | 'success';

/**
 * Get tier-specific success message
 */
function getTierSpecificSuccessMessage(tier?: string, amount?: string): string {
  if (tier === undefined || !amount) {
    return 'Your AI trading agent is now active and ready to generate returns.';
  }

  const tierConfig = EXTENDED_AGENT_TIER_METADATA[tier.toUpperCase()];
  const tierName = tierConfig?.name || tier;
  const dailyRange = tierConfig?.dailyRange || '1-5%';

  switch (tier.toUpperCase()) {
    case 'NOVA':
      return `Your ${tierName} agent is now active with $${amount} liquidity. Expect steady daily returns between ${dailyRange} with minimal risk.`;
    case 'VEGA':
      return `Your ${tierName} agent is now active with $${amount} liquidity. Enjoy balanced daily returns between ${dailyRange} with moderate risk.`;
    case 'ORION':
      return `Your ${tierName} agent is now active with $${amount} liquidity. Prepare for aggressive daily returns between ${dailyRange} with higher volatility.`;
    case 'PRIME':
      return `Your ${tierName} agent is now active with $${amount} liquidity. Experience elite daily returns between ${dailyRange} with maximum potential.`;
    default:
      return `Your ${tierName} agent is now active with $${amount} liquidity and ready to generate returns.`;
  }
}

export const AgentActivationModal: React.FC<AgentActivationModalProps> = ({
  isOpen,
  onClose,
  userPublicKey,
  connection,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<ActivationStep>('tier-selection');
  const [selectedTier, setSelectedTier] = useState<string>();
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'usdt' | 'credit'>('usdt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activationResult, setActivationResult] = useState<AgentActivationResult>();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activationError, setActivationError] = useState<unknown>(null);
  const { showError, showSuccess, formatErrorForUI } = useAgentErrorHandler();

  const { anchorProvider } = useWallet();
  const [creditBalanceMicro, setCreditBalanceMicro] = useState<number | null>(null);
  const [creditLoading, setCreditLoading] = useState<boolean>(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const { balanceDisplay: usdtBalanceDisplay, isLoading: usdtLoading, refresh: refreshUsdt, balanceMicro: usdtBalanceMicro } = useBalance();
  const tierCfg = selectedTier ? EXTENDED_AGENT_TIER_METADATA[selectedTier.toUpperCase()] : undefined;

  const formatUsd = (micro?: number) => {
    const n = Number(micro ?? 0);
    const usd = Math.floor(n) / 1_000_000;
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd);
  };

  const fetchCreditBalance = useCallback(async () => {
    if (!userPublicKey) {
      setCreditBalanceMicro(0);
      setCreditError(null);
      return;
    }
    setCreditLoading(true);
    setCreditError(null);
    try {
      const sessionUser = await AuthService.getSession();
      const raw = sessionUser?.credit_balance_micro ?? '0';
      const bal = Number(raw);
      setCreditBalanceMicro(Number.isFinite(bal) ? bal : 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch credit balance';
      setCreditError(msg);
      setCreditBalanceMicro(null);
    } finally {
      setCreditLoading(false);
    }
  }, [userPublicKey]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('tier-selection');
      setSelectedTier(undefined);
      setAmount('');
      setPaymentMethod('usdt');
      setIsProcessing(false);
      setActivationResult(undefined);
      setValidationErrors([]);
      setActivationError(null);
      fetchCreditBalance();
    }
  }, [isOpen, fetchCreditBalance]);

  useEffect(() => {
    if (isOpen && paymentMethod === 'credit') {
      fetchCreditBalance();
    }
  }, [isOpen, paymentMethod, fetchCreditBalance]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      fetchCreditBalance();
      refreshUsdt();
    }, 30000);
    return () => clearInterval(id);
  }, [isOpen, fetchCreditBalance, refreshUsdt]);

  // Validate amount when it changes
  useEffect(() => {
    if (selectedTier !== undefined && amount) {
      const params: AgentActivationParams = {
        userPublicKey,
        amount: parseFloat(amount) || 0,
        tier: selectedTier,
        paymentMethod
      };

      const validation = validateActivationParams(params);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]);
    }
  }, [selectedTier, amount, paymentMethod, userPublicKey]);

  const handleTierSelect = (tier: string) => {
    setSelectedTier(tier);
  };

  const handleContinueToAmount = () => {
    if (selectedTier !== undefined) {
      setCurrentStep('amount-input');
      // Set default amount to minimum for selected tier
      const minAmount = getMinimumActivationAmount(selectedTier);
      setAmount(minAmount.toString());
    }
  };

  const handleContinueToConfirmation = () => {
    if (validationErrors.length === 0 && selectedTier !== undefined && amount) {
      setCurrentStep('confirmation');
    }
  };

  const handleConfirmActivation = async () => {
    if (selectedTier === undefined || !amount) return;

    setCurrentStep('processing');
    setIsProcessing(true);
    setActivationError(null);

    try {
      const params: AgentActivationParams = {
        userPublicKey,
        amount: parseFloat(amount),
        tier: selectedTier,
        paymentMethod
      };

      const amountMicro = Math.floor((parseFloat(amount) || 0) * 1_000_000);
      if (paymentMethod === 'credit') {
        const available = Number(creditBalanceMicro ?? 0);
        if (!Number.isFinite(available) || available < amountMicro) {
          setCurrentStep('confirmation');
          setIsProcessing(false);
          showError('Insufficient credit balance', 'Agent activation', undefined, { showRetry: false, duration: 4000 });
          return;
        }
      } else if (paymentMethod === 'usdt') {
        if (usdtLoading) {
          showError('Fetching USDT balance, please wait...', 'Agent activation', undefined, { showRetry: false, duration: 3000 });
          setCurrentStep('confirmation');
          setIsProcessing(false);
          return;
        }
        const available = Number(usdtBalanceMicro ?? 0);
        if (!Number.isFinite(available) || amountMicro > available) {
          const availUsd = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(available / 1_000_000);
          showError(`Insufficient USDT balance. Available: $${availUsd}`, 'Agent activation', undefined, { showRetry: false, duration: 4000 });
          setCurrentStep('confirmation');
          setIsProcessing(false);
          return;
        }
      }

      const result = await activateAgent(connection, params);

      if (result.success && result.data) {
        setActivationResult(result.data);
        setCurrentStep('success');

        // Show success toast
        const tierName = EXTENDED_AGENT_TIER_METADATA[selectedTier]?.name || String(selectedTier);
        showSuccess('Agent activated successfully!', {
          description: `${tierName} agent activated with ${amount} USDT`
        });

        onSuccess?.(result.data);
        await fetchCreditBalance();
      } else {
        // Handle activation failure
        const error = result.error || new Error('Activation failed');
        setActivationError(error);

        setActivationResult({
          success: false,
          error: error.message,
          userFriendlyMessage: error.message
        });

        setCurrentStep('confirmation');

        // Show error toast
        showError(error, 'Agent activation', undefined, {
          showRetry: true,
          onRetry: handleConfirmActivation
        });
      }
    } catch (error) {
      console.error('Activation error:', error);

      setActivationError(error);
      setActivationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Activation failed',
        userFriendlyMessage: error instanceof Error ? error.message : 'Activation failed'
      });

      setCurrentStep('confirmation');

      // Show error toast
      showError(error, 'Agent activation', undefined, {
        showRetry: true,
        onRetry: handleConfirmActivation
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'amount-input':
        setCurrentStep('tier-selection');
        break;
      case 'confirmation':
        setCurrentStep('amount-input');
        break;
      default:
        break;
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'tier-selection':
        return (
          <div className="space-y-6">
            <TierSelection
              selectedTier={selectedTier}
              onTierSelect={handleTierSelect}
              disabled={isProcessing}
            />

            <div className="flex justify-end">
              <Button
                onClick={handleContinueToAmount}
                disabled={selectedTier === undefined}
                className="min-w-32"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'amount-input':
        return (
          <div className="space-y-6">
            {/* Selected Tier Summary */}
            {selectedTier !== undefined && (
              <div className="glass rounded-xl p-4 border border-primary/30">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{tierCfg?.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-primary">
                      {tierCfg?.name} Agent
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Daily yield: {tierCfg?.dailyRange} •
                      Cap: {tierCfg?.yieldCapPct}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {creditLoading || usdtLoading ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 overflow-hidden flex-nowrap py-0.5 w-full">
                    <Badge
                      variant="secondary"
                      className="inline-flex items-center whitespace-nowrap px-1 py-0.5 text-[11px] rounded-full flex-1 min-w-0"
                    >
                      <DollarSign className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="whitespace-nowrap">{usdtBalanceDisplay}</span>
                    </Badge>
                    {creditBalanceMicro !== null && creditBalanceMicro > 0 && (
                      <Badge
                        variant="default"
                        className="inline-flex items-center whitespace-nowrap px-1 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-700 rounded-full flex-1 min-w-0"
                      >
                        <CreditCard className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="whitespace-nowrap">${formatUsd(creditBalanceMicro)}</span>
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {/* <Label className="text-[12px] my-[2px]">Payment Method</Label> */}
              <Select value={paymentMethod} onValueChange={(value: 'usdt' | 'credit') => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usdt">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      USDT Payment
                    </div>
                  </SelectItem>
                  {creditBalanceMicro !== null && creditBalanceMicro > 0 && (
                    <SelectItem value="credit">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Credit Balance
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
              <Label htmlFor="amount">
                Activation Amount ({paymentMethod === 'usdt' ? 'USDT' : 'Credits'})
              </Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Minimum: $${getMinimumActivationAmount(selectedTier || 'NOVA')}`}
                  className="pr-16"
                  min={getMinimumActivationAmount(selectedTier || 'NOVA')}
                  step="0.01"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {paymentMethod === 'usdt' ? 'USDT' : 'Credits'}
                </div>
              </div>
              {selectedTier !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Minimum amount: ${getMinimumActivationAmount(selectedTier)}
                </p>
              )}
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="space-y-2">
                {validationErrors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleContinueToConfirmation}
                disabled={validationErrors.length > 0 || !amount}
                className="min-w-32"
              >
                Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="space-y-6">
            {/* Activation Summary */}
            <div className="glass rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-center">Confirm Agent Activation</h3>

              {selectedTier !== undefined && (
                <div className="space-y-4">
                  {/* Agent Details with Enhanced Styling */}
                  <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-2xl">{tierCfg?.emoji}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{tierCfg?.name} Agent</p>
                          <p className="text-sm text-muted-foreground">
                            {tierCfg?.description}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-primary border-primary/50">
                        {selectedTier}
                      </Badge>
                    </div>
                  </div>

                  {/* Liquidity & Payment Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-background/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Liquidity Amount</p>
                      <p className="font-semibold text-lg">${amount}</p>
                      <p className="text-xs text-muted-foreground capitalize">via {paymentMethod}</p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                      <p className="font-semibold text-lg capitalize">{paymentMethod}</p>
                      <p className="text-xs text-muted-foreground">
                        {paymentMethod === 'usdt' ? 'USDT Token' : 'Credit Balance'}
                      </p>
                    </div>
                  </div>

                  {/* Yield Expectations */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <h4 className="font-semibold text-green-400 mb-3">Expected Returns</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Daily Yield Range</p>
                        <p className="font-semibold text-green-400">
                          {tierCfg?.dailyRange}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Maximum Total Yield</p>
                        <p className="font-semibold text-green-400">
                          {tierCfg?.yieldCapPct}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Estimated Max Return</p>
                        <p className="font-semibold text-green-400">
                          ${((parseFloat(amount) || 0) * ((tierCfg?.yieldCapPct ?? 0)) / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">First Withdrawal</p>
                        <p className="font-semibold text-green-400">
                          24 hours after activation
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Important Notes */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <h4 className="font-semibold text-amber-400 mb-2 text-sm">Important Notes</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Agent activation is permanent and cannot be reversed</li>
                      <li>• Daily yields are randomly generated within the tier range</li>
                      <li>• Agent will retire automatically when yield cap is reached</li>
                      <li>• 24-hour cooldown applies between ROI withdrawals</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Error Display */}
            {activationError && (
              <AgentErrorDisplay
                error={activationError}
                context="Agent activation"
                onRetry={handleConfirmActivation}
                showRetryButton={true}
                className="mb-4"
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button onClick={handleBack} variant="outline" disabled={isProcessing}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleConfirmActivation}
                disabled={isProcessing}
                className="min-w-32"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    Confirm Activation
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center space-y-6 py-8">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Activating Your Agent</h3>
              <p className="text-muted-foreground">
                Please wait while we process your transaction...
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6 py-8">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>

            {/* Success Message with Tier Information */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Agent Activated Successfully!</h3>

              {selectedTier !== undefined && (
                <div className="glass rounded-xl p-4 mb-4 bg-gradient-to-r from-green-500/10 to-green-600/5 border border-green-500/30">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <span className="text-3xl">{tierCfg?.emoji}</span>
                    <div>
                      <h4 className="font-semibold text-green-400">
                        {tierCfg?.name} Agent Activated
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {tierCfg?.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">Liquidity Amount</p>
                      <p className="font-semibold text-green-400">${amount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Expected Daily Yield</p>
                      <p className="font-semibold text-green-400">
                        {tierCfg?.dailyRange}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activationResult && (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    {getTierSpecificSuccessMessage(selectedTier, amount)}
                  </p>
                  {activationResult.txSignature && (
                    <p className="text-xs text-muted-foreground">
                      Transaction: {activationResult.txSignature.slice(0, 8)}...
                    </p>
                  )}
                  {activationResult.activationId !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Agent ID: #{activationResult.activationId}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Next Steps Information */}
            <div className="glass rounded-xl p-4 text-left">
              <h4 className="font-semibold mb-2 text-center">What's Next?</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  Your agent will start generating returns after 24 hours
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  Daily ROI withdrawals will be available every 24 hours
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  Monitor your agent's performance in the dashboard
                </li>
                {selectedTier !== undefined && (
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    Maximum total yield: {tierCfg?.yieldCapPct}% of investment
                  </li>
                )}
              </ul>
            </div>

            <Button onClick={handleClose} className="min-w-32">
              View Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'tier-selection':
        return 'Choose Agent Tier';
      case 'amount-input':
        return 'Set Activation Amount';
      case 'confirmation':
        return 'Confirm Activation';
      case 'processing':
        return 'Processing...';
      case 'success':
        return 'Success!';
      default:
        return 'Activate Agent';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'tier-selection':
        return 'Select an AI trading agent tier based on your risk tolerance and yield expectations.';
      case 'amount-input':
        return 'Enter the amount you want to invest in this agent activation.';
      case 'confirmation':
        return 'Review your agent activation details before confirming the transaction.';
      case 'processing':
        return paymentMethod === 'credit' ? 'Processing your activation using credit balance...' : 'Your agent is being activated on the blockchain.';
      case 'success':
        return 'Your AI trading agent is now active and ready to generate returns.';
      default:
        return 'Activate a new AI trading agent.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center space-x-2 py-4">
          {['tier-selection', 'amount-input', 'confirmation'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                currentStep === step
                  ? "bg-primary text-primary-foreground"
                  : ['tier-selection', 'amount-input', 'confirmation'].indexOf(currentStep) > index
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>
              {index < 2 && (
                <div className={cn(
                  "w-8 h-0.5 mx-2",
                  ['tier-selection', 'amount-input', 'confirmation'].indexOf(currentStep) > index
                    ? "bg-primary"
                    : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
};