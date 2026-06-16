import React, { useState, useEffect } from "react";
import { useWallet } from '@/contexts/wallet-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import WalletGate from '@/components/WalletGate';
import LicenseGuard from '@/components/license/LicenseGuard';
import { PublicKey } from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';
import * as anchor from '@coral-xyz/anchor';
import BackButton from '@/components/ui/BackButton';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { SolairusPayService } from '@/services/wallet/solairus-pay';
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
  anchorProvider,
  onSuccess,
  tierRow,
  tiersMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  userPublicKey: PublicKey;
  anchorProvider: anchor.AnchorProvider;
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
  const [txSig, setTxSig] = useState<string>('');
  const [confirmationCountdown, setConfirmationCountdown] = useState<number | null>(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<Record<string, unknown> | null>(null);

  // USDT on-chain balance via reusable hook (same as license activation page)
  const { balanceDisplay: usdtBalanceDisplay, isLoading: usdtLoading, error: usdtError, refresh: refreshUsdt, balanceMicro: usdtBalanceMicro } = useBalance();
  const { user: authUser } = useAuth();

  const { showError, showSuccess } = useAgentErrorHandler();
  const tierMeta = TIER_META[tierName];

  // Fetch user balances
  const fetchBalances = React.useCallback(async () => {
    if (!userPublicKey || !anchorProvider) {
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
    if (isOpen && userPublicKey && anchorProvider) {
      fetchBalances();
    }
  }, [isOpen, userPublicKey, anchorProvider, fetchBalances]);

  // Countdown timer for confirmation waiting
  React.useEffect(() => {
    if (confirmationCountdown !== null && confirmationCountdown > 0) {
      const timer = setTimeout(() => {
        setConfirmationCountdown(confirmationCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [confirmationCountdown]);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setStep('input');
    setAmount('');
    setPaymentMethod('usdt');
    setActivationResult(null);
    setError(null);
    setCreditBalance(null);
    setConfirmationCountdown(null);
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

    // Validate on-chain USDT balance availability
    try {
      const availableMicro = Number(usdtBalanceMicro ?? 0);
      const requestedMicro = Math.floor(investmentAmount * 1_000_000);
      if (!Number.isFinite(availableMicro) || requestedMicro > availableMicro) {
        const availUsd = (availableMicro / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        showError(`Insufficient USDT balance. Available: $${availUsd}`, 'Agent activation', undefined, {
          showRetry: false,
          duration: 5000,
        });
        return;
      }
    } catch (e) {
      console.warn('[Hire] USDT balance check failed:', e);
    }

    // Proceed with backend init → on-chain payment → backend verify
    try {
      setStep('processing');
      setError(null);

      // Ensure backend JWT is present before calling protected endpoints
      try {
        const token = localStorage.getItem('solairus.jwt');
        if (!token && userPublicKey) {
          await AuthService.authenticateWallet(userPublicKey.toBase58());
        }
      } catch (authErr) {
        console.warn('[Hire] Silent auth failed, proceeding may 401:', authErr);
      }

      // Resolve USDT mint using same cluster logic as license activation
      const overrideCluster = (() => {
        try { return (localStorage.getItem('solana_cluster_override') ?? '').toLowerCase(); } catch { return ''; }
      })();
      const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet').toLowerCase();
      const effectiveCluster = overrideCluster || envCluster;
      const normalizedCluster = effectiveCluster.startsWith('mainnet') ? 'mainnet-beta' : 'devnet';
      const usdtMintStr = normalizedCluster === 'mainnet-beta'
        ? (import.meta.env.VITE_USDT_MINT as string)
        : (import.meta.env.VITE_USDT_MINT_DEVNET as string);
      if (!usdtMintStr) throw new Error('USDT mint not configured in .env');
      const usdtMint = new PublicKey(usdtMintStr);

      if (!anchorProvider) throw new Error('Wallet provider is missing signing capabilities');
      const payService = new SolairusPayService(anchorProvider);

      // Convert amount to micro-USDT (base units) safely
      const toMicro = (val: string): number => {
        const trimmed = val.trim();
        if (!/^\d*(\.\d{0,6})?$/.test(trimmed)) {
          throw new Error('Invalid amount format');
        }
        const [whole, frac = ''] = trimmed.split('.');
        const fracPadded = (frac + '000000').slice(0, 6);
        const microStr = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
        const micro = Number(microStr);
        if (!Number.isFinite(micro)) throw new Error('Amount conversion error');
        return micro;
      };
      const amountMicro = toMicro(amount);

      const initiatorWallet = userPublicKey.toBase58();

      // 1) Backend init: create transaction record to obtain order ID
      const initUrl = `${API_CONFIG.getBaseUrl()}/payments/activate`;
      const initBody = {
        type: 'agent_activation',
        initiatorWallet,
        amount: amountMicro,
        mintAddress: usdtMintStr,
        decimals: 6,
        programId: payService.programId.toBase58(),
        metadata: { flow: 'agent_activation', tier: tierName }
      };
      const initRes = await ApiClient.post(initUrl, initBody);
      const initData = await initRes.json();

      // Handle different response types
      let orderId: string;
      let isResumed = false;

      if (initRes.status === 200 && initData.completed && initData.record) {
        // Transaction already completed - no payment needed
        console.log('Agent activation already completed:', initData.record.order_id);
        // Show success message and close modal
        setActivationResult({ success: true });
        setStep('success');
        showSuccess('Agent activation completed', {
          description: 'Your agent has been successfully activated.',
          duration: 6000,
        });
        onSuccess();
        return; // Exit early, no payment needed
      } else if (initRes.status === 200 && initData.pendingTransaction && initData.record) {
        // Pending transaction exists - show management modal
        console.log('Pending agent activation transaction found:', initData.record.order_id);
        setPendingTransaction(initData.record);
        setShowPendingModal(true);
        return; // Exit to show pending modal
      } else if (initRes.status === 200 && initData.resumed && initData.record) {
        // Resumed existing transaction that needs payment (license activation style)
        orderId = (initData.record.order_id) as string;
        isResumed = true;
        console.log('Resumed existing agent activation transaction:', orderId);
      } else if (initRes.status === 201 && initData.record) {
        // Created new transaction
        orderId = (initData.record.order_id) as string;
        console.log('Created new agent activation transaction:', orderId);
      } else {
        throw new Error('Failed to initialize payment order (missing order_id)');
      }

      // 2) On-chain payment via solairus_pay with memo containing order id
      const memo = orderId;

      // Start countdown for user feedback
      setConfirmationCountdown(30);

      const signature = await payService.makePayment({
        payer: userPublicKey,
        mint: usdtMint,
        recipient: userPublicKey,
        amount: amountMicro,
        memo,
      });
      setTxSig(signature);
      setConfirmationCountdown(null); // Payment sent, stop countdown

      // 3) Record transaction signature - backend handles verification and status updates
      const recordUrl = `${API_CONFIG.getBaseUrl()}/transactions/record/signature`;
      const recordBody = {
        orderId,
        signature,
      };
      const recordRes = await ApiClient.post(recordUrl, recordBody);
      const recordData = await recordRes.json();
      if (!recordRes.ok) {
        const reason = recordData?.error || 'Failed to record signature';
        throw new Error(reason);
      }

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
            break; // Success!
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

      // Success UI update and callback
      setActivationResult({ success: true });
      setStep('success');
      showSuccess('Agent activation successful', {
        description: getTierSpecificSuccessMessage(tierName, Number.parseFloat(amount || '0').toFixed(2), tierRow),
        duration: 6000,
      });
      onSuccess();
    } catch (e) {
      console.error('[Hire] Agent activation failed:', e);
      setError(e);
      setStep('error');
      showError(e instanceof Error ? e.message : 'Activation failed', 'Agent activation', undefined, {
        showRetry: true,
        duration: 6000,
      });
    }
  };

  const handleRetry = () => {
    setStep('input');
    setError(null);
    setActivationResult(null);
    setConfirmationCountdown(null);
  };

  const handleStartOver = () => {
    setStep('input');
    setAmount('');
    setPaymentMethod('usdt');
    setActivationResult(null);
    setError(null);
    setConfirmationCountdown(null);
  };

  const handleCheckPendingPayment = async () => {
    if (!pendingTransaction) return;

    try {
      setShowPendingModal(false);
      setStep('processing');
      setError(null);

      // Try to reapply the pending transaction
      const orderId = pendingTransaction.order_id as string;
      const reapplyUrl = `${API_CONFIG.getBaseUrl()}/transactions/reapply-agent`;
      const reapplyBody = { orderId, initiatorWallet: userPublicKey.toBase58() };
      const reappliedRes = await ApiClient.post(reapplyUrl, reapplyBody);
      const reappliedData = await reappliedRes.json();

      if (reappliedRes.ok && reappliedData?.reapplied) {
        // Success - pending transaction was completed
        setActivationResult({ success: true });
        setStep('success');
        showSuccess('Agent activation completed', {
          description: 'Your pending agent activation has been successfully completed.',
          duration: 6000,
        });
        onSuccess();
        return;
      }

      // Payment not found or failed - show error and allow retry
      setStep('error');
      setError('Pending payment not found or verification failed. Please try again or cancel to start fresh.');
    } catch (e) {
      console.error('Error checking pending payment:', e);
      setStep('error');
      setError('Failed to check pending payment status. Please try again.');
    }
  };

  const handleCancelPendingAndStartFresh = async () => {
    if (!pendingTransaction) return;

    try {
      setShowPendingModal(false);
      setStep('processing');
      setError(null);

      // Cancel the pending transaction by updating its status
      const cancelUrl = `${API_CONFIG.getBaseUrl()}/transactions/${pendingTransaction.id}/cancel`;
      await ApiClient.post(cancelUrl, {});

      // Now proceed with creating a new transaction
      await proceedWithNewTransaction();
    } catch (e) {
      console.error('Error canceling pending transaction:', e);
      setStep('error');
      setError('Failed to cancel pending transaction. Please try again.');
    }
  };

  const proceedWithNewTransaction = async () => {
    // This is essentially the same logic as the original handleActivate
    // but called after canceling the pending transaction
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

    // Only USDT payments are supported in this flow
    if (paymentMethod !== 'usdt') {
      showError('Credit payment is not available yet. Please use USDT.', 'Agent activation', undefined, {
        showRetry: false,
        duration: 5000,
      });
      return;
    }

    // Proceed with backend init → on-chain payment → backend verify
    try {
      setStep('processing');
      setError(null);

      // Ensure backend JWT is present before calling protected endpoints
      try {
        const token = localStorage.getItem('solairus.jwt');
        if (!token && userPublicKey) {
          await AuthService.authenticateWallet(userPublicKey.toBase58());
        }
      } catch (authErr) {
        console.warn('[Hire] Silent auth failed, proceeding may 401:', authErr);
      }

      // Resolve USDT mint using same cluster logic as license activation
      const overrideCluster = (() => {
        try { return (localStorage.getItem('solana_cluster_override') ?? '').toLowerCase(); } catch { return ''; }
      })();
      const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet').toLowerCase();
      const effectiveCluster = overrideCluster || envCluster;
      const normalizedCluster = effectiveCluster.startsWith('mainnet') ? 'mainnet-beta' : 'devnet';
      const usdtMintStr = normalizedCluster === 'mainnet-beta'
        ? (import.meta.env.VITE_USDT_MINT as string)
        : (import.meta.env.VITE_USDT_MINT_DEVNET as string);
      if (!usdtMintStr) throw new Error('USDT mint not configured in .env');
      const usdtMint = new PublicKey(usdtMintStr);

      if (!anchorProvider) throw new Error('Wallet provider is missing signing capabilities');
      const payService = new SolairusPayService(anchorProvider);

      // Convert amount to micro-USDT (base units) safely
      const toMicro = (val: string): number => {
        const trimmed = val.trim();
        if (!/^\d*(\.\d{0,6})?$/.test(trimmed)) {
          throw new Error('Invalid amount format');
        }
        const [whole, frac = ''] = trimmed.split('.');
        const fracPadded = (frac + '000000').slice(0, 6);
        const microStr = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
        const micro = Number(microStr);
        if (!Number.isFinite(micro)) throw new Error('Amount conversion error');
        return micro;
      };
      const amountMicro = toMicro(amount);

      const initiatorWallet = userPublicKey.toBase58();

      // 1) Backend init: create transaction record to obtain order ID
      const initUrl = `${API_CONFIG.getBaseUrl()}/payments/activate`;
      const initBody = {
        type: 'agent_activation',
        initiatorWallet,
        amount: amountMicro,
        mintAddress: usdtMintStr,
        decimals: 6,
        programId: payService.programId.toBase58(),
        metadata: { flow: 'agent_activation', tier: tierName }
      };
      const initRes = await ApiClient.post(initUrl, initBody);
      const initData = await initRes.json();
      const orderId: string = (initData?.record?.order_id ?? initData?.order_id) as string;
      if (!orderId) throw new Error('Failed to initialize payment order (missing order_id)');

      // 2) On-chain payment via solairus_pay with memo containing order id
      const memo = orderId;

      // Start countdown for user feedback
      setConfirmationCountdown(30);

      const signature = await payService.makePayment({
        payer: userPublicKey,
        mint: usdtMint,
        recipient: userPublicKey,
        amount: amountMicro,
        memo,
      });
      setTxSig(signature);
      setConfirmationCountdown(null); // Payment sent, stop countdown

      // 3) Record transaction signature - backend handles verification and status updates
      const recordUrl = `${API_CONFIG.getBaseUrl()}/transactions/record/signature`;
      const recordBody = {
        orderId,
        signature,
      };
      const recordRes = await ApiClient.post(recordUrl, recordBody);
      const recordData = await recordRes.json();
      if (!recordRes.ok) {
        const reason = recordData?.error || 'Failed to record signature';
        throw new Error(reason);
      }

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
            break; // Success!
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

      // Success UI update and callback
      setActivationResult({ success: true });
      setStep('success');
      showSuccess('Agent activation successful', {
        description: getTierSpecificSuccessMessage(tierName, Number.parseFloat(amount || '0').toFixed(2), tierRow),
        duration: 6000,
      });
      onSuccess();
    } catch (e) {
      console.error('[Hire] Agent activation failed:', e);
      setError(e);
      setStep('error');
      showError(e instanceof Error ? e.message : 'Activation failed', 'Agent activation', undefined, {
        showRetry: true,
        duration: 6000,
      });
    }
  };

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

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-sm">
                {confirmationCountdown !== null
                  ? `Awaiting blockchain confirmation - ${confirmationCountdown}s`
                  : 'Processing your activation...'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {confirmationCountdown !== null
                  ? 'Please wait while we confirm your transaction on the blockchain.'
                  : 'Please wait while we confirm your transaction.'
                }
              </p>
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

      {/* Pending Transaction Management Modal */}
      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Pending Agent Activation</DialogTitle>
            <DialogDescription className="text-center">
              You have a pending agent activation transaction. What would you like to do?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Pending Transaction Details</span>
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <p>Amount: ${(pendingTransaction?.amount ? (Number(pendingTransaction.amount) / 1_000_000).toFixed(2) : '0.00')} USDT</p>
                <p>Status: {String(pendingTransaction?.status || 'Unknown')}</p>
                <p>Created: {pendingTransaction?.created_at ? new Date(pendingTransaction.created_at as string).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleCheckPendingPayment}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Check Payment Status
              </Button>
              <Button
                onClick={handleCancelPendingAndStartFresh}
                variant="outline"
                className="w-full"
              >
                Cancel & Start Fresh
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Check if your previous payment was completed, or cancel to create a new transaction with the current amount.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

/**
 * Agent Hire Page
 * Purpose: Let users choose an AI agent tier and activate using USDT or credit balance.
 * Inputs: Wallet context provides `publicKey`, `provider`, and `anchorProvider`.
 * Outputs: Activation modal and navigation to portfolio.
 * Notes: Mobile-first layout consistent with other /dapp pages.
 */
export default function DappHire() {
  const { publicKey, provider, anchorProvider } = useWallet();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [tiersMap, setTiersMap] = useState<Record<string, AgentTierRow>>({});
  const [pendingTransaction, setPendingTransaction] = useState<Record<string, unknown> | null>(null);
  const [showPendingDialog, setShowPendingDialog] = useState(false);

  // Fetch agent tiers from backend and check for pending transactions
  useEffect(() => {
    (async () => {
      try {
        const map = await getAgentTiersMap();
        setTiersMap(map);
      } catch (error) {
        console.warn('Failed to load agent tiers from backend:', error);
      }
    })();

    // Check for pending transactions when component mounts
    if (publicKey) {
      checkPendingTransaction();
    }
  }, [publicKey]);

  const handleActivationSuccess = () => {
    // Close modal and navigate to portfolio
    setSelectedTier(null);
    setPendingTransaction(null);
    setShowPendingDialog(false);
    navigate('/dapp/my-agents');
  };

  const checkPendingTransaction = async () => {
    if (!publicKey) return;

    try {
      const lastUrl = `${API_CONFIG.getBaseUrl()}/transactions/last-confirmed?initiatorWallet=${encodeURIComponent(publicKey.toBase58())}`;
      const lastRes = await ApiClient.get(lastUrl);
      const lastData = await lastRes.json();
      const record = lastData?.record as Record<string, unknown> | undefined | null;

      if (record && record.type === 'agent_activation' && record.status === 'pending') {
        setPendingTransaction(record);
        setShowPendingDialog(true);
      }
    } catch (error) {
      console.warn('Failed to check pending transactions:', error);
    }
  };

  const handleProceedWithPending = () => {
    if (pendingTransaction) {
      // Navigate to transaction status page or show modal to complete payment
      navigate(`/dapp/transactions/${pendingTransaction.order_id}`);
    }
  };

  const handleCancelPending = async () => {
    if (!pendingTransaction) return;

    try {
      // For now, just close the dialog and clear state
      // In a full implementation, you'd call an API to mark as cancelled
      setPendingTransaction(null);
      setShowPendingDialog(false);
    } catch (error) {
      console.warn('Failed to cancel pending transaction:', error);
    }
  };

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
                <Bot className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Deploy AI Trading Agent</h1>
              <p className="text-xs text-muted-foreground">Choose a tier and activate your agent with USDT or credit balance</p>
            </div>
          </div>

          {/* Tier Cards - Mobile Optimized */}
          <div className="space-y-2">
            {/* NOVA Tier */}
            <div className="relative bg-gradient-to-r from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 min-h-[6rem] h-auto"
              style={{ borderRadius: '48px 8px 8px 48px' }}>
              <div className="flex items-center h-full px-3 py-3">
                <div className="h-20 rounded-full overflow-hidden border-2 border-cyan-400/30 flex-shrink-0 flex items-center justify-center" style={{ width: '7.5rem' }}>
                  <img
                    src="/media/agents/nova.jpeg"
                    alt="NOVA Agent"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 ml-4 flex flex-col justify-center items-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <h3 className="text-sm font-bold text-cyan-400">NOVA Agent</h3>
                    <span className="text-sm">🪶</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 text-center">Pattern Seeker • Low Risk</p>
                  <div className="text-center mb-1">
                    <p className="text-xs text-cyan-300 font-medium">{tiersMap.NOVA ? `${formatDailyRange(tiersMap.NOVA.daily_reward_min_bp, tiersMap.NOVA.daily_reward_max_bp)} daily` : '—'}</p>
                    <p className="text-xs text-muted-foreground">{tiersMap.NOVA ? `Min: $${microToUsdt(tiersMap.NOVA.min_amount)} • Max: $${microToUsdt(tiersMap.NOVA.max_amount).toLocaleString()}` : 'Min/Max: —'}</p>
                  </div>

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
                <div className="h-20 rounded-full overflow-hidden border-2 border-emerald-400/30 flex-shrink-0 flex items-center justify-center" style={{ width: '7.5rem' }}>
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
                    <p className="text-xs text-emerald-300 font-medium">{tiersMap.VEGA ? `${formatDailyRange(tiersMap.VEGA.daily_reward_min_bp, tiersMap.VEGA.daily_reward_max_bp)} daily` : '—'}</p>
                    <p className="text-xs text-muted-foreground">{tiersMap.VEGA ? `Min: $${microToUsdt(tiersMap.VEGA.min_amount)} • Max: $${microToUsdt(tiersMap.VEGA.max_amount).toLocaleString()}` : 'Min/Max: —'}</p>
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
                <div className="h-20 rounded-full overflow-hidden border-2 border-indigo-400/30 flex-shrink-0 flex items-center justify-center" style={{ width: '7.5rem' }}>
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
                    <p className="text-xs text-indigo-300 font-medium">{tiersMap.ORION ? `${formatDailyRange(tiersMap.ORION.daily_reward_min_bp, tiersMap.ORION.daily_reward_max_bp)} daily` : '—'}</p>
                    <p className="text-xs text-muted-foreground">{tiersMap.ORION ? `Min: $${microToUsdt(tiersMap.ORION.min_amount)} • Max: $${microToUsdt(tiersMap.ORION.max_amount).toLocaleString()}` : 'Min/Max: —'}</p>
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
                <div className="h-20 rounded-full overflow-hidden border-2 border-amber-400/30 flex-shrink-0 flex items-center justify-center" style={{ width: '7.5rem' }}>
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
                    <p className="text-xs text-amber-300 font-medium">{tiersMap.PRIME ? `${formatDailyRange(tiersMap.PRIME.daily_reward_min_bp, tiersMap.PRIME.daily_reward_max_bp)} daily` : '—'}</p>
                    <p className="text-xs text-muted-foreground">{tiersMap.PRIME ? `Min: $${microToUsdt(tiersMap.PRIME.min_amount)} • Max: $${microToUsdt(tiersMap.PRIME.max_amount).toLocaleString()}` : 'Min/Max: —'}</p>
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
          {selectedTier && publicKey && anchorProvider && (
            <DirectHireModal
              isOpen={!!selectedTier}
              onClose={() => setSelectedTier(null)}
              tierName={selectedTier}
              userPublicKey={publicKey}
              anchorProvider={anchorProvider}
              tierRow={selectedTier ? tiersMap[selectedTier] : undefined}
              tiersMap={tiersMap}
              onSuccess={handleActivationSuccess}
            />
          )}

          {/* Pending Transaction Dialog */}
          <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle className="text-center">Pending Agent Activation</DialogTitle>
                <DialogDescription className="text-center">
                  You have a pending agent activation transaction that needs to be completed.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Transaction Details</span>
                  </div>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>Amount: ${(pendingTransaction?.amount ? (Number(pendingTransaction.amount) / 1_000_000).toFixed(2) : '0.00')} USDT</p>
                    <p>Status: {String(pendingTransaction?.status || 'Unknown')}</p>
                    <p>Created: {pendingTransaction?.created_at ? new Date(pendingTransaction.created_at as string).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleProceedWithPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Complete Payment
                  </Button>
                  <Button
                    onClick={handleCancelPending}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel Transaction
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Choose to complete your pending payment or cancel to start fresh.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </WalletGate>
    </LicenseGuard>
  );
}