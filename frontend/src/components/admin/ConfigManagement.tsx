import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Users, 
  Percent, 
  DollarSign, 
  Calendar,
  TrendingUp,
  Save,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { SettingsService, type SettingsMap } from '@/services/settings/settings-service';

interface RoleAddresses extends Record<string, string> {
  admin: string;
  marketer1: string;
  marketer2: string;
}

interface LicensePercentages extends Record<string, number> {
  admin: number;
  dev: number;
  marketer1: number;
  marketer2: number;
  reserve: number;
  affL1: number;
  affL2: number;
  affL3: number;
}

interface AgentPercentages extends Record<string, number> {
  admin: number;
  dev: number;
  marketer1: number;
  marketer2: number;
  trader: number;
  reserve: number;
  affL1: number;
  affL2: number;
  affL3: number;
}

interface SystemParameters {
  activationFeeUsdt: string;
  roiDailyBps: number;
  licenseDurationDays: number;
}

/**
 * Configuration management interface restricted to dev role
 */
export const ConfigManagement: React.FC = () => {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsMap, setSettingsMap] = useState<SettingsMap | null>(null);
  
  // Helper: determine effective cluster (localStorage override -> env fallback)
  const getEffectiveCluster = (): 'mainnet-beta' | 'devnet' | 'testnet' => {
    let override = '';
    try {
      const v = localStorage.getItem('solana_cluster_override');
      override = (v ?? '').toLowerCase();
    } catch (_err) {
      // localStorage may be unavailable (SSR or privacy settings); fallback to env
      override = '';
    }
    const envCluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet').toLowerCase();
    const effective = override || envCluster;
    if (effective.startsWith('mainnet')) return 'mainnet-beta';
    if (effective === 'testnet') return 'testnet';
    return 'devnet';
  };

  // Helper: resolve USDT mint from environment based on cluster
  const resolveUsdtMintEnv = (): string => {
    const cluster = getEffectiveCluster();
    const mintStr = cluster === 'mainnet-beta'
      ? (import.meta.env.VITE_USDT_MINT as string)
      : (import.meta.env.VITE_USDT_MINT_DEVNET as string);
    return mintStr || '';
  };

  // Addresses managed via .env (read-only in UI)
  const envManagedAddresses: Partial<Record<keyof RoleAddresses | 'dev', string | undefined>> = {
    admin: import.meta.env.VITE_ADMIN_ADDRESS as string | undefined,
    dev: import.meta.env.VITE_DEV_ADDRESS as string | undefined,
    marketer1: import.meta.env.VITE_MARKETER1_ADDRESS as string | undefined,
    marketer2: import.meta.env.VITE_MARKETER2_ADDRESS as string | undefined,
  };
  
  // Form state
  const [roleAddresses, setRoleAddresses] = useState<RoleAddresses>({
    admin: '',
    marketer1: '',
    marketer2: '',
  });
  
  const [licensePercentages, setLicensePercentages] = useState<LicensePercentages>({
    admin: 0,
    dev: 0,
    marketer1: 0,
    marketer2: 0,
    reserve: 0,
    affL1: 0,
    affL2: 0,
    affL3: 0,
  });
  
  const [agentPercentages, setAgentPercentages] = useState<AgentPercentages>({
    admin: 0,
    dev: 0,
    marketer1: 0,
    marketer2: 0,
    trader: 0,
    reserve: 0,
    affL1: 0,
    affL2: 0,
    affL3: 0,
  });
  
  const [systemParameters, setSystemParameters] = useState<SystemParameters>({
    activationFeeUsdt: '0',
    roiDailyBps: 0,
    licenseDurationDays: 365,
  });

  // Load current configuration
  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    try {
      const map = await SettingsService.getSettingsMap();
      setSettingsMap(map);

      // Populate form with backend values where available
      // Admin/marketer addresses are read-only from .env
      setRoleAddresses({
        admin: (envManagedAddresses.admin as string) || '',
        marketer1: (envManagedAddresses.marketer1 as string) || '',
        marketer2: (envManagedAddresses.marketer2 as string) || '',
      });

      setLicensePercentages({
        admin: Number(map['license.admin_pct'] ?? 0),
        dev: Number(map['license.dev_pct'] ?? 0),
        marketer1: Number(map['license.marketer1_pct'] ?? 0),
        marketer2: Number(map['license.marketer2_pct'] ?? 0),
        reserve: Number(map['license.reserve_pct'] ?? 0),
        // Map affiliate percentages (stored as decimals) to percentage inputs
        affL1: Number(map['affiliate.l1_pct'] ?? 0) * 100,
        affL2: Number(map['affiliate.l2_pct'] ?? 0) * 100,
        affL3: Number(map['affiliate.l3_pct'] ?? 0) * 100,
      });

      setAgentPercentages({
        admin: Number(map['agent.admin_pct'] ?? 0),
        dev: Number(map['agent.dev_pct'] ?? 0),
        marketer1: Number(map['agent.marketer1_pct'] ?? 0),
        marketer2: Number(map['agent.marketer2_pct'] ?? 0),
        trader: Number(map['agent.trader_pct'] ?? 0),
        reserve: Number(map['agent.reserve_pct'] ?? 0),
        // Mirror affiliate percentages to agent section for visibility
        affL1: Number(map['affiliate.l1_pct'] ?? 0) * 100,
        affL2: Number(map['affiliate.l2_pct'] ?? 0) * 100,
        affL3: Number(map['affiliate.l3_pct'] ?? 0) * 100,
      });

      const feeMicro = Number(map['license.fee_usdt'] ?? 0);
      setSystemParameters({
        activationFeeUsdt: (feeMicro > 0 ? feeMicro / 1_000_000 : 0).toString(),
        roiDailyBps: Number(map['system.roi_daily_bps'] ?? 0),
        licenseDurationDays: Number(map['license.term_days'] ?? 365),
      });
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Save configuration changes
  const saveConfiguration = async () => {
    // Validate percentages
    const percentageErrors: string[] = [];
    const licenseSum = Object.values(licensePercentages).reduce((sum, val) => sum + val, 0);
    if (licenseSum !== 100) {
      percentageErrors.push(`License percentages must sum to 100% (currently ${licenseSum}%)`);
    }
    const agentSum = Object.values(agentPercentages).reduce((sum, val) => sum + val, 0);
    if (agentSum !== 100) {
      percentageErrors.push(`Agent percentages must sum to 100% (currently ${agentSum}%)`);
    }
    const all = { ...licensePercentages, ...agentPercentages } as Record<string, number>;
    Object.entries(all).forEach(([key, value]) => {
      if (value < 0 || value > 100) {
        percentageErrors.push(`${key} percentage must be between 0 and 100 (currently ${value}%)`);
      }
    });
    if (percentageErrors.length) {
      toast({ title: 'Validation Error', description: percentageErrors.join(', '), variant: 'destructive' });
      return;
    }

    // Validate addresses
    const addressErrors: string[] = [];
    Object.entries(roleAddresses).forEach(([role, address]) => {
      if (address) {
        try { new PublicKey(address); } catch { addressErrors.push(`Invalid ${role} address format`); }
      }
    });
    if (addressErrors.length) {
      toast({ title: 'Validation Error', description: addressErrors.join(', '), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const feeMicro = Math.round((Number(systemParameters.activationFeeUsdt) || 0) * 1_000_000);
      const rows: Parameters<typeof SettingsService.saveSettings>[0] = [
        { key: 'license.fee_usdt', value: feeMicro, type: 'number' as const, description: 'License activation fee in micro-USDT' },
        { key: 'license.term_days', value: systemParameters.licenseDurationDays, type: 'number' as const, description: 'License duration in days' },
        { key: 'system.roi_daily_bps', value: systemParameters.roiDailyBps, type: 'number' as const, description: 'Global ROI daily basis points' },
        // Admin/marketer addresses are managed via .env and read-only in UI
        { key: 'license.admin_pct', value: licensePercentages.admin, type: 'number' as const, description: 'License distribution - admin %' },
        { key: 'license.dev_pct', value: licensePercentages.dev, type: 'number' as const, description: 'License distribution - dev %' },
        { key: 'license.marketer1_pct', value: licensePercentages.marketer1, type: 'number' as const, description: 'License distribution - marketer1 %' },
        { key: 'license.marketer2_pct', value: licensePercentages.marketer2, type: 'number' as const, description: 'License distribution - marketer2 %' },
        { key: 'license.reserve_pct', value: licensePercentages.reserve, type: 'number' as const, description: 'License distribution - reserve %' },
        { key: 'agent.admin_pct', value: agentPercentages.admin, type: 'number' as const, description: 'Agent distribution - admin %' },
        { key: 'agent.dev_pct', value: agentPercentages.dev, type: 'number' as const, description: 'Agent distribution - dev %' },
        { key: 'agent.marketer1_pct', value: agentPercentages.marketer1, type: 'number' as const, description: 'Agent distribution - marketer1 %' },
        { key: 'agent.marketer2_pct', value: agentPercentages.marketer2, type: 'number' as const, description: 'Agent distribution - marketer2 %' },
        { key: 'agent.trader_pct', value: agentPercentages.trader, type: 'number' as const, description: 'Agent distribution - trader %' },
        { key: 'agent.reserve_pct', value: agentPercentages.reserve, type: 'number' as const, description: 'Agent distribution - reserve %' },
        // Save affiliate percentages as decimals (0.05 => 5%)
        { key: 'affiliate.l1_pct', value: (licensePercentages.affL1 || 0) / 100, type: 'number' as const, description: 'Affiliate level 1 percent (decimal)' },
        { key: 'affiliate.l2_pct', value: (licensePercentages.affL2 || 0) / 100, type: 'number' as const, description: 'Affiliate level 2 percent (decimal)' },
        { key: 'affiliate.l3_pct', value: (licensePercentages.affL3 || 0) / 100, type: 'number' as const, description: 'Affiliate level 3 percent (decimal)' },
      ];

      await SettingsService.saveSettings(rows);

      toast({ title: 'Success', description: 'Configuration updated successfully.' });
      await loadConfiguration();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({ title: 'Error', description: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Calculate percentage sums for validation
  const licenseSum = Object.values(licensePercentages).reduce((sum, val) => sum + val, 0);
  const agentSum = Object.values(agentPercentages).reduce((sum, val) => sum + val, 0);
  const isEnvManagedRole = (role: string) => ['admin', 'marketer1', 'marketer2'].includes(role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">System Configuration</h1>
            <p className="text-gray-400">Manage system settings and parameters (Dev Only)</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={loadConfiguration}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            onClick={saveConfiguration}
            disabled={saving || loading || licenseSum !== 100 || agentSum !== 100}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Role Addresses Configuration */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Role Addresses</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(roleAddresses).map(([role, address]) => (
            <div key={role} className="space-y-2">
              <Label htmlFor={`role-${role}`} className="text-gray-300 capitalize">
                {role} Address {isEnvManagedRole(role) && <span className="text-xs text-gray-400">(read-only)</span>}
              </Label>
              <Input
                id={`role-${role}`}
                value={address}
                onChange={(e) => setRoleAddresses(prev => ({
                  ...prev,
                  [role]: e.target.value
                }))}
                placeholder="Enter public key address"
                className="bg-gray-700 border-gray-600 text-white"
                disabled={isEnvManagedRole(role)}
              />
              {isEnvManagedRole(role) && (
                <p className="text-xs text-gray-400">Edit in .env only</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* System Parameters */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="h-6 w-6 text-yellow-400" />
          <h2 className="text-xl font-semibold text-white">System Parameters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="activation-fee" className="text-gray-300">
              Activation Fee (USDT)
            </Label>
            <Input
              id="activation-fee"
              type="number"
              value={systemParameters.activationFeeUsdt}
              onChange={(e) => setSystemParameters(prev => ({
                ...prev,
                activationFeeUsdt: e.target.value
              }))}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="roi-bps" className="text-gray-300">
              ROI Daily (BPS)
            </Label>
            <Input
              id="roi-bps"
              type="number"
              value={systemParameters.roiDailyBps}
              onChange={(e) => setSystemParameters(prev => ({
                ...prev,
                roiDailyBps: parseInt(e.target.value) || 0
              }))}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="license-duration" className="text-gray-300">
              License Duration (Days)
            </Label>
            <Input
              id="license-duration"
              type="number"
              value={systemParameters.licenseDurationDays}
              onChange={(e) => setSystemParameters(prev => ({
                ...prev,
                licenseDurationDays: parseInt(e.target.value) || 365
              }))}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>
      </Card>

      {/* License Percentages */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Percent className="h-6 w-6 text-green-400" />
            <h2 className="text-xl font-semibold text-white">License Distribution Percentages</h2>
          </div>
          <Badge 
            variant={licenseSum === 100 ? "default" : "destructive"}
            className="text-sm"
          >
            Total: {licenseSum}%
          </Badge>
        </div>
        
        {licenseSum !== 100 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-red-400 text-sm">
              License percentages must sum to exactly 100%
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(licensePercentages).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`license-${key}`} className="text-gray-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              <Input
                id={`license-${key}`}
                type="number"
                min="0"
                max="100"
                value={value}
                onChange={(e) => setLicensePercentages(prev => ({
                  ...prev,
                  [key]: parseInt(e.target.value) || 0
                }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Agent Percentages */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Agent Distribution Percentages</h2>
          </div>
          <Badge 
            variant={agentSum === 100 ? "default" : "destructive"}
            className="text-sm"
          >
            Total: {agentSum}%
          </Badge>
        </div>
        
        {agentSum !== 100 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-red-400 text-sm">
              Agent percentages must sum to exactly 100%
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(agentPercentages).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`agent-${key}`} className="text-gray-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              <Input
                id={`agent-${key}`}
                type="number"
                min="0"
                max="100"
                value={value}
                onChange={(e) => setAgentPercentages(prev => ({
                  ...prev,
                  [key]: parseInt(e.target.value) || 0
                }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Current Configuration Display */}
      {settingsMap && (
        <Card className="p-6 bg-gray-800 border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-6 w-6 text-gray-400" />
            <h2 className="text-xl font-semibold text-white">Current Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Dev Address:</span>
              <p className="text-white font-mono text-xs break-all">{String((import.meta.env.VITE_DEV_ADDRESS as string) ?? '')}</p>
            </div>
            <div>
              <span className="text-gray-400">USDT Mint:</span>
              <p className="text-white font-mono text-xs break-all">{resolveUsdtMintEnv()}</p>
            </div>
            <div>
              <span className="text-gray-400">Current Fee:</span>
              <p className="text-white">{(Number(settingsMap['license.fee_usdt'] ?? 0) / 1_000_000).toString()} USDT</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};