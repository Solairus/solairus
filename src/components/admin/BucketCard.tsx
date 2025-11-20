import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wallet, ArrowDownToLine, DollarSign, TrendingUp } from 'lucide-react';
import { BucketType } from '@/hooks/useBucketBalances';
import { formatUsdtAmount, parseUsdtAmount, withdrawFromBucket } from '@/services/bucket/bucket-service';
import { useWallet } from '@/contexts/wallet-context';
import { useAdminErrorHandler } from '@/utils/admin-error-handler';
import { useTransactionStatus } from '@/hooks/useTransactionStatus';
import { LoadingCard } from './LoadingStates';
import { ConfirmationDialog } from './ConfirmationDialog';
import { FormValidation, useFormValidation, validators } from './FormValidation';
import * as anchor from '@coral-xyz/anchor';

interface BucketCardProps {
  bucketType: BucketType;
  balance: anchor.BN;
  canWithdraw: boolean;
  onWithdrawSuccess?: () => void;
}

export function BucketCard({ bucketType, balance, canWithdraw, onWithdrawSuccess }: BucketCardProps) {
  const { anchorProvider, publicKey, signTransaction } = useWallet();
  const { showError, showSuccess } = useAdminErrorHandler();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const validation = useFormValidation();
  
  const transactionStatus = useTransactionStatus({
    steps: [
      { id: 'validate', label: 'Validating withdrawal' },
      { id: 'sign', label: 'Waiting for signature' },
      { id: 'confirm', label: 'Confirming transaction' },
    ],
    onSuccess: (signature) => {
      showSuccess(`Successfully withdrew ${withdrawAmount} USDT from ${bucketDisplayNames[bucketType]} bucket`, {
        description: `Transaction: ${signature.slice(0, 8)}...`,
      });
      setWithdrawAmount('');
      setShowWithdrawForm(false);
      onWithdrawSuccess?.();
    },
    onError: (error) => {
      showError(error.originalError, `Withdraw from ${bucketType} bucket`, {
        showRetry: error.isRetryable,
        onRetry: () => handleWithdraw(),
      });
    },
  });

  const bucketDisplayNames: Record<BucketType, string> = {
    admin: 'Admin',
    dev: 'Developer',
    marketer_1: 'Marketer 1',
    marketer_2: 'Marketer 2',
    trader: 'Trader',
    reserve: 'System Reserve',
  };

  const bucketColors: Record<BucketType, string> = {
    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
    dev: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    marketer_1: 'bg-green-500/10 text-green-400 border-green-500/20',
    marketer_2: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    trader: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    reserve: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  const formattedBalance = formatUsdtAmount(balance);
  const isZeroBalance = balance.eq(new anchor.BN(0));

  const validateWithdrawal = () => {
    validation.clearErrors();
    
    if (!anchorProvider || !publicKey) {
      validation.addError('wallet', 'Wallet not connected');
      return false;
    }

    const amountError = validators.usdtAmount(withdrawAmount, 'Amount');
    if (amountError) {
      validation.addError(amountError.field, amountError.message);
      return false;
    }

    const amountBN = parseUsdtAmount(withdrawAmount);
    if (amountBN.gt(balance)) {
      validation.addError('amount', 'Amount exceeds available balance');
      return false;
    }

    return true;
  };

  const handleWithdrawClick = () => {
    if (validateWithdrawal()) {
      setShowConfirmDialog(true);
    }
  };

  // Helper: resolve USDT mint based on cluster
  const resolveUsdtMint = (): PublicKey => {
    const override = localStorage.getItem('solana_cluster_override')?.toLowerCase();
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet').toLowerCase();
    const effective = override || envCluster;
    const normalized = effective.startsWith('mainnet') ? 'mainnet-beta' : 'devnet';

    const mintStr = normalized === 'mainnet-beta'
      ? (import.meta.env.VITE_USDT_MINT as string)
      : (import.meta.env.VITE_USDT_MINT_DEVNET as string);

    if (!mintStr) throw new Error('USDT mint not configured');
    return new PublicKey(mintStr);
  };

  const handleWithdraw = async () => {
    if (!validateWithdrawal()) return;

    const amountBN = parseUsdtAmount(withdrawAmount);

    await transactionStatus.executeTransaction(async () => {
      transactionStatus.updateProgress(20, 'validate');
      
      const txSignature = await withdrawFromBucket({
        provider: anchorProvider,
        connection: anchorProvider.connection,
        bucketType,
        amount: amountBN,
        authority: publicKey,
        usdtMint: resolveUsdtMint(),
        signTransaction: signTransaction || undefined,
      });

      return txSignature;
    }, `Withdraw from ${bucketType} bucket`);
  };

  const handleMaxAmount = () => {
    setWithdrawAmount(formattedBalance);
  };

  return (
    <>
      <Card className="bg-gray-900/50 border-gray-800 hover:bg-gray-900/60 transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <div className={`p-2 rounded-lg ${bucketColors[bucketType].replace('text-', 'bg-').replace('border-', '').split(' ')[0]}/20`}>
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div>{bucketDisplayNames[bucketType]}</div>
                <div className="text-xs text-gray-400 font-normal">Bucket</div>
              </div>
            </CardTitle>
            <Badge className={bucketColors[bucketType]}>
              {bucketType.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Balance Display */}
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-400">Available Balance</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {formattedBalance}
            </div>
            <div className="text-sm text-gray-400">
              USDT
            </div>
            {!isZeroBalance && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-green-400">
                <TrendingUp className="h-3 w-3" />
                <span>Ready for withdrawal</span>
              </div>
            )}
          </div>

          {/* Transaction Status */}
          {transactionStatus.isLoading && (
            <LoadingCard
              title="Processing Withdrawal"
              message={transactionStatus.state.currentStep}
              progress={transactionStatus.state.progress}
              steps={transactionStatus.state.steps}
              variant="compact"
            />
          )}

          {/* Form Validation */}
          <FormValidation errors={validation.errors} />

          {/* Withdrawal Form */}
          {canWithdraw && !isZeroBalance && !transactionStatus.isLoading && (
            <div className="space-y-3">
              {!showWithdrawForm ? (
                <Button
                  onClick={() => setShowWithdrawForm(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Withdraw Funds
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">
                      Withdrawal Amount (USDT)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0.000000"
                        value={withdrawAmount}
                        onChange={(e) => {
                          setWithdrawAmount(e.target.value);
                          validation.removeError('amount');
                        }}
                        className="bg-gray-800 border-gray-700 text-white"
                        step="0.000001"
                        min="0"
                        max={formattedBalance}
                      />
                      <Button
                        onClick={handleMaxAmount}
                        variant="outline"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 px-3"
                      >
                        Max
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Maximum: {formattedBalance} USDT
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleWithdrawClick}
                      disabled={!withdrawAmount || validation.hasErrors()}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      Confirm Withdrawal
                    </Button>
                    
                    <Button
                      onClick={() => {
                        setShowWithdrawForm(false);
                        setWithdrawAmount('');
                        validation.clearErrors();
                      }}
                      variant="outline"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Messages */}
          {canWithdraw && isZeroBalance && (
            <div className="text-center py-4 text-gray-500 text-sm bg-gray-800/30 rounded-lg">
              No balance available for withdrawal
            </div>
          )}

          {!canWithdraw && (
            <div className="text-center py-4 text-gray-500 text-sm bg-gray-800/30 rounded-lg">
              Withdrawal not permitted for this bucket
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Withdrawal"
        description={`Are you sure you want to withdraw ${withdrawAmount} USDT from the ${bucketDisplayNames[bucketType]} bucket?`}
        confirmText="Withdraw"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleWithdraw}
        details={[
          `Amount: ${withdrawAmount} USDT`,
          `From: ${bucketDisplayNames[bucketType]} bucket`,
          `Remaining balance: ${(parseFloat(formattedBalance) - parseFloat(withdrawAmount || '0')).toFixed(6)} USDT`
        ]}
      />
    </>
  );
}