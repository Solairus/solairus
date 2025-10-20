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
import { AgentTier } from '@/lib/solairus-main';
import {
  activateAgent,
  validateActivationParams,
  getMinimumActivationAmount,
  type AgentActivationParams,
  type AgentActivationResult
} from '@/services/agent/agent-activation-service';
import { useAgentErrorHandler } from '@/utils/agent-error-handler';
import { AgentErrorDisplay } from '@/components/agent/AgentErrorDisplay';
import { AdminService } from '@/services/admin/admin-service';
import WalletGate from '@/components/WalletGate';
import LicenseGuard from '@/components/license/LicenseGuard';
import { Connection, PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import * as anchor from '@coral-xyz/anchor';
import { getHealthyRpcConnection } from "@/utils/rpc-switcher";
import BackButton from '@/components/ui/BackButton';

// Tier configurations mapping
const TIER_CONFIG = {
  NOVA: {
    tier: AgentTier.NOVA,
    name: 'NOVA Agent',
    emoji: '🪶',
    description: 'Pattern Seeker • Low Risk',
    dailyRange: '1.00% - 1.75%',
    yieldCap: '175%',
    minInvestment: 10,
    maxInvestment: 1000,
    color: 'cyan'
  },
  VEGA: {
    tier: AgentTier.VEGA,
    name: 'VEGA Agent',
    emoji: '🔮',
    description: 'Momentum Scout • Medium Risk',
    dailyRange: '1.75% - 2.15%',
    yieldCap: '200%',
    minInvestment: 50,
    maxInvestment: 5000,
    color: 'emerald'
  },
  ORION: {
    tier: AgentTier.ORION,
    name: 'ORION Agent',
    emoji: '⚡',
    description: 'Risk Balancer • High Risk',
    dailyRange: '2.15% - 3.00%',
    yieldCap: '220%',
    minInvestment: 100,
    maxInvestment: 10000,
    color: 'indigo'
  },
  PRIME: {
    tier: AgentTier.PRIME,
    name: 'PRIME Agent',
    emoji: '🧠',
    description: 'Alpha Hunter • Max Risk',
    dailyRange: '3.00% - 5.00%',
    yieldCap: '250%',
    minInvestment: 500,
    maxInvestment: 50000,
    color: 'amber'
  }
};

type ActivationStep = 'input' | 'processing' | 'success' | 'error';

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
 * Get tier-specific success message
 */
function getTierSpecificSuccessMessage(tierName: string, amount: string): string {
  const tierConfig = TIER_CONFIG[tierName as keyof typeof TIER_CONFIG];
  if (!tierConfig) {
    return 'Your AI trading agent is now active and ready to generate returns.';
  }

  const dailyRange = tierConfig.dailyRange;

  switch (tierName) {
    case 'NOVA':
      return `Your ${tierConfig.name} is now active with $${amount} investment. Expect steady daily returns between ${dailyRange} with minimal risk.`;
    case 'VEGA':
      return `Your ${tierConfig.name} is now active with $${amount} investment. Enjoy balanced daily returns between ${dailyRange} with moderate risk.`;
    case 'ORION':
      return `Your ${tierConfig.name} is now active with $${amount} investment. Prepare for aggressive daily returns between ${dailyRange} with higher volatility.`;
    case 'PRIME':
      return `Your ${tierConfig.name} is now active with $${amount} investment. Experience elite daily returns between ${dailyRange} with maximum potential.`;
    default:
      return `Your ${tierConfig.name} is now active with $${amount} investment and ready to generate returns.`;
  }
}

// Enhanced Direct Hire Modal Component with Full Implementation
function DirectHireModal({
  isOpen,
  onClose,
  tierName,
  userPublicKey,
  anchorProvider,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  userPublicKey: PublicKey;
  anchorProvider: anchor.AnchorProvider;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<ActivationStep>('input');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'usdt' | 'credit'>('usdt');
  const [activationResult, setActivationResult] = useState<AgentActivationResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>('0.00');
  const [loadingBalance, setLoadingBalance] = useState(false);

  const { showError, showSuccess } = useAgentErrorHandler();

  const tierConfig = TIER_CONFIG[tierName as keyof typeof TIER_CONFIG];

  // Fetch user balances
  const fetchBalances = React.useCallback(async () => {
    if (!userPublicKey || !anchorProvider) return;

    setLoadingBalance(true);
    try {
      // Fetch credit balance
      const adminService = new AdminService(anchorProvider);
      const userProfile = await adminService.getUserProfile(userPublicKey);
      setCreditBalance(userProfile?.creditBalance || 0);

      // Fetch USDT balance
      const usdtMint = new PublicKey(import.meta.env.VITE_USDT_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      const balance = await getUsdtBalance(userPublicKey, usdtMint);
      setUsdtBalance(balance);
    } catch (error) {
      console.error('Error fetching balances:', error);
      setCreditBalance(0);
      setUsdtBalance('0.00');
    } finally {
      setLoadingBalance(false);
    }
  }, [userPublicKey, anchorProvider]);

  // Fetch balances when modal opens
  React.useEffect(() => {
    if (isOpen && userPublicKey && anchorProvider) {
      fetchBalances();
    }
  }, [isOpen, userPublicKey, anchorProvider, fetchBalances]);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setStep('input');
    setAmount('');
    setPaymentMethod('usdt');
    setActivationResult(null);
    setError(null);
    setCreditBalance(null);
    setUsdtBalance('0.00');
    onClose();
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

    if (!tierConfig) {
      showError('Invalid tier configuration', 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }

    // Validate investment amount against tier limits
    if (investmentAmount < tierConfig.minInvestment) {
      showError(`Minimum investment for ${tierConfig.name} is $${tierConfig.minInvestment} USDT`, 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }

    if (investmentAmount > tierConfig.maxInvestment) {
      showError(`Maximum investment for ${tierConfig.name} is $${tierConfig.maxInvestment.toLocaleString()} USDT`, 'Agent activation', undefined, {
        showRetry: false,
        duration: 4000
      });
      return;
    }

    setStep('processing');
    setError(null);

    try {
      // Validate activation parameters
      const activationParams: AgentActivationParams = {
        userPublicKey,
        amount: parseFloat(amount),
        tier: tierConfig.tier,
        paymentMethod
      };

      // Validate parameters before proceeding
      const validation = await validateActivationParams(activationParams);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', ') || 'Invalid activation parameters');
      }

      // Execute activation directly with AnchorProvider
      console.log('🚀 Starting agent activation with proper provider...');
      const result = await activateAgent(anchorProvider, activationParams);

      console.log('🔍 Activation result:', result);

      if (result.success) {
        console.log('✅ Activation successful, showing success UI');
        setActivationResult(result);
        setStep('success');

        // Show success toast
        showSuccess('Agent activated successfully!', {
          description: getTierSpecificSuccessMessage(tierName, amount),
          duration: 6000
        });

        // Notify parent component
        onSuccess();
      } else {
        console.log('❌ Activation failed, throwing error');
        throw new Error(result.error || result.userFriendlyMessage || 'Agent activation failed');
      }

    } catch (error) {
      console.error('❌ Agent activation failed:', error);
      setError(error);
      setStep('error');

      // Show error toast
      showError(error, 'Agent activation', undefined, {
        showRetry: false,
        duration: 6000
      });
    }
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
  };

  if (!tierConfig) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">{tierConfig.emoji}</span>
              <span className="text-lg">{tierConfig.name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Input & Configuration */}
          {step === 'input' && (
            <>
              {/* Tier Summary */}
              <div className={
                tierConfig.color === 'cyan' ? 'p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20' :
                  tierConfig.color === 'emerald' ? 'p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20' :
                    tierConfig.color === 'indigo' ? 'p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20' :
                      'p-3 rounded-lg bg-amber-500/10 border border-amber-500/20'
              }>
                <p className="text-xs text-muted-foreground mb-1">{tierConfig.description}</p>
                <div className="flex justify-between text-xs">
                  <span>Daily Range:</span>
                  <span className={
                    tierConfig.color === 'cyan' ? 'text-cyan-400 font-medium' :
                      tierConfig.color === 'emerald' ? 'text-emerald-400 font-medium' :
                        tierConfig.color === 'indigo' ? 'text-indigo-400 font-medium' :
                          'text-amber-400 font-medium'
                  }>{tierConfig.dailyRange}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Yield Cap:</span>
                  <span className={
                    tierConfig.color === 'cyan' ? 'text-cyan-400 font-medium' :
                      tierConfig.color === 'emerald' ? 'text-emerald-400 font-medium' :
                        tierConfig.color === 'indigo' ? 'text-indigo-400 font-medium' :
                          'text-amber-400 font-medium'
                  }>{tierConfig.yieldCap}</span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm">Investment Amount (USDT)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder={`Min: $${tierConfig.minInvestment} • Max: $${tierConfig.maxInvestment.toLocaleString()}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10"
                    min={tierConfig.minInvestment}
                    max={tierConfig.maxInvestment}
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Investment range: ${tierConfig.minInvestment} - ${tierConfig.maxInvestment.toLocaleString()} USDT
                </p>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Payment Method</Label>
                  {loadingBalance ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* USDT Balance - Always show with clear label */}
                      <Badge variant="secondary" className="text-xs px-2 py-1">
                        <Wallet className="h-3 w-3 mr-1" />
                        USDT: ${usdtBalance}
                      </Badge>

                      {/* Credit Balance - Only show if positive with clear label */}
                      {creditBalance !== null && creditBalance > 0 && (
                        <Badge variant="default" className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Credit: ${(creditBalance / 1_000_000).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

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
                            {requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount
                              ? `Insufficient credit balance (need $${requestedAmount.toFixed(2)})`
                              : 'Pay with USDT tokens'
                            }
                          </span>
                        </div>
                      </button>

                      {/* Always show credit option, disabled if insufficient funds */}
                      <button
                        type="button"
                        onClick={() => requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt >= requestedAmount ? setPaymentMethod('credit') : undefined}
                        disabled={requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount}
                        className={`p-1 rounded-xl border-2 transition-all active:scale-95 ${requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount
                          ? 'border-border/30 bg-muted/30 opacity-60 cursor-not-allowed'
                          : 'border-border hover:border-border/60 hover:bg-muted/20'
                          }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount
                            ? 'bg-muted'
                            : 'bg-muted/50'
                            }`}>
                            <CreditCard className={`h-4 w-4 ${requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount
                              ? 'text-muted-foreground'
                              : 'text-foreground'
                              }`} />
                          </div>
                          <span className={`text-sm font-medium ${requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                            }`}>Credit Balance</span>
                          <span className="text-xs text-center text-muted-foreground leading-tight">
                            {requestedAmount > 0 && creditBalance !== null && creditBalanceUsdt < requestedAmount
                              ? `Insufficient funds ($${(creditBalance / 1_000_000).toFixed(2)} available)`
                              : `$${creditBalance !== null ? (creditBalance / 1_000_000).toFixed(2) : '0.00'} available`
                            }
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Order Summary */}
              {amount && parseFloat(amount) > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="text-sm font-medium">Order Summary</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Agent Tier:</span>
                      <span>{tierConfig.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Investment:</span>
                      <span>${parseFloat(amount).toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <Badge variant="outline" className="text-xs">
                        {paymentMethod === 'usdt' ? 'USDT Transfer' : 'Credit Balance'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Daily:</span>
                      <span>{tierConfig.dailyRange}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Max Total Return:</span>
                      <span>${(parseFloat(amount) * parseFloat(tierConfig.yieldCap.replace('%', '')) / 100).toFixed(2)} USDT</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleActivate}
                  className="flex-1"
                  disabled={(() => {
                    const investmentAmount = parseFloat(amount);
                    return !amount ||
                      investmentAmount <= 0 ||
                      investmentAmount < tierConfig.minInvestment ||
                      investmentAmount > tierConfig.maxInvestment;
                  })()}
                >
                  Activate Agent
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <div className="text-center space-y-4 py-6">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Activating Agent...</h3>
                <p className="text-sm text-muted-foreground">
                  Processing your {tierConfig.name} activation with ${amount} USDT investment.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Please confirm the transaction in your wallet and wait for blockchain confirmation.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && activationResult && (
            <div className="text-center space-y-4 py-6">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Agent Activated Successfully!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {getTierSpecificSuccessMessage(tierName, amount)}
                </p>
                {activationResult.txSignature && (
                  <div className="p-2 bg-muted/50 rounded text-xs">
                    <span className="text-muted-foreground">Transaction: </span>
                    <span className="font-mono">{activationResult.txSignature.slice(0, 8)}...{activationResult.txSignature.slice(-8)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleStartOver}
                  className="flex-1"
                >
                  Hire Another
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Error */}
          {step === 'error' && error && (
            <div className="space-y-4">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Activation Failed</h3>
              </div>

              <AgentErrorDisplay
                error={error}
                context="Agent activation"
                onRetry={handleRetry}
                compact={false}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRetry}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DappHire() {
  const { publicKey, provider, anchorProvider } = useWallet();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [userCreditBalance, setUserCreditBalance] = useState<number | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>('0.00');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const navigate = useNavigate();

  // Fetch user balances on component mount
  const fetchUserBalances = React.useCallback(async () => {
    if (!publicKey || !anchorProvider) return;

    setLoadingBalance(true);
    try {
      // Fetch credit balance
      const adminService = new AdminService(anchorProvider);
      const userProfile = await adminService.getUserProfile(publicKey);
      setUserCreditBalance(userProfile?.creditBalance || 0);

      // Fetch USDT balance
      const usdtMint = new PublicKey(import.meta.env.VITE_USDT_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      const balance = await getUsdtBalance(publicKey, usdtMint);
      setUsdtBalance(balance);
    } catch (error) {
      console.error('Error fetching user balances:', error);
      setUserCreditBalance(0);
      setUsdtBalance('0.00');
    } finally {
      setLoadingBalance(false);
    }
  }, [publicKey, anchorProvider]);

  useEffect(() => {
    if (publicKey && anchorProvider) {
      fetchUserBalances();
    }
  }, [publicKey, anchorProvider, fetchUserBalances]);

  const handleActivationSuccess = () => {
    setSelectedTier(null);
    // Refresh balances after successful activation
    fetchUserBalances();
  };

  return (
    <LicenseGuard>
      <WalletGate>
        <div className="space-y-4">
          {/* Back Button */}
          <div className="flex items-center justify-start">
            <BackButton to="/dapp" />
          </div>

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Hire AI Trading Agents</h1>
              <p className="text-sm text-muted-foreground">
                Activate intelligent AI agents to trade on your behalf. Choose from different tiers
                based on your risk tolerance and yield expectations.
              </p>
            </div>

            {/* Balance Display */}
            {publicKey && (
              <div className="flex justify-center">
                {loadingBalance ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full border">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading balances...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* USDT Balance - Always show with clear label */}
                    <Badge variant="secondary" className="text-xs px-2 py-1">
                      <Wallet className="h-3 w-3 mr-1" />
                      USDT: ${usdtBalance}
                    </Badge>

                    {/* Credit Balance - Only show if positive with clear label */}
                    {userCreditBalance !== null && userCreditBalance > 0 && (
                      <Badge variant="default" className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Credit: ${(userCreditBalance / 1_000_000).toFixed(2)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agent Tier Cards - Profile Style */}
          <div className="space-y-3">
            {/* NOVA Tier */}
            <div className="relative bg-gradient-to-r from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 min-h-[6rem] h-auto"
              style={{ borderRadius: '48px 8px 8px 48px' }}>
              <div className="flex items-center h-full px-3 py-3">
                {/* Profile Image - Left Circle */}
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-cyan-400/30 flex-shrink-0">
                  <img
                    src="/media/agents/nova.jpeg"
                    alt="NOVA Agent"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content - Centered */}
                <div className="flex-1 ml-4 flex flex-col justify-center items-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <h3 className="text-sm font-bold text-cyan-400">NOVA Agent</h3>
                    <span className="text-sm">🪶</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 text-center">Pattern Seeker • Low Risk</p>
                  <div className="text-center mb-1">
                    <p className="text-xs text-cyan-300 font-medium">1.00% - 1.75% daily</p>
                    <p className="text-xs text-muted-foreground">Min: $10 • Max: $1,000</p>
                  </div>

                  {/* Hire Button - Below Description */}
                  <Button
                    size="sm"
                    className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs px-4 py-1 h-6 rounded-full font-medium shadow-sm"
                    onClick={() => setSelectedTier('NOVA')}
                  >
                    Hire Now
                  </Button>
                </div>
              </div>
            </div>

            {/* VEGA Tier */}
            <div className="relative bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 min-h-[6rem] h-auto"
              style={{ borderRadius: '48px 8px 8px 48px' }}>
              <div className="flex items-center h-full px-3 py-3">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-emerald-400/30 flex-shrink-0">
                  <img
                    src="/media/agents/vega.jpeg"
                    alt="VEGA Agent"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 ml-4 flex flex-col justify-center items-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <h3 className="text-sm font-bold text-emerald-400">VEGA Agent</h3>
                    <span className="text-sm">🔮</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 text-center">Momentum Scout • Medium Risk</p>
                  <div className="text-center mb-1">
                    <p className="text-xs text-emerald-300 font-medium">1.75% - 2.15% daily</p>
                    <p className="text-xs text-muted-foreground">Min: $50 • Max: $5,000</p>
                  </div>

                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-4 py-1 h-6 rounded-full font-medium shadow-sm"
                    onClick={() => setSelectedTier('VEGA')}
                  >
                    Hire Now
                  </Button>
                </div>
              </div>
            </div>

            {/* ORION Tier */}
            <div className="relative bg-gradient-to-r from-indigo-500/10 to-indigo-600/5 border border-indigo-500/20 min-h-[6rem] h-auto"
              style={{ borderRadius: '48px 8px 8px 48px' }}>
              <div className="flex items-center h-full px-3 py-3">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-indigo-400/30 flex-shrink-0">
                  <img
                    src="/media/agents/orion.jpeg"
                    alt="ORION Agent"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 ml-4 flex flex-col justify-center items-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <h3 className="text-sm font-bold text-indigo-400">ORION Agent</h3>
                    <span className="text-sm">⚡</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 text-center">Risk Balancer • High Risk</p>
                  <div className="text-center mb-1">
                    <p className="text-xs text-indigo-300 font-medium">2.15% - 3.00% daily</p>
                    <p className="text-xs text-muted-foreground">Min: $100 • Max: $10,000</p>
                  </div>

                  <Button
                    size="sm"
                    className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-4 py-1 h-6 rounded-full font-medium shadow-sm"
                    onClick={() => setSelectedTier('ORION')}
                  >
                    Hire Now
                  </Button>
                </div>
              </div>
            </div>

            {/* PRIME Tier */}
            <div className="relative bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 min-h-[6rem] h-auto"
              style={{ borderRadius: '48px 8px 8px 48px' }}>
              <div className="flex items-center h-full px-3 py-3">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-amber-400/30 flex-shrink-0">
                  <img
                    src="/media/agents/prime.jpeg"
                    alt="PRIME Agent"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 ml-4 flex flex-col justify-center items-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <h3 className="text-sm font-bold text-amber-400">PRIME Agent</h3>
                    <span className="text-sm">🧠</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 text-center">Alpha Hunter • Max Risk</p>
                  <div className="text-center mb-1">
                    <p className="text-xs text-amber-300 font-medium">3.00% - 5.00% daily</p>
                    <p className="text-xs text-muted-foreground">Min: $500 • Max: $50,000</p>
                  </div>

                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-4 py-1 h-6 rounded-full font-medium shadow-sm"
                    onClick={() => setSelectedTier('PRIME')}
                  >
                    Hire Now
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Link to View Active Agents */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-foreground">Your Active Agents</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dapp/history')}
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
          {selectedTier && publicKey && anchorProvider && (
            <DirectHireModal
              isOpen={!!selectedTier}
              onClose={() => setSelectedTier(null)}
              tierName={selectedTier}
              userPublicKey={publicKey}
              anchorProvider={anchorProvider}
              onSuccess={handleActivationSuccess}
            />
          )}
        </div>
      </WalletGate>
    </LicenseGuard>
  );
}