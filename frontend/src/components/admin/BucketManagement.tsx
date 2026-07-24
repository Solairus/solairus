import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wallet, AlertCircle, ArrowDownToLine, DollarSign } from 'lucide-react';
import { useAdmin } from './AdminProvider';
import { useAdminErrorHandler } from '@/utils/admin-error-handler';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/wallet-context';
import { ensureUserUsdtAta, isAtaSetupRequired } from '@/utils/ensure-usdt-ata';

type BucketType = 'admin' | 'dev' | 'marketer1' | 'marketer2' | 'trader' | 'reserve';

interface BucketBalances {
  id: number;
  admin: string;
  dev: string;
  marketer1: string;
  marketer2: string;
  trader: string;
  reserve: string;
}

export function BucketManagement() {
  const { role, context } = useAdmin();
  const { toast } = useToast();
  const { showError } = useAdminErrorHandler();
  // Wallet — needed for the one-time USDT-account setup (admin pays their own refundable rent).
  const { publicKey, provider, signTransaction } = useWallet();

  const [balances, setBalances] = useState<BucketBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<BucketType | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Use centralized role and context from AdminProvider
  // Normalize buckets: map `systemreserve` → `reserve` for backend compatibility.
  const normalize = (list: string[]): BucketType[] =>
    (list || []).map((b) => (b === 'systemreserve' ? 'reserve' : b)) as BucketType[];
  // accessibleBuckets = what the role can SEE; withdrawableBuckets = what it can cash out.
  const accessibleBuckets = normalize(context.accessibleBuckets || []);
  const withdrawableBuckets = normalize(context.withdrawableBuckets || []);

  const loadBalances = async () => {
    try {
      setLoading(true);
      const baseUrl = API_CONFIG.getBaseUrl();
      const response = await ApiClient.get(`${baseUrl}/admin/buckets`);
      const data = await response.json();
      setBalances(data);
    } catch (error) {
      console.error('Error loading bucket balances:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bucket balances',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== null) {
      loadBalances();
    }
  }, [role]);

  if (role === null) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="p-6">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-400 text-center mb-2">Access Denied</h3>
          <p className="text-red-300 text-center">
            Admin privileges required to access bucket management.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleWithdraw = async () => {
    if (!selectedBucket) {
      showError('No bucket selected', 'Bucket withdrawal', { showRetry: false });
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      showError('Enter a valid amount', 'Bucket withdrawal', { showRetry: false });
      return;
    }

    const amountMicro = Math.floor(amount * 1_000_000);
    const currentBalanceUnits = balances ? parseFloat(balances[selectedBucket] || '0') : 0;

    if (amount > currentBalanceUnits) {
      showError('Insufficient bucket balance', 'Bucket withdrawal', { showRetry: false });
      return;
    }

    try {
      setWithdrawing(true);

      const baseUrl = API_CONFIG.getBaseUrl();
      const post = () => ApiClient.post(`${baseUrl}/admin/buckets/${selectedBucket}/withdraw`, { amountMicro });

      let resp = await post();
      let json = await resp.json().catch(() => ({} as Record<string, unknown>));

      // One-time USDT-account setup gate (NOT an error): the admin creates their own
      // account (paying the small refundable rent); the platform never does.
      if (resp.ok && isAtaSetupRequired(json)) {
        if (!publicKey || !provider || !signTransaction) {
          throw new Error('Your wallet needs to set up a USDT account first — connect a wallet that can sign.');
        }
        toast({ title: 'One-time setup', description: 'Activating USDT on your wallet — approve the request (small, refundable network deposit ~0.002 SOL).' });
        await ensureUserUsdtAta(provider, { publicKey, signTransaction });
        resp = await post();
        json = await resp.json().catch(() => ({} as Record<string, unknown>));
        if (isAtaSetupRequired(json)) throw new Error('USDT account setup didn’t complete. Please try again.');
      }

      if (!resp.ok) throw new Error((json as { error?: string }).error || 'Withdrawal failed');

      const status = (json as { status?: string }).status;
      if (resp.status === 202 || status === 'processing') {
        toast({ title: 'Submitted', description: 'Payout submitted — confirmation pending. It will be reconciled automatically.' });
      } else if ((json as { success?: boolean }).success) {
        const sig = (json as { signature?: string }).signature;
        toast({
          title: 'Success',
          description: `Withdrew ${amount} USDT from ${selectedBucket} bucket${sig ? ` · tx ${sig.slice(0, 8)}…` : ''}`,
        });
      } else {
        throw new Error((json as { error?: string }).error || 'Withdrawal failed');
      }

      setShowWithdrawForm(false);
      setWithdrawAmount('');
      setSelectedBucket(null);
      await loadBalances();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Withdrawal failed';
      showError(msg, 'Bucket withdrawal', { showRetry: true });
    } finally {
      setWithdrawing(false);
    }
  };

  const formatBalance = (balanceStr: string): string => {
    const raw = balanceStr ?? '0';
    const hasDecimal = raw.includes('.');
    let value: number;
    if (hasDecimal) {
      // Backend returns numeric(20,6) formatted USDT values like "0.400000"
      value = parseFloat(raw);
    } else {
      // Fallback for micro amounts represented as integers (e.g., 400000)
      value = parseFloat(raw) / 1_000_000;
    }
    if (!isFinite(value)) value = 0;
    return value.toFixed(6);
  };

  const displayName = (bucket: BucketType): string => {
    switch (bucket) {
      case 'admin': return 'Admin';
      case 'dev': return 'Developer';
      case 'marketer1': return 'Marketer 1';
      case 'marketer2': return 'Marketer 2';
      case 'trader': return 'Trader';
      case 'reserve': return 'System Reserve';
      default: return bucket;
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Bucket Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            <span className="ml-2 text-gray-400">Loading bucket balances...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="h-6 w-6" />
              Bucket Management
            </CardTitle>
            <Button
              onClick={loadBalances}
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <p className="text-gray-400 text-sm">
            Manage system bucket balances and withdrawals.
            You can withdraw from {withdrawableBuckets.map((b) => displayName(b)).join(', ')} buckets.
          </p>
        </CardHeader>
      </Card>

      {/* Bucket Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(accessibleBuckets as BucketType[]).map((bucketType) => {
          const canWithdraw = withdrawableBuckets.includes(bucketType);
          const balance = balances ? formatBalance(balances[bucketType]) : '0.00';

          return (
            <Card key={bucketType} className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <DollarSign className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white capitalize">
                        {displayName(bucketType)}
                      </h3>
                      <Badge
                        variant={canWithdraw ? "default" : "secondary"}
                        className={canWithdraw ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}
                      >
                        {canWithdraw ? 'Can Withdraw' : 'View Only'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">${balance}</p>
                    <p className="text-sm text-gray-400">USDT Balance</p>
                  </div>

                  {canWithdraw && (
                    <Button
                      onClick={() => {
                        setSelectedBucket(bucketType);
                        setShowWithdrawForm(true);
                      }}
                      disabled={parseFloat(balance) <= 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Withdraw
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Withdrawal Form Modal */}
      {showWithdrawForm && selectedBucket && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Withdraw from {selectedBucket} Bucket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount" className="text-gray-300">
                Amount (USDT)
              </Label>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount in USDT"
                max={balances ? formatBalance(balances[selectedBucket]) : '0'}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={withdrawing}
              />
              <p className="text-sm text-gray-400">
                Available: ${balances ? formatBalance(balances[selectedBucket]) : '0.00'} USDT
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {withdrawing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                    Withdraw
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowWithdrawForm(false);
                  setWithdrawAmount('');
                  setSelectedBucket(null);
                }}
                variant="outline"
                disabled={withdrawing}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}